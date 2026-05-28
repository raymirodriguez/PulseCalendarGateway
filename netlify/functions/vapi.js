import { getClientByAssistantId } from './_utils/client-config.js'
import { findAvailableSlots, hasConflict } from './_utils/scheduling-engine.js'
import { listEvents, createEvent } from './_utils/google-calendar.js'
import { log } from './_utils/logger.js'
import { createClient } from '@supabase/supabase-js'
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-vapi-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function json(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) }
}

// VAPI may send arguments as a JSON string or a parsed object
function parseArgs(raw) {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return {} }
  }
  return raw ?? {}
}

// ── Tool handlers ─────────────────────────────────────────────────────────────

async function handleCheckAvailability(client, args) {
  const { timezone, preferredDay, preferredPeriod } = args

  if (!timezone || !preferredDay || !preferredPeriod) {
    return 'I need a preferred day, time period (morning or afternoon), and the caller\'s timezone to check availability. Could you gather that information?'
  }

  const dayStart = fromZonedTime(`${preferredDay} 00:00:00`, client.timezone)
  const dayEnd   = fromZonedTime(`${preferredDay} 23:59:59`, client.timezone)

  const existingEvents = await listEvents(client.calendar_id, dayStart, dayEnd)
  const slots = findAvailableSlots(client, existingEvents, preferredDay, preferredPeriod, timezone)

  await log({
    clientId: client.id,
    type: 'availability_check',
    payload: args,
    response: { slotsFound: slots.length },
  })

  if (slots.length === 0) {
    return `I'm sorry, there are no available slots on ${preferredDay} in the ${preferredPeriod}. Could you ask the caller if they'd like to try a different day or time period?`
  }

  const lines = slots.map((slot, i) => {
    const label = i === 0 ? 'Option A' : 'Option B'
    return `${label}: ${slot.display.date} at ${slot.display.time} – ${slot.display.endTime} (${slot.display.timezone}) | slot_start=${slot.start} | slot_end=${slot.end}`
  })

  return [
    `I found ${slots.length} available slot${slots.length > 1 ? 's' : ''}:`,
    ...lines,
    'Please present these options to the caller and ask which they prefer. Once they confirm, use bookAppointment with the corresponding slot_start and slot_end values.',
  ].join('\n')
}

async function handleBookAppointment(client, args) {
  const { name, businessName, email, phone, slotStart, slotEnd, timezone, notes } = args

  if (!name || !slotStart || !slotEnd || !timezone) {
    return 'I need the caller\'s name, the slot start and end times, and their timezone to complete the booking.'
  }

  const start = new Date(slotStart)
  const end   = new Date(slotEnd)

  if (isNaN(start) || isNaN(end)) {
    return 'The slot times provided are not valid. Please use the exact slot_start and slot_end values returned by checkAvailability.'
  }

  // Re-check for overlap before creating (FR-005)
  const preferredDay = formatInTimeZone(start, client.timezone, 'yyyy-MM-dd')
  const dayStart = fromZonedTime(`${preferredDay} 00:00:00`, client.timezone)
  const dayEnd   = fromZonedTime(`${preferredDay} 23:59:59`, client.timezone)
  const existingEvents = await listEvents(client.calendar_id, dayStart, dayEnd)

  if (hasConflict(start, end, existingEvents, client.buffers)) {
    await log({ clientId: client.id, type: 'booking_attempt', payload: args, response: { reason: 'TIME_SLOT_UNAVAILABLE' } })
    return 'I\'m sorry, that slot was just taken. Please ask the caller if they\'d like to check availability again for a different time.'
  }

  const title = `Discovery Call — ${businessName || name} + Futura AI Solutions`
  const description = [
    `Caller: ${name}`,
    businessName ? `Business: ${businessName}` : '',
    email  ? `Email: ${email}`           : '',
    phone  ? `Phone/WhatsApp: ${phone}`  : '',
    `Timezone: ${timezone}`,
    notes  ? `\nContext:\n${notes}`      : '',
  ].filter(Boolean).join('\n')

  const attendees = []
  if (email) attendees.push({ email })
  if (client.fallback_email) attendees.push({ email: client.fallback_email })

  const googleEvent = await createEvent(client.calendar_id, {
    summary: title,
    description,
    start: { dateTime: start.toISOString(), timeZone: client.timezone },
    end:   { dateTime: end.toISOString(),   timeZone: client.timezone },
    attendees,
  })

  const { data: booking } = await supabase
    .from('bookings')
    .insert({
      client_id:      client.id,
      caller_name:    name,
      business_name:  businessName ?? null,
      email:          email        ?? null,
      phone:          phone        ?? null,
      slot_start:     start.toISOString(),
      slot_end:       end.toISOString(),
      timezone,
      notes:          notes        ?? null,
      google_event_id: googleEvent.id,
      status:         'confirmed',
    })
    .select()
    .single()

  await log({
    clientId: client.id,
    type: 'booking_success',
    payload: args,
    response: { bookingId: booking?.id, googleEventId: googleEvent.id },
  })

  const displayTime = formatInTimeZone(start, timezone, "EEEE, MMMM d 'at' h:mm a zzz")
  return [
    `The appointment has been confirmed.`,
    `${name} is booked for ${displayTime}.`,
    email ? `A calendar invite has been sent to ${email}.` : '',
    `Booking reference: ${booking?.id ?? googleEvent.id}.`,
    'Please let the caller know their appointment is confirmed and they should expect a calendar invite shortly.',
  ].filter(Boolean).join(' ')
}

// ── Main handler ──────────────────────────────────────────────────────────────

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST')    return json(405, { error: 'Method not allowed' })

  // Validate VAPI secret if configured
  const vapiSecret = process.env.VAPI_SECRET
  if (vapiSecret && event.headers['x-vapi-secret'] !== vapiSecret) {
    return json(401, { error: 'Unauthorized' })
  }

  let body
  try { body = JSON.parse(event.body) }
  catch { return json(400, { error: 'Invalid JSON' }) }

  const message = body?.message
  if (!message) return json(400, { error: 'Missing message' })

  // VAPI sends several message types (status-update, end-of-call-report, etc.)
  // We only act on tool-calls; acknowledge everything else silently.
  if (message.type !== 'tool-calls') {
    return json(200, {})
  }

  const assistantId = message.call?.assistantId
  const client = await getClientByAssistantId(assistantId)

  if (!client) {
    const errMsg = `PCG configuration error: no client is linked to assistant ID "${assistantId}". Please contact support.`
    return json(200, {
      results: (message.toolCallList ?? []).map(tc => ({
        toolCallId: tc.id,
        result: errMsg,
      })),
    })
  }

  const results = await Promise.all(
    (message.toolCallList ?? []).map(async (toolCall) => {
      const name = toolCall.function?.name
      const args = parseArgs(toolCall.function?.arguments)

      try {
        let result
        if (name === 'checkAvailability') {
          result = await handleCheckAvailability(client, args)
        } else if (name === 'bookAppointment') {
          result = await handleBookAppointment(client, args)
        } else {
          result = `Unknown tool: "${name}"`
        }
        return { toolCallId: toolCall.id, result }
      } catch (err) {
        console.error(`[vapi] tool "${name}" error:`, err)
        await log({ clientId: client.id, type: 'error', payload: { tool: name, args }, error: err })
        return {
          toolCallId: toolCall.id,
          result: 'I encountered a technical issue while processing that request. Please apologize to the caller and offer to try again.',
        }
      }
    })
  )

  return json(200, { results })
}
