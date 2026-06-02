import { getClientByAssistantId } from './_utils/client-config.js'
import { findAvailableSlots, hasConflict } from './_utils/scheduling-engine.js'
import { listEvents, createEvent } from './_utils/google-calendar.js'
import { log } from './_utils/logger.js'
import { sendBookingConfirmation, sendBusinessNotification } from './_utils/whatsapp.js'
import { createClient } from '@supabase/supabase-js'
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'

const BUSINESS_TIMEZONE = 'America/Mexico_City'

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

function handleGetCurrentTime() {
  const now = new Date()
  const display = formatInTimeZone(now, BUSINESS_TIMEZONE, "EEEE, MMMM d, yyyy 'at' h:mm a zzz")
  const isoDate = formatInTimeZone(now, BUSINESS_TIMEZONE, 'yyyy-MM-dd')
  return `The current date and time is ${display}. Use ${isoDate} as today's date when calling checkAvailability.`
}

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
    return `I'm sorry, there are no available slots on ${preferredDay} in the ${preferredPeriod}. Please ask the caller if they'd like to try a different day or time period.`
  }

  const lines = slots.map((slot, i) => {
    const label = i === 0 ? 'Option A' : 'Option B'
    return `${label}: ${slot.display.date} at ${slot.display.time} – ${slot.display.endTime} (${slot.display.timezone}) | slot_start=${slot.start} | slot_end=${slot.end}`
  })

  return [
    `I found ${slots.length} available slot${slots.length > 1 ? 's' : ''}:`,
    ...lines,
    'Present these options to the caller. Once they confirm a specific slot, call bookAppointment with the exact slot_start and slot_end values shown above.',
  ].join('\n')
}

const BOOKING_FALLBACK = "I've captured your details, and our team will confirm the calendar invite shortly."

