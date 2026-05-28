import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, CalendarCheck, ScrollText } from 'lucide-react'

const NAV = [
  { to: '/', end: true, icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/test', icon: CalendarCheck, label: 'Test Booking' },
  { to: '/logs', icon: ScrollText, label: 'Logs' },
]

export default function Sidebar() {
  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border)',
        padding: '1.5rem 0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {NAV.map(({ to, end, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 12px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 300,
            textDecoration: 'none',
            color: isActive ? 'var(--teal)' : 'var(--muted)',
            background: isActive ? 'var(--teal-dim)' : 'transparent',
            transition: 'color 0.15s, background 0.15s',
          })}
        >
          {({ isActive }) => (
            <>
              <Icon size={15} color={isActive ? 'var(--teal)' : 'var(--muted)'} />
              {label}
            </>
          )}
        </NavLink>
      ))}

      <div style={{ marginTop: 'auto', padding: '0 12px' }}>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <p style={{ fontSize: 11, color: 'var(--label)', margin: 0 }}>PCG v1.0</p>
          <p style={{ fontSize: 11, color: 'var(--label)', margin: '2px 0 0' }}>Futura AI Solutions</p>
        </div>
      </div>
    </aside>
  )
}
