import { useEffect, useState } from 'react'
import { Calendar, Users, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import Card, { SectionHeading } from '../components/ui/Card.jsx'

const STATUS_COLORS = {
  confirmed: { bg: 'rgba(25,211,197,0.1)', color: 'var(--teal)' },
  failed: { bg: 'rgba(248,113,113,0.1)', color: 'var(--error)' },
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 12, color: 'var(--label)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{label}</p>
          <p style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 42,
            fontWeight: 300,
            color: 'var(--white)',
            margin: '4px 0 0',
            lineHeight: 1,
          }}>
            {value ?? '—'}
          </p>
          {sub && <p style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0 0' }}>{sub}</p>}
        </div>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'var(--teal-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={18} color="var(--teal)" />
        </div>
      </div>
    </Card>
  )
}

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] ?? { bg: 'rgba(147,164,183,0.1)', color: 'var(--muted)' }
  return (
    <span style={{
      background: c.bg,
      color: c.color,
      fontSize: 11,
      fontWeight: 400,
      padding: '3px 10px',
      borderRadius: 20,
      textTransform: 'capitalize',
      letterSpacing: '0.04em',
    }}>
      {status}
    </span>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState({ clients: null, today: null, week: null, successRate: null })
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)

      const [clientsRes, todayRes, weekRes, recentRes] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
        supabase.from('bookings').select('id, caller_name, business_name, slot_start, status, clients(name)').order('created_at', { ascending: false }).limit(8),
      ])

      const weekTotal = weekRes.count ?? 0
      const weekSuccess = weekTotal > 0
        ? (await supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'confirmed').gte('created_at', weekAgo.toISOString())).count ?? 0
        : 0

      setStats({
        clients: clientsRes.count ?? 0,
        today: todayRes.count ?? 0,
        week: weekTotal,
        successRate: weekTotal > 0 ? Math.round((weekSuccess / weekTotal) * 100) : 100,
      })
      setBookings(recentRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div>
      <SectionHeading sub="System overview and recent activity">Dashboard</SectionHeading>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard icon={Users} label="Active Clients" value={stats.clients} />
        <StatCard icon={Calendar} label="Bookings Today" value={stats.today} />
        <StatCard icon={Clock} label="Bookings This Week" value={stats.week} />
        <StatCard icon={CheckCircle} label="Success Rate" value={stats.successRate !== null ? `${stats.successRate}%` : null} sub="Last 7 days" />
      </div>

      <Card>
        <h3 style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 400,
          fontSize: 18,
          color: 'var(--white)',
          margin: '0 0 1.25rem',
          letterSpacing: '0.02em',
        }}>
          Recent Bookings
        </h3>

        {loading ? (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</p>
        ) : bookings.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>No bookings yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {['Caller', 'Business', 'Client', 'Slot', 'Status'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left',
                    padding: '0 12px 12px 0',
                    color: 'var(--label)',
                    fontWeight: 400,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    borderBottom: '1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  {[
                    b.caller_name ?? '—',
                    b.business_name ?? '—',
                    b.clients?.name ?? '—',
                    b.slot_start ? new Date(b.slot_start).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—',
                  ].map((cell, i) => (
                    <td key={i} style={{ padding: '12px 12px 12px 0', color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                      {cell}
                    </td>
                  ))}
                  <td style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
