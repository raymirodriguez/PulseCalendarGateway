import twilio from 'twilio'
import { formatInTimeZone } from 'date-fns-tz'

export async function sendBusinessNotification({ name, businessName, email, phone, start, timezone, notes, bookingId }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const from       = process.env.TWILIO_WHATSAPP_FROM
  const to         = 'whatsapp:+523224003407'

  if (!accountSid || !authToken || !from) {
    return { sent: false, error: 'Twilio credentials not configured' }
  }

  const startDate  = new Date(start)
  const localDate  = formatInTimeZone(startDate, timezone, 'EEEE, MMMM d, yyyy')
  const localTime  = formatInTimeZone(startDate, timezone, 'h:mm a zzz')

  const body = [
    '📅 New Discovery Call Booked',
    '',
    '── Prospect ──',
    `Name: ${name}`,
    `Business: ${businessName}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    `Timezone: ${timezone}`,
    notes ? `Notes: ${notes}` : '',
    '',
    '── Appointment ──',
    `Date: ${localDate}`,
    `Time: ${localTime}`,
    '',
    `Booking ID: ${bookingId}`,
  ].filter(line => line !== undefined && line !== null).join('\n')

  try {
    const client = twilio(accountSid, authToken)
    const message = await client.messages.create({ from, to, body })
    console.log('WHATSAPP_BUSINESS_NOTIFIED', { sid: message.sid, to })
    return { sent: true, sid: message.sid }
  } catch (err) {
    console.error('WHATSAPP_BUSINESS_NOTIFY_FAILED', { error: err.message })
    return { sent: false, error: err.message }
  }
}

export async function sendBookingConfirmation({ name, businessName, phone, start, timezone }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const from       = process.env.TWILIO_WHATSAPP_FROM

  if (!accountSid || !authToken || !from) {
    return { sent: false, error: 'Twilio credentials not configured' }
  }

  const startDate = new Date(start)
  const localDate = formatInTimeZone(startDate, timezone, 'EEEE, MMMM d, yyyy')
  const localTime = formatInTimeZone(startDate, timezone, 'h:mm a zzz')

  const body = [
    '✅ Discovery Call Confirmed',
    '',
    `Hello ${name},`,
    '',
    'Your discovery call with Futura AI Solutions has been booked.',
    '',
    `Date: ${localDate}`,
    `Time: ${localTime}`,
    `Timezone: ${timezone}`,
    '',
    `Business: ${businessName}`,
    '',
    'We look forward to speaking with you.',
  ].join('\n')

  // Normalize phone to digits only, then prepend whatsapp:+
  const digits = phone.replace(/\D/g, '')
  const to = `whatsapp:+${digits}`

  try {
    const client = twilio(accountSid, authToken)
    const message = await client.messages.create({ from, to, body })
    console.log('WHATSAPP_SENT', { sid: message.sid, to })
    return { sent: true, sid: message.sid }
  } catch (err) {
    console.error('WHATSAPP_FAILED', { to, error: err.message })
    return { sent: false, error: err.message }
  }
}
