export default function Card({ children, style = {}, accent = false }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${accent ? 'rgba(25,211,197,0.2)' : 'var(--border)'}`,
        borderRadius: 12,
        padding: '1.5rem',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function SectionHeading({ children, sub }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <span className="teal-line" style={{ marginBottom: 12 }} />
      <h2
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 400,
          fontSize: 26,
          color: 'var(--white)',
          margin: 0,
          letterSpacing: '0.02em',
        }}
      >
        {children}
      </h2>
      {sub && (
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0 0', fontWeight: 300 }}>{sub}</p>
      )}
    </div>
  )
}
