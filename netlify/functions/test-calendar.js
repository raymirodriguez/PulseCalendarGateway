import { createEvent, listEvents } from './_utils/google-calendar.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function json(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body, null, 2) }
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { success: false, reason: 'METHOD_NOT_ALLOWED' })

  // Protect with the admin key so this isn't publicly callable
  const adminKey = process.env.PCG_ADMIN_KEY
  if (adminKey && event.headers['x-api-key'] !== adminKey) {
    return json(401, { success: false, reason: 'UNAUTHORIZED' })
  }

  let body = {}
  try { body = JSON.parse(event.body || '{}') } catch { /* use defaults */ }

  const calendarId = body.calendarId || 'info@futura-ai.solutions'
  const attendeeEmail = body.attendeeEmail || null

  const now = new Date()
  const start = new Date(now.getTime() + 60 * 60 * 1000)   // 1 hour from now
  const end = new Date(start.getTime() + 30 * 60 * 1000)   // 30 min duration

  const steps = []

  // ── Step 1: list events (verifies read access) ─────────────────────────────
  try {
    const events = await listEvents(
      calendarId,
      new Date(now.getTime() - 60 * 60 * 1000),
      new Date(now.getTime() + 24 * 60 * 60 * 1000)
    )
    steps.push({ step: 'list_events', success: true, count: events.length })
  } catch (err) {
    steps.push({ step: 'list_events', success: false, error: err.message })
    return json(500, { success: false, steps, diagnosis: diagnose(err.message) })
  }

  // ── Step 2: create a test event ────────────────────────────────────────────
  const eventBody = {
    summary: '[PCG Test] Calendar Integration Check',
    description: 'Automated test event created by Pulse Calendar Gateway to verify Domain-Wide Delegation and attendee invite flow.',
    start: { dateTime: start.toISOString(), timeZone: 'America/New_York' },
    end: { dateTime: end.toISOString(), timeZone: 'America/New_York' },
    ...(attendeeEmail ? { attendees: [{ email: attendeeEmail }] } : {}),
  }

  let createdEvent
  try {
    createdEvent = await createEvent(calendarId, eventBody)
    steps.push({
      step: 'create_event',
      success: true,
      eventId: createdEvent.id,
      htmlLink: createdEvent.htmlLink,
      attendeeInviteSent: !!attendeeEmail,
    })
  } catch (err) {
    steps.push({ step: 'create_event', success: false, error: err.message })
    return json(500, { success: false, steps, diagnosis: diagnose(err.message) })
  }

  return json(200, {
    success: true,
    message: attendeeEmail
      ? `Test event created and invite sent to ${attendeeEmail}`
      : 'Test event created (no attendee specified)',
    steps,
    event: {
      id: createdEvent.id,
      link: createdEvent.htmlLink,
      start: start.toISOString(),
      end: end.toISOString(),
    },
  })
}

function diagnose(message) {
  if (message.includes('Domain-Wide Delegation') || message.includes('unauthorized_client')) {
    return 'Domain-Wide Delegation is not configured. In Google Admin Console go to Security → API Controls → Domain-wide delegation → Add new, enter the service account Client ID, and add scope: https://www.googleapis.com/auth/calendar'
  }
  if (message.includes('invalid JSON')) {
    return 'Check that GOOGLE_SERVICE_ACCOUNT_JSON is a valid single-line JSON string in Netlify environment variables'
  }
  if (message.includes('client_email') || message.includes('private_key')) {
    return 'The service account JSON is incomplete. Re-download the key from Google Cloud Console'
  }
  if (message.includes('not set')) {
    return 'GOOGLE_SERVICE_ACCOUNT_JSON environment variable is missing from Netlify'
  }
  return 'Unexpected error — check function logs in Netlify dashboard'
}
