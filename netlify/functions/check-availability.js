import { validateApiKey } from './_utils/auth.js'
import { findAvailableSlots } from './_utils/scheduling-engine.js'
import { listEvents } from './_utils/google-calendar.js'
import { log } from './_utils/logger.js'
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'

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

  const { timezone, preferredDay, preferredPeriod } = body
  if (!timezone || !preferredDay || !preferredPeriod) {
    return json(400, { success: false, reason: 'MISSING_FIELDS', required: ['timezone', 'preferredDay', 'preferredPeriod'] })
  }

  if (!['morning', 'afternoon'].includes(preferredPeriod)) {
    return json(400, { success: false, reason: 'INVALID_PERIOD', message: 'preferredPeriod must be "morning" or "afternoon"' })
  }

  try {
    const dayStart = fromZonedTime(`${preferredDay} 00:00:00`, client.timezone)
    const dayEnd   = fromZonedTime(`${preferredDay} 23:59:59`, client.timezone)

    const existingEvents = await listEvents(client.calendar_id, dayStart, dayEnd)
    const slots = findAvailableSlots(client, existingEvents, preferredDay, preferredPeriod, timezone)

    await log({
      clientId: client.id,
      type: 'availability_check',
      payload: { timezone, preferredDay, preferredPeriod },
      response: { slotsFound: slots.length },
    })

    // Map to the public shape: { start, end, label }
    const availableSlots = slots.map(slot => ({
      start: slot.start,
      end:   slot.end ?? new Date(new Date(slot.start).getTime() + 20 * 60 * 1000).toISOString(),
      label: formatInTimeZone(new Date(slot.start), timezone, "EEEE, MMMM d 'at' h:mm a zzzz"),
    }))

    if (availableSlots.length === 0) {
      return json(200, {
        success:        true,
        availableSlots: [],
        reason:         'NO_AVAILABLE_SLOTS',
      })
    }

    return json(200, { success: true, availableSlots })

  } catch (err) {
    console.error('[check-availability]', err)
    await log({ clientId: client.id, type: 'error', payload: body, error: err })
    return json(500, { success: false, reason: 'INTERNAL_ERROR', message: err.message })
  }
}
