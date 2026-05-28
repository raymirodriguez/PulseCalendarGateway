import { google } from 'googleapis'

function buildAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set')

  const credentials = JSON.parse(raw)
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })
}

export async function listEvents(calendarId, timeMin, timeMax) {
  const auth = buildAuth()
  const cal = google.calendar({ version: 'v3', auth })

  const res = await cal.events.list({
    calendarId,
    timeMin: timeMin instanceof Date ? timeMin.toISOString() : timeMin,
    timeMax: timeMax instanceof Date ? timeMax.toISOString() : timeMax,
    singleEvents: true,
    orderBy: 'startTime',
  })

  return res.data.items ?? []
}

export async function createEvent(calendarId, eventBody) {
  const auth = buildAuth()
  const cal = google.calendar({ version: 'v3', auth })

  const res = await cal.events.insert({
    calendarId,
    sendUpdates: 'all',
    requestBody: eventBody,
  })

  return res.data
}
