import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

// Parse "HH:MM" on a given YYYY-MM-DD date string in a specific timezone → UTC Date
function parseTimeInTz(timeStr, dateStr, timezone) {
  return fromZonedTime(`${dateStr} ${timeStr}:00`, timezone)
}

// Returns the day-of-week name for a given 'YYYY-MM-DD' date string in a timezone
function getDayName(dateStr, timezone) {
  // Use formatInTimeZone to get the correct day in the target timezone
  const utcDate = new Date(`${dateStr}T12:00:00Z`) // noon UTC to avoid edge cases
  const dayNum = parseInt(formatInTimeZone(utcDate, timezone, 'i'), 10) % 7 // 1=Mon…7=Sun → 0=Sun…6=Sat
  // date-fns-tz 'i' returns ISO day (1=Mon, 7=Sun); convert to JS day (0=Sun)
  const jsDay = parseInt(formatInTimeZone(utcDate, timezone, 'e'), 10) - 1
  return DAY_NAMES[jsDay]
}

export function hasConflict(slotStart, slotEnd, existingEvents, buffers = {}) {
  const preMs = (buffers.pre ?? 0) * 60_000
  const postMs = (buffers.post ?? 0) * 60_000

  const checkStart = new Date(slotStart.getTime() - preMs)
  const checkEnd = new Date(slotEnd.getTime() + postMs)

  for (const ev of existingEvents) {
    if (ev.status === 'cancelled') continue
    const evStart = new Date(ev.start.dateTime ?? ev.start.date)
    const evEnd = new Date(ev.end.dateTime ?? ev.end.date)
    // Expand event by buffers too
    const evCheckStart = new Date(evStart.getTime() - preMs)
    const evCheckEnd = new Date(evEnd.getTime() + postMs)

    if (checkStart < evCheckEnd && checkEnd > evCheckStart) return true
  }
  return false
}

export function findAvailableSlots(config, existingEvents, preferredDay, period, callerTimezone) {
  const { timezone: clientTz, appointment_duration: duration = 30, buffers = { pre: 0, post: 0 }, business_hours: businessHours } = config

  const dayName = getDayName(preferredDay, clientTz)
  const dayConfig = businessHours?.[dayName]
  if (!dayConfig?.open || !dayConfig?.close) return []

  const openUtc = parseTimeInTz(dayConfig.open, preferredDay, clientTz)
  const closeUtc = parseTimeInTz(dayConfig.close, preferredDay, clientTz)
  const noonUtc = parseTimeInTz('12:00', preferredDay, clientTz)

  let periodStart, periodEnd
  if (period === 'morning') {
    periodStart = openUtc
    periodEnd = noonUtc < closeUtc ? noonUtc : closeUtc
  } else {
    periodStart = noonUtc > openUtc ? noonUtc : openUtc
    periodEnd = closeUtc
  }

  const stepMs = (duration + (buffers.post ?? 0)) * 60_000
  const durationMs = duration * 60_000
  const now = new Date()
  const slots = []
  let current = new Date(periodStart)

  while (current < periodEnd && slots.length < 2) {
    const slotEnd = new Date(current.getTime() + durationMs)
    if (slotEnd > periodEnd) break

    if (current > now && !hasConflict(current, slotEnd, existingEvents, buffers)) {
      slots.push({
        start: current.toISOString(),
        end: slotEnd.toISOString(),
        display: {
          date: formatInTimeZone(current, callerTimezone, 'EEEE, MMMM d, yyyy'),
          time: formatInTimeZone(current, callerTimezone, 'h:mm a'),
          endTime: formatInTimeZone(slotEnd, callerTimezone, 'h:mm a'),
          timezone: callerTimezone,
          clientTime: formatInTimeZone(current, clientTz, 'h:mm a zzz'),
        },
      })
    }

    current = new Date(current.getTime() + stepMs)
  }

  return slots
}
