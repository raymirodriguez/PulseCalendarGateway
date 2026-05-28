import { validateApiKey } from './_utils/auth.js'
import { hasConflict } from './_utils/scheduling-engine.js'
import { listEvents, createEvent } from './_utils/google-calendar.js'
import { log } from './_utils/logger.js'
import { createClient } from '@supabase/supabase-js'
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function json(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) }
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { success: false, reason: 'METHOD_NOT_ALLOWED' })

  let body
  try { body = JSON.parse(event.body) }
  catch { return json(400, { success: false, reason: 'INVALID_JSON' }) }

  const client = await validateApiKey(event.headers)
  if (!client) return json(401, { success: false, reason: 'UNAUTHORIZED' })

  const { name, businessName, email, phone, slot, timezone, notes } = body
  if (!name || !slot?.start || !slot?.end || !timezone) {
    return json(400, { success: false, reason: 'MISSING_FIELDS', required: ['name', 'slot.start', 'slot.end', 'timezone'] })
  }

  const slotStart = new Date(slot.start)
  const slotEnd = new Date(slot.end)
  if (isNaN(slotStart) || isNaN(slotEnd)) {
    return json(400, { success: false, reason: 'INVALID_SLOT', message: 'slot.start and slot.end must be valid ISO strings' })
  }

  try {
    // Re-check availability before booking (FR-005 overlap prevention)
    const preferredDay = formatInTimeZone(slotStart, client.timezone, 'yyyy-MM-dd')
    const dayStart = fromZonedTime(`${preferredDay} 00:00:00`, client.timezone)
    const dayEnd = fromZonedTime(`${preferredDay} 23:59:59`, client.timezone)

    const existingEvents = await listEvents(client.calendar_id, dayStart, dayEnd)
    if (hasConflict(slotStart, slotEnd, existingEvents, client.buffers)) {
      await log({ clientId: client.id, type: 'booking_attempt', payload: body, response: { reason: 'TIME_SLOT_UNAVAILABLE' } })
      return json(409, { success: false, reason: 'TIME_SLOT_UNAVAILABLE' })
    }

    // Build calendar event
    const title = `Discovery Call — ${businessName || name} + Futura AI Solutions`
    const description = [
      `Caller: ${name}`,
      businessName ? `Business: ${businessName}` : '',
      email ? `Email: ${email}` : '',
      phone ? `Phone/WhatsApp: ${phone}` : '',
      `Timezone: ${timezone}`,
      notes ? `\nContext:\n${notes}` : '',
    ].filter(Boolean).join('\n')

    const attendees = []
    if (email) attendees.push({ email })
    if (client.fallback_email) attendees.push({ email: client.fallback_email })

    const googleEvent = await createEvent(client.calendar_id, {
      summary: title,
      description,
      start: { dateTime: slotStart.toISOString(), timeZone: client.timezone },
      end: { dateTime: slotEnd.toISOString(), timeZone: client.timezone },
      attendees,
    })

    // Persist booking
    const { data: booking } = await supabase
      .from('bookings')
      .insert({
        client_id: client.id,
        caller_name: name,
        business_name: businessName ?? null,
        email: email ?? null,
        phone: phone ?? null,
        slot_start: slotStart.toISOString(),
        slot_end: slotEnd.toISOString(),
        timezone,
        notes: notes ?? null,
        google_event_id: googleEvent.id,
        status: 'confirmed',
      })
      .select()
      .single()

    await log({
      clientId: client.id,
      type: 'booking_success',
      payload: body,
      response: { bookingId: booking?.id, googleEventId: googleEvent.id },
    })

    return json(200, {
      success: true,
      bookingId: booking?.id,
      googleEventId: googleEvent.id,
      slot: {
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        display: formatInTimeZone(slotStart, timezone, "EEEE, MMMM d, yyyy 'at' h:mm a zzz"),
      },
    })
  } catch (err) {
    console.error('[book-appointment]', err)
    await log({ clientId: client.id, type: 'error', payload: body, error: err })
    return json(500, { success: false, reason: 'INTERNAL_ERROR', message: err.message })
  }
}
