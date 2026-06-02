import { validateApiKey } from './_utils/auth.js'
import { hasConflict } from './_utils/scheduling-engine.js'
import { listEvents, createEvent } from './_utils/google-calendar.js'
import { log } from './_utils/logger.js'
import { normalizeSlot } from './_utils/normalize-slot.js'
import { sendBookingConfirmation, sendBusinessNotification } from './_utils/whatsapp.js'
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

  const { name, businessName, email, phone, timezone, notes } = body

  // ── 1. Structured request log ────────────────────────────────────────────────
  console.log('BOOK_APPOINTMENT_INPUT', {
    name:         body.name,
    businessName: body.businessName,
    email:        body.email,
    phone:        body.phone,
    timezone:     body.timezone,
    slot:         body.slot,
    hasNotes:     Boolean(body.notes),
  })

  // ── 2. Normalize slot (auto-calculate end if missing) ────────────────────────
  const { slot: normalizedSlot, error: slotError } = normalizeSlot(body.slot)
  if (slotError) {
    return json(400, { success: false, reason: slotError.reason, message: slotError.message })
  }
  const slot = normalizedSlot

  console.log('BOOK_APPOINTMENT_NORMALIZED_SLOT', slot)

  // ── 3. Required-field validation ─────────────────────────────────────────────
  const missing = []
  if (!name)            missing.push('name')
  if (!businessName)    missing.push('businessName')
  if (!email)           missing.push('email')
  if (!phone)           missing.push('phone')
  if (!timezone)        missing.push('timezone')
  if (!slot?.start)     missing.push('slot.start')
  if (!slot?.end)       missing.push('slot.end')

  if (missing.length > 0) {
    console.warn('[book-appointment] MISSING_REQUIRED_FIELDS', missing)
    return json(400, { success: false, reason: 'MISSING_REQUIRED_FIELDS', missingFields: missing })
  }

  const slotStart = new Date(slot.start)
  const slotEnd   = new Date(slot.end)
  if (isNaN(slotStart) || isNaN(slotEnd)) {
    return json(400, { success: false, reason: 'INVALID_SLOT', message: 'slot.start and slot.end must be valid ISO strings' })
  }

  try {
    // ── Overlap prevention (FR-005) ──────────────────────────────────────────
    const preferredDay = formatInTimeZone(slotStart, client.timezone, 'yyyy-MM-dd')
    const dayStart = fromZonedTime(`${preferredDay} 00:00:00`, client.timezone)
    const dayEnd   = fromZonedTime(`${preferredDay} 23:59:59`, client.timezone)

    const existingEvents = await listEvents(client.calendar_id, dayStart, dayEnd)
    if (hasConflict(slotStart, slotEnd, existingEvents, client.buffers)) {
      await log({ clientId: client.id, type: 'booking_attempt', payload: body, response: { reason: 'TIME_SLOT_UNAVAILABLE' } })
      return json(409, { success: false, reason: 'TIME_SLOT_UNAVAILABLE' })
    }

    // ── Build and create Google Calendar event ───────────────────────────────
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
        start: { dateTime: slotStart.toISOString(), timeZone: client.timezone },
        end:   { dateTime: slotEnd.toISOString(),   timeZone: client.timezone },
        attendees,
      })
    } catch (calErr) {
      // ── 5. Catch Google Calendar errors with full detail ─────────────────
      const errCode = calErr?.response?.status ?? calErr?.code ?? 'unknown'
      const errBody = calErr?.response?.data   ?? null
      console.error('[book-appointment] GOOGLE_CALENDAR_ERROR', {
        message: calErr.message,
        code:    errCode,
        body:    errBody,
      })
      await log({
        clientId: client.id,
        type: 'error',
        payload: { step: 'create_event', slot: { start: slotStart.toISOString(), end: slotEnd.toISOString() } },
        error: calErr,
      })
      return json(500, {
        success: false,
        reason:  'GOOGLE_CALENDAR_CREATE_FAILED',
        message: calErr.message,
      })
    }

    // ── 3 & 4. Verify Google returned a real event ID ────────────────────────
    if (!googleEvent?.id) {
      console.error('[book-appointment] NO_EVENT_ID_RETURNED', googleEvent)
      await log({
        clientId: client.id,
        type: 'error',
        payload: { step: 'verify_event_id' },
        error: 'Google Calendar did not return an event ID',
      })
      return json(500, { success: false, reason: 'NO_EVENT_ID_RETURNED' })
    }

    console.log('GOOGLE_EVENT_CREATED', {
      id:       googleEvent?.id,
      htmlLink: googleEvent?.htmlLink,
      start:    googleEvent?.start,
      end:      googleEvent?.end,
    })

    // ── Persist booking to Supabase ──────────────────────────────────────────
    const { data: booking } = await supabase
      .from('bookings')
      .insert({
        client_id:       client.id,
        caller_name:     name,
        business_name:   businessName,
        email,
        phone,
        slot_start:      slotStart.toISOString(),
        slot_end:        slotEnd.toISOString(),
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
      payload: { name, businessName, email, phone, timezone, slot },
      response: { bookingId: booking?.id, googleEventId: googleEvent.id },
    })

    // ── Send WhatsApp confirmation ────────────────────────────────────────────
    const whatsapp = await sendBookingConfirmation({
      name,
      businessName,
      phone,
      start: slotStart.toISOString(),
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
      start: slotStart.toISOString(),
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

    return json(200, {
      success:      true,
      eventId:      googleEvent.id,
      htmlLink:     googleEvent.htmlLink ?? null,
      bookingId:    booking?.id ?? null,
      start:        googleEvent.start?.dateTime ?? slotStart.toISOString(),
      end:          googleEvent.end?.dateTime   ?? slotEnd.toISOString(),
      whatsappSent: whatsapp.sent,
      ...(whatsapp.sent ? {} : { whatsappError: whatsapp.error }),
    })

  } catch (err) {
    console.error('[book-appointment] UNHANDLED_ERROR', err)
    await log({ clientId: client.id, type: 'error', payload: body, error: err })
    return json(500, { success: false, reason: 'INTERNAL_ERROR', message: err.message })
  }
}
