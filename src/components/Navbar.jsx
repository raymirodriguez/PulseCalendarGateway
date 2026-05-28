import { Zap } from 'lucide-react'

export default function Navbar() {
  return (
    <nav
      className="glass"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2rem',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Zap size={18} color="var(--teal)" />
        <span
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 400,
            fontSize: 20,
            letterSpacing: '0.04em',
            color: 'var(--white)',
          }}
        >
          Pulse Calendar Gateway
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span
          style={{
            fontSize: 12,
            color: 'var(--label)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Admin Console
        </span>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--teal)',
            boxShadow: '0 0 8px var(--teal)',
          }}
        />
      </div>
    </nav>
  )
}
