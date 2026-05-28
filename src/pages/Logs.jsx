import { useEffect, useState } from 'react'
import { RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import Card, { SectionHeading } from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'
import { Select } from '../components/ui/Input.jsx'

const TYPE_STYLES = {
  availability_check: { bg: 'rgba(25,211,197,0.08)', color: 'var(--teal)', label: 'Availability Check' },
  booking_attempt: { bg: 'rgba(147,164,183,0.08)', color: 'var(--muted)', label: 'Booking Attempt' },
  booking_success: { bg: 'rgba(25,211,197,0.08)', color: 'var(--teal)', label: 'Booking Success' },
  error: { bg: 'rgba(248,113,113,0.08)', color: 'var(--error)', label: 'Error' },
}

function TypeBadge({ type }) {
  const s = TYPE_STYLES[type] ?? { bg: 'rgba(147,164,183,0.1)', color: 'var(--muted)', label: type }
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 400, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

function LogRow({ log }) {
  const [open, setOpen] = useState(false)
  const ts = new Date(log.created_at)

  return (
    <>
      <tr style={{ cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <td style={TD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {open ? <ChevronDown size={12} color="var(--label)" /> : <ChevronRight size={12} color="var(--label)" />}
            <TypeBadge type={log.type} />
          </div>
        </td>
        <td style={TD}><span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--muted)' }}>{log.client_id?.slice(0, 8) ?? '—'}</span></td>
        <td style={TD}><span style={{ fontSize: 12, color: 'var(--muted)' }}>{ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></td>
        <td style={TD}><span style={{ fontSize: 12, color: 'var(--muted)' }}>{ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></td>
        <td style={TD}>
          {log.error && <span style={{ fontSize: 12, color: 'var(--error)' }}>{log.error}</span>}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} style={{ padding: '0 0 12px', background: 'var(--bg)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '12px 16px', background: 'var(--bg)', borderRadius: 8, margin: '0 0 4px' }}>
              {log.payload && (
                <div>
                  <p style={{ fontSize: 11, color: 'var(--label)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>Request Payload</p>
                  <pre style={{ margin: 0, fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace', lineHeight: 1.5, overflowX: 'auto' }}>
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                </div>
              )}
              {log.response && (
                <div>
                  <p style={{ fontSize: 11, color: 'var(--label)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>Response</p>
                  <pre style={{ margin: 0, fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace', lineHeight: 1.5, overflowX: 'auto' }}>
                    {JSON.stringify(log.response, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

const TD = {
  padding: '11px 12px 11px 0',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'middle',
}

const TH = {
  textAlign: 'left',
  padding: '0 12px 12px 0',
  color: 'var(--label)',
  fontWeight: 400,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderBottom: '1px solid var(--border)',
}

const PAGE_SIZE = 25

export default function Logs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  async function fetchLogs() {
    setLoading(true)
    let q = supabase
      .from('logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (typeFilter) q = q.eq('type', typeFilter)

    const { data, count } = await q
    setLogs(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }

  useEffect(() => { fetchLogs() }, [typeFilter, page])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <SectionHeading sub="API requests, booking attempts, and errors">Logs</SectionHeading>
        <Button variant="ghost" size="sm" onClick={fetchLogs} style={{ marginTop: 4 }}>
          <RefreshCw size={13} /> Refresh
        </Button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Select id="type-filter" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0) }}
          style={{ width: 220 }}>
          <option value="">All types</option>
          {Object.entries(TYPE_STYLES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </Select>
        <span style={{ fontSize: 12, color: 'var(--label)' }}>{total} entries</span>
      </div>

      <Card>
        {loading ? (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</p>
        ) : logs.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', padding: '2rem 0' }}>No logs found.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {['Type', 'Client ID', 'Date', 'Time', 'Error'].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(log => <LogRow key={log.id} log={log} />)}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
            <span style={{ fontSize: 12, color: 'var(--label)' }}>Page {page + 1} of {totalPages}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</Button>
              <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
