import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X, Copy } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import Card, { SectionHeading } from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import Input, { Select } from '../components/ui/Input.jsx'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Mexico_City', 'America/Bogota', 'America/Caracas', 'America/Sao_Paulo',
  'Europe/London', 'Europe/Madrid', 'UTC',
]

const DEFAULT_HOURS = Object.fromEntries(
  DAYS.map(d => [d, ['saturday', 'sunday'].includes(d) ? null : { open: '09:00', close: '17:00' }])
)

function emptyClient() {
  return {
    name: '',
    calendar_id: '',
    timezone: 'America/New_York',
    appointment_duration: 30,
    business_hours: DEFAULT_HOURS,
    buffers: { pre: 0, post: 0 },
    fallback_email: '',
    assistant_id: '',
    api_key: `pcg_${crypto.randomUUID().replace(/-/g, '').slice(0, 28)}`,
  }
}

function Modal({ client, onClose, onSave }) {
  const [form, setForm] = useState(client ?? emptyClient())
  const [saving, setSaving] = useState(false)

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function setBuffer(key, val) {
    setForm(f => ({ ...f, buffers: { ...f.buffers, [key]: Number(val) } }))
  }

  function toggleDay(day) {
    setForm(f => ({
      ...f,
      business_hours: {
        ...f.business_hours,
        [day]: f.business_hours[day] ? null : { open: '09:00', close: '17:00' },
      },
    }))
  }

  function setDayTime(day, field, val) {
    setForm(f => ({
      ...f,
      business_hours: {
        ...f.business_hours,
        [day]: { ...f.business_hours[day], [field]: val },
      },
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(11,15,20,0.85)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        width: '100%',
        maxWidth: 680,
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '2rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 400, fontSize: 22, color: 'var(--white)', margin: 0 }}>
            {client ? 'Edit Client' : 'New Client'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--label)' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Input label="Client Name" id="name" value={form.name} onChange={e => setField('name', e.target.value)} required />
            <Input label="Google Calendar ID" id="calendar_id" value={form.calendar_id} onChange={e => setField('calendar_id', e.target.value)} placeholder="primary or email@group.calendar.google.com" required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Select label="Timezone" id="timezone" value={form.timezone} onChange={e => setField('timezone', e.target.value)} required>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </Select>
            <Input label="Appt Duration (min)" id="duration" type="number" value={form.appointment_duration} onChange={e => setField('appointment_duration', Number(e.target.value))} />
            <Input label="Fallback Email" id="fallback_email" type="email" value={form.fallback_email} onChange={e => setField('fallback_email', e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Input label="Pre-Meeting Buffer (min)" id="pre" type="number" value={form.buffers.pre} onChange={e => setBuffer('pre', e.target.value)} />
            <Input label="Post-Meeting Buffer (min)" id="post" type="number" value={form.buffers.post} onChange={e => setBuffer('post', e.target.value)} />
          </div>

          <div>
            <p style={{ fontSize: 12, color: 'var(--label)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Business Hours</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DAYS.map(day => (
                <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', width: 110 }}>
                    <input
                      type="checkbox"
                      checked={!!form.business_hours[day]}
                      onChange={() => toggleDay(day)}
                      style={{ accentColor: 'var(--teal)' }}
                    />
                    <span style={{ fontSize: 13, color: form.business_hours[day] ? 'var(--white)' : 'var(--label)', textTransform: 'capitalize' }}>{day}</span>
                  </label>
                  {form.business_hours[day] && (
                    <>
                      <input type="time" value={form.business_hours[day].open} onChange={e => setDayTime(day, 'open', e.target.value)}
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--white)', fontSize: 13 }} />
                      <span style={{ color: 'var(--label)', fontSize: 13 }}>to</span>
                      <input type="time" value={form.business_hours[day].close} onChange={e => setDayTime(day, 'close', e.target.value)}
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--white)', fontSize: 13 }} />
                    </>
                  )}
                  {!form.business_hours[day] && (
                    <span style={{ fontSize: 12, color: 'var(--label)' }}>Closed</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize: 12, color: 'var(--label)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>API Key</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <code style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 12, color: 'var(--teal)', letterSpacing: '0.05em' }}>
                {form.api_key}
              </code>
              <Button type="button" variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(form.api_key)}>
                <Copy size={13} />
              </Button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Client'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Clients() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'new' | client object

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    setClients(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchClients() }, [])

  async function handleSave(form) {
    const isEdit = !!form.id
    const payload = { ...form }
    delete payload.id
    delete payload.created_at
    delete payload.updated_at

    if (isEdit) {
      await supabase.from('clients').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', form.id)
    } else {
      await supabase.from('clients').insert(payload)
    }
    setModal(null)
    fetchClients()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this client? This cannot be undone.')) return
    await supabase.from('clients').delete().eq('id', id)
    fetchClients()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <SectionHeading sub="Manage calendar integrations and scheduling rules">Clients</SectionHeading>
        <Button onClick={() => setModal('new')} style={{ marginTop: 4 }}>
          <Plus size={15} /> New Client
        </Button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</p>
      ) : clients.length === 0 ? (
        <Card>
          <p style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', padding: '2rem 0' }}>
            No clients yet. Add your first client to get started.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {clients.map(c => (
            <Card key={c.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 400, fontSize: 18, color: 'var(--white)', letterSpacing: '0.02em' }}>
                    {c.name}
                  </p>
                  <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--label)' }}>{c.timezone}</span>
                    <span style={{ fontSize: 12, color: 'var(--label)' }}>{c.appointment_duration} min slots</span>
                    <span style={{ fontSize: 12, color: 'var(--label)' }}>{c.calendar_id}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="ghost" size="sm" onClick={() => setModal(c)}><Pencil size={13} /> Edit</Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(c.id)}><Trash2 size={13} /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <Modal
          client={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
