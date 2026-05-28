import { useEffect, useState } from 'react'
import { Send, Calendar, BookCheck } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import Card, { SectionHeading } from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import Input, { Select, Textarea } from '../components/ui/Input.jsx'

function RawResponse({ data, label }) {
  if (!data) return null
  const isSuccess = data?.success === true

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: isSuccess ? 'var(--teal)' : 'var(--error)',
          boxShadow: `0 0 8px ${isSuccess ? 'var(--teal)' : 'var(--error)'}`,
        }} />
        <span style={{ fontSize: 12, color: 'var(--label)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <pre style={{
        background: 'var(--bg)',
        border: `1px solid ${isSuccess ? 'rgba(25,211,197,0.2)' : 'rgba(248,113,113,0.2)'}`,
        borderRadius: 8,
        padding: '1rem',
        fontSize: 12,
        color: isSuccess ? 'var(--teal-light)' : 'var(--error)',
        overflowX: 'auto',
        fontFamily: 'monospace',
        margin: 0,
        lineHeight: 1.6,
      }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}

export default function TestBooking() {
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState('')
  const [apiKey, setApiKey] = useState('')

  // Availability form
  const [avail, setAvail] = useState({ timezone: 'America/New_York', preferredDay: '', preferredPeriod: 'morning' })
  const [availResult, setAvailResult] = useState(null)
  const [availLoading, setAvailLoading] = useState(false)

  // Booking form
  const [book, setBook] = useState({ name: '', businessName: '', email: '', phone: '', timezone: 'America/New_York', notes: '', slot: null })
  const [bookResult, setBookResult] = useState(null)
  const [bookLoading, setBookLoading] = useState(false)

  useEffect(() => {
    supabase.from('clients').select('id, name, api_key').order('name').then(({ data }) => setClients(data ?? []))
  }, [])

  useEffect(() => {
    const c = clients.find(c => c.id === selectedClient)
    setApiKey(c?.api_key ?? '')
  }, [selectedClient, clients])

  async function checkAvailability(e) {
    e.preventDefault()
    setAvailLoading(true)
    setAvailResult(null)
    try {
      const res = await fetch('/api/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify(avail),
      })
      setAvailResult(await res.json())
    } catch (err) {
      setAvailResult({ success: false, reason: 'FETCH_ERROR', message: err.message })
    }
    setAvailLoading(false)
  }

  async function bookAppointment(e) {
    e.preventDefault()
    setBookLoading(true)
    setBookResult(null)
    try {
      const payload = { ...book }
      if (!payload.slot?.start) delete payload.slot
      const res = await fetch('/api/book-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify(payload),
      })
      setBookResult(await res.json())
    } catch (err) {
      setBookResult({ success: false, reason: 'FETCH_ERROR', message: err.message })
    }
    setBookLoading(false)
  }

  function useSlot(slot) {
    setBook(b => ({ ...b, slot: { start: slot.start, end: slot.end }, timezone: avail.timezone }))
  }

  return (
    <div>
      <SectionHeading sub="Run live API calls against real client configurations">Test Booking</SectionHeading>

      <Card style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, color: 'var(--label)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Client & API Key</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
          <Select id="client" value={selectedClient} onChange={e => setSelectedClient(e.target.value)}>
            <option value="">— Select client —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <div style={{ display: 'flex', gap: 8 }}>
            <code style={{
              flex: 1,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '9px 14px',
              fontSize: 12,
              color: apiKey ? 'var(--teal)' : 'var(--label)',
              letterSpacing: '0.04em',
            }}>
              {apiKey || 'select a client to load API key'}
            </code>
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Check Availability */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
            <Calendar size={16} color="var(--teal)" />
            <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 400, fontSize: 18, color: 'var(--white)', margin: 0 }}>
              Check Availability
            </h3>
          </div>
          <p style={{ fontSize: 11, color: 'var(--label)', margin: '0 0 14px', fontFamily: 'monospace' }}>POST /api/check-availability</p>

          <form onSubmit={checkAvailability} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label="Preferred Day" id="av-day" type="date" value={avail.preferredDay}
              onChange={e => setAvail(a => ({ ...a, preferredDay: e.target.value }))} required />
            <Select label="Period" id="av-period" value={avail.preferredPeriod}
              onChange={e => setAvail(a => ({ ...a, preferredPeriod: e.target.value }))}>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
            </Select>
            <Input label="Caller Timezone" id="av-tz" value={avail.timezone}
              onChange={e => setAvail(a => ({ ...a, timezone: e.target.value }))} placeholder="America/New_York" />
            <Button type="submit" disabled={!apiKey || availLoading} style={{ alignSelf: 'flex-start' }}>
              <Send size={13} />{availLoading ? 'Checking…' : 'Check Availability'}
            </Button>
          </form>

          <RawResponse data={availResult} label="Response" />

          {availResult?.success && availResult.slots?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 12, color: 'var(--label)', margin: '0 0 8px' }}>Use a slot in the booking form:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {availResult.slots.map((slot, i) => (
                  <button key={i} onClick={() => useSlot(slot)} style={{
                    background: 'var(--teal-dim)',
                    border: '1px solid rgba(25,211,197,0.2)',
                    borderRadius: 8,
                    padding: '8px 14px',
                    color: 'var(--teal-light)',
                    fontSize: 13,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}>
                    Slot {i + 1}: {slot.display.date} — {slot.display.time} → {slot.display.endTime}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Book Appointment */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
            <BookCheck size={16} color="var(--teal)" />
            <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 400, fontSize: 18, color: 'var(--white)', margin: 0 }}>
              Book Appointment
            </h3>
          </div>
          <p style={{ fontSize: 11, color: 'var(--label)', margin: '0 0 14px', fontFamily: 'monospace' }}>POST /api/book-appointment</p>

          <form onSubmit={bookAppointment} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Caller Name" id="bk-name" value={book.name} onChange={e => setBook(b => ({ ...b, name: e.target.value }))} required />
              <Input label="Business Name" id="bk-biz" value={book.businessName} onChange={e => setBook(b => ({ ...b, businessName: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Email" id="bk-email" type="email" value={book.email} onChange={e => setBook(b => ({ ...b, email: e.target.value }))} />
              <Input label="Phone / WhatsApp" id="bk-phone" value={book.phone} onChange={e => setBook(b => ({ ...b, phone: e.target.value }))} />
            </div>
            <Input label="Caller Timezone" id="bk-tz" value={book.timezone} onChange={e => setBook(b => ({ ...b, timezone: e.target.value }))} />

            {book.slot?.start ? (
              <div style={{ background: 'var(--teal-dim)', border: '1px solid rgba(25,211,197,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--teal)' }}>
                  Slot: {new Date(book.slot.start).toLocaleString()} → {new Date(book.slot.end).toLocaleString()}
                </p>
                <button onClick={() => setBook(b => ({ ...b, slot: null }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--label)', fontSize: 11, marginTop: 4, padding: 0 }}>
                  Clear slot
                </button>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 12, color: 'var(--label)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Slot Start (ISO)</p>
                <Input id="bk-slot-start" placeholder="2024-12-15T10:00:00.000Z" value={book.slot?.start ?? ''}
                  onChange={e => setBook(b => ({ ...b, slot: { start: e.target.value, end: b.slot?.end ?? '' } }))} />
                <Input id="bk-slot-end" placeholder="2024-12-15T10:30:00.000Z" value={book.slot?.end ?? ''}
                  style={{ marginTop: 8 }}
                  onChange={e => setBook(b => ({ ...b, slot: { start: b.slot?.start ?? '', end: e.target.value } }))} />
              </div>
            )}

            <Textarea label="Notes / Context" id="bk-notes" value={book.notes} onChange={e => setBook(b => ({ ...b, notes: e.target.value }))} rows={3} placeholder="Conversation context from AI receptionist…" />

            <Button type="submit" disabled={!apiKey || bookLoading} style={{ alignSelf: 'flex-start' }}>
              <Send size={13} />{bookLoading ? 'Booking…' : 'Book Appointment'}
            </Button>
          </form>

          <RawResponse data={bookResult} label="Response" />
        </Card>
      </div>
    </div>
  )
}