async function handleBookAppointment(client, args) {
  const { name, businessName, email, phone, slotStart, slotEnd, timezone, notes } = args

  // ── Field validation ────────────────────────────────────────────────────────
  const missing = []
  if (!name)         missing.push('name')
  if (!businessName) missing.push('businessName')
  if (!email)        missing.push('email')
  if (!phone)        missing.push('phone')
  if (!slotStart)    missing.push('slotStart')
  if (!slotEnd)      missing.push('slotEnd')
  if (!timezone)     missing.push('timezone')

  if (missing.length > 0) {
    return `I still need the following details before I can book: ${missing.join(', ')}. Could you gather that from the caller?`
  }

  const start = new Date(slotStart)
  const end   = new Date(slotEnd)

  if (isNaN(start) || isNaN(end)) {
    return 'The slot times provided are not valid. Please use the exact slot_start and slot_end values returned by checkAvailability.'
  }

  // ── Overlap prevention (FR-005) ─────────────────────────────────────────────
  const preferredDay = formatInTimeZone(start, client.timezone, 'yyyy-MM-dd')
  const dayStart = fromZonedTime(`${preferredDay} 00:00:00`, client.timezone)
  const dayEnd   = fromZonedTime(`${preferredDay} 23:59:59`, client.timezone)
  const existingEvents = await listEvents(client.calendar_id, dayStart, dayEnd)

  if (hasConflict(start, end, existingEvents, client.buffers)) {
    await log({ clientId: client.id, type: 'booking_attempt', payload: args, response: { reason: 'TIME_SLOT_UNAVAILABLE' } })
    return 'I\'m sorry, that slot was just taken. Please ask the caller if they\'d like to check availability again for a different time.'
  }

  // ── Create Google Calendar event ────────────────────────────────────────────
  const title = `Discovery Call — ${businessName} + Futura AI Solutions`
  const description = [
    `Caller: ${name}`,
    `Business: ${businessName}`,
    `Email: ${email}`,
    `Phone/WhatsApp: ${phone}`,
    `Timezone: ${timezone}`,
    notes ? `\nContext:\n${notes}` : '',
  ].filter(Boolean).join('\n')

  const attendees = [{ email }]
  if (client.fallback_email) attendees.push({ email: client.fallback_email })

  let googleEvent
  try {
    googleEvent = await createEvent(client.calendar_id, {
      summary: title,
      description,
      start: { dateTime: start.toISOString(), timeZone: client.timezone },
      end:   { dateTime: end.toISOString(),   timeZone: client.timezone },
      attendees,
    })
  } catch (calErr) {
    const errCode = calErr?.response?.status ?? calErr?.code ?? 'unknown'
    console.error('[vapi] GOOGLE_CALENDAR_CREATE_FAILED', { message: calErr.message, code: errCode })
    await log({ clientId: client.id, type: 'error', payload: { tool: 'bookAppointment', step: 'create_event' }, error: calErr })
    return BOOKING_FALLBACK
  }

  // ── Require a real event ID before confirming ───────────────────────────────
  if (!googleEvent?.id) {
    console.error('[vapi] NO_EVENT_ID_RETURNED', googleEvent)
    await log({ clientId: client.id, type: 'error', payload: { tool: 'bookAppointment', step: 'verify_event_id' }, error: 'No event ID returned' })
    return BOOKING_FALLBACK
  }

  console.log('GOOGLE_EVENT_CREATED', {
    id:       googleEvent.id,
    htmlLink: googleEvent.htmlLink,
    start:    googleEvent.start?.dateTime,
    end:      googleEvent.end?.dateTime,
  })

  // ── Persist booking ─────────────────────────────────────────────────────────
  const { data: booking } = await supabase
    .from('bookings')
    .insert({
      client_id:       client.id,
      caller_name:     name,
      business_name:   businessName,
      email,
      phone,
      slot_start:      start.toISOString(),
      slot_end:        end.toISOString(),
      timezone,
      notes:           notes ?? null,
      google_event_id: googleEvent.id,
      status:          'confirmed',
    })
    .select()
    .single()

  await log({
    clientId: client.id,
    type: 'booking_success',
    payload: { name, businessName, email, phone, timezone, slotStart, slotEnd },
    response: { bookingId: booking?.id, googleEventId: googleEvent.id },
  })

  // ── Send WhatsApp confirmation ────────────────────────────────────────────
  const whatsapp = await sendBookingConfirmation({
    name,
    businessName,
    phone,
    start: start.toISOString(),
    timezone,
  })

  await log({
    clientId: client.id,
    type:    whatsapp.sent ? 'whatsapp_sent' : 'whatsapp_failed',
    payload: { phone, name },
    response: whatsapp.sent ? { sid: whatsapp.sid } : null,
    error:   whatsapp.sent ? null : whatsapp.error,
  })

  // ── Notify Futura AI Solutions ────────────────────────────────────────────
  const bizNotif = await sendBusinessNotification({
    name,
    businessName,
    email,
    phone,
    start: start.toISOString(),
    timezone,
    notes: notes ?? null,
    bookingId: booking?.id ?? googleEvent.id,
  })

  await log({
    clientId: client.id,
    type:    bizNotif.sent ? 'whatsapp_business_notified' : 'whatsapp_business_notify_failed',
    payload: { bookingId: booking?.id ?? googleEvent.id },
    response: bizNotif.sent ? { sid: bizNotif.sid } : null,
    error:   bizNotif.sent ? null : bizNotif.error,
  })

  // ── Confirm to caller ─────────────────────────────────────────────────────
  const displayTime = formatInTimeZone(start, timezone, "EEEE, MMMM d 'at' h:mm a zzz")
  return [
    `The appointment has been confirmed.`,
    `${name} is booked for ${displayTime}.`,
    `A calendar invite has been sent to ${email}.`,
    whatsapp.sent ? `A WhatsApp confirmation has also been sent to ${phone}.` : '',
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
        if (name === 'getCurrentTime') {
          result = handleGetCurrentTime()
        } else if (name === 'checkAvailability') {
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
