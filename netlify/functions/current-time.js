import { formatInTimeZone } from 'date-fns-tz'

const TIMEZONE = 'America/Mexico_City'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
}

function json(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) }
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'GET') return json(405, { success: false, reason: 'METHOD_NOT_ALLOWED' })

  const now = new Date()

  return json(200, {
    success:   true,
    utc:       now.toISOString(),
    timezone:  TIMEZONE,
    datetime:  formatInTimeZone(now, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssxxx"),
    date:      formatInTimeZone(now, TIMEZONE, 'yyyy-MM-dd'),
    time:      formatInTimeZone(now, TIMEZONE, 'HH:mm:ss'),
    display:   formatInTimeZone(now, TIMEZONE, "EEEE, MMMM d, yyyy 'at' h:mm a zzz"),
  })
}
