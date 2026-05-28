export default function Input({ label, id, type = 'text', value, onChange, placeholder, required, disabled, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label && (
        <label htmlFor={id} style={{ fontSize: 12, color: 'var(--label)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {label}{required && <span style={{ color: 'var(--teal)', marginLeft: 3 }}>*</span>}
        </label>
      )}
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '9px 14px',
          color: 'var(--white)',
          fontSize: 14,
          fontFamily: "'Barlow', sans-serif",
          fontWeight: 300,
          outline: 'none',
          transition: 'border-color 0.15s',
          width: '100%',
          opacity: disabled ? 0.5 : 1,
        }}
        onFocus={(e) => { e.target.style.borderColor = 'rgba(25,211,197,0.5)' }}
        onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }}
      />
    </div>
  )
}

export function Select({ label, id, value, onChange, children, required, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label && (
        <label htmlFor={id} style={{ fontSize: 12, color: 'var(--label)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {label}{required && <span style={{ color: 'var(--teal)', marginLeft: 3 }}>*</span>}
        </label>
      )}
      <select
        id={id}
        value={value}
        onChange={onChange}
        required={required}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '9px 14px',
          color: 'var(--white)',
          fontSize: 14,
          fontFamily: "'Barlow', sans-serif",
          fontWeight: 300,
          outline: 'none',
          width: '100%',
        }}
        onFocus={(e) => { e.target.style.borderColor = 'rgba(25,211,197,0.5)' }}
        onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }}
      >
        {children}
      </select>
    </div>
  )
}

export function Textarea({ label, id, value, onChange, placeholder, rows = 4, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label && (
        <label htmlFor={id} style={{ fontSize: 12, color: 'var(--label)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {label}
        </label>
      )}
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '9px 14px',
          color: 'var(--white)',
          fontSize: 14,
          fontFamily: "'Barlow', sans-serif",
          fontWeight: 300,
          outline: 'none',
          resize: 'vertical',
          width: '100%',
        }}
        onFocus={(e) => { e.target.style.borderColor = 'rgba(25,211,197,0.5)' }}
        onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }}
      />
    </div>
  )
}
