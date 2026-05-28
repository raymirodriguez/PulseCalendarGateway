import { google } from 'googleapis'

const IMPERSONATE_USER = 'info@futura-ai.solutions'
const SCOPES = ['https://www.googleapis.com/auth/calendar']

function buildAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set')
  }

  let credentials
  try {
    credentials = JSON.parse(raw)
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON contains invalid JSON')
  }

  if (!credentials.client_email) {
    throw new Error('Service account JSON is missing required field: client_email')
  }
  if (!credentials.private_key) {
    throw new Error('Service account JSON is missing required field: private_key')
  }

  // JWT with subject impersonation — requires Domain-Wide Delegation enabled in
  // Google Admin Console for this service account's OAuth Client ID with scope:
  // https://www.googleapis.com/auth/calendar
  return new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: SCOPES,
    subject: IMPERSONATE_USER,
  })
}

function isPermissionError(err) {
  const status = err?.response?.status ?? err?.code
  const message = err?.message ?? ''
  return (
    status === 403 ||
    message.includes('Domain-Wide Delegation') ||
    message.includes('unauthorized_client') ||
    message.includes('access_denied') ||
    message.includes('insufficientPermissions')
  )
}

export async function listEvents(calendarId, timeMin, timeMax) {
  const auth = buildAuth()
  const cal = google.calendar({ version: 'v3', auth })

  try {
    const res = await cal.events.list({
      calendarId,
      timeMin: timeMin instanceof Date ? timeMin.toISOString() : timeMin,
      timeMax: timeMax instanceof Date ? timeMax.toISOString() : timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    })
    return res.data.items ?? []
  } catch (err) {
    if (isPermissionError(err)) {
      throw new Error(
        `Google Calendar permission denied for ${IMPERSONATE_USER}. ` +
        `Ensure Domain-Wide Delegation is enabled in Google Admin Console for ` +
        `service account client ID with scope: ${SCOPES[0]}. ` +
        `Original error: ${err.message}`
      )
    }
    throw err
  }
}

export async function createEvent(calendarId, eventBody) {
  const auth = buildAuth()
  const cal = google.calendar({ version: 'v3', auth })

  try {
    const res = await cal.events.insert({
      calendarId,
      sendUpdates: 'all',
      requestBody: eventBody,
    })
    return res.data
  } catch (err) {
    if (isPermissionError(err)) {
      throw new Error(
        `Google Calendar permission denied when creating event as ${IMPERSONATE_USER}. ` +
        `Ensure Domain-Wide Delegation is enabled in Google Admin Console for ` +
        `service account client ID with scope: ${SCOPES[0]}. ` +
        `Original error: ${err.message}`
      )
    }
    throw err
  }
}
