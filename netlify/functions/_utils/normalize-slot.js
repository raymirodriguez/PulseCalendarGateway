const DEFAULT_DURATION_MS = 20 * 60 * 1000 // 20 minutes

/**
 * Normalizes a slot object.
 * If slot.start is present but slot.end is missing, calculates end = start + 20 min.
 * Returns { slot, error } — error is non-null when slot.start is present but invalid.
 */
export function normalizeSlot(slot, durationMs = DEFAULT_DURATION_MS) {
  if (!slot?.start || slot.end) {
    return { slot: slot ?? {}, error: null }
  }

  const startDate = new Date(slot.start)
  if (Number.isNaN(startDate.getTime())) {
    return {
      slot,
      error: { reason: 'INVALID_SLOT_START', message: 'slot.start is not a valid date.' },
    }
  }

  return {
    slot: { ...slot, end: new Date(startDate.getTime() + durationMs).toISOString() },
    error: null,
  }
}
