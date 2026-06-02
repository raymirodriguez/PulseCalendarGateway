import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSlot } from '../_utils/normalize-slot.js'

const TWENTY_MIN_MS = 20 * 60 * 1000

// A: slot.start + slot.end present → no normalization
test('A: passes through slot unchanged when both start and end are present', () => {
  const slot = { start: '2024-06-04T19:00:00.000Z', end: '2024-06-04T19:20:00.000Z' }
  const { slot: result, error } = normalizeSlot(slot)
  assert.deepEqual(result, slot)
  assert.equal(error, null)
})

// B: only slot.start → calculates slot.end as start + 20 min
test('B: calculates slot.end as start + 20 minutes when end is missing', () => {
  const start = '2024-06-04T19:00:00.000Z'
  const { slot: result, error } = normalizeSlot({ start })
  assert.equal(error, null)
  assert.equal(result.start, start)
  const expectedEnd = new Date(new Date(start).getTime() + TWENTY_MIN_MS).toISOString()
  assert.equal(result.end, expectedEnd)
})

// B2: offset datetime (the actual VAPI case: Pedro Perez)
test('B2: normalizes slot with UTC-offset start (VAPI format)', () => {
  const start = '2024-06-04T14:00:00-05:00'
  const { slot: result, error } = normalizeSlot({ start })
  assert.equal(error, null)
  const expectedEnd = new Date(new Date(start).getTime() + TWENTY_MIN_MS).toISOString()
  assert.equal(result.end, expectedEnd)
})

// C: invalid slot.start → INVALID_SLOT_START error
test('C: returns INVALID_SLOT_START error for unparseable start', () => {
  const { slot: result, error } = normalizeSlot({ start: 'not-a-date' })
  assert.ok(error)
  assert.equal(error.reason, 'INVALID_SLOT_START')
  assert.equal(result.start, 'not-a-date')
})

// D: missing slot.start → returns slot unchanged, no error
test('D: returns slot unchanged when slot.start is missing', () => {
  const slot = { notes: 'something' }
  const { slot: result, error } = normalizeSlot(slot)
  assert.deepEqual(result, slot)
  assert.equal(error, null)
})

// D2: null/undefined slot → returns empty object, no error
test('D2: handles null slot gracefully', () => {
  const { slot: result, error } = normalizeSlot(null)
  assert.deepEqual(result, {})
  assert.equal(error, null)
})

// E: empty notes field → normalizeSlot unaffected, end still calculated
test('E: empty notes field does not affect slot normalization', () => {
  const start = '2024-06-04T19:00:00.000Z'
  const { slot: result, error } = normalizeSlot({ start, notes: '' })
  assert.equal(error, null)
  const expectedEnd = new Date(new Date(start).getTime() + TWENTY_MIN_MS).toISOString()
  assert.equal(result.end, expectedEnd)
})

// F: custom duration
test('F: respects custom durationMs parameter', () => {
  const start = '2024-06-04T19:00:00.000Z'
  const thirtyMin = 30 * 60 * 1000
  const { slot: result, error } = normalizeSlot({ start }, thirtyMin)
  assert.equal(error, null)
  const expectedEnd = new Date(new Date(start).getTime() + thirtyMin).toISOString()
  assert.equal(result.end, expectedEnd)
})
