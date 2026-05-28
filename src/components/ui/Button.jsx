export default function Button({ children, variant = 'primary', size = 'md', disabled, onClick, type = 'button', style = {} }) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: "'Barlow', sans-serif",
    fontWeight: 400,
    border: 'none',
    borderRadius: 8,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.15s',
    fontSize: size === 'sm' ? 13 : size === 'lg' ? 16 : 14,
    padding: size === 'sm' ? '6px 14px' : size === 'lg' ? '12px 28px' : '9px 20px',
    letterSpacing: '0.02em',
  }

  const variants = {
    primary: {
      background: 'linear-gradient(135deg, #19D3C5, #17BFAE)',
      color: '#061014',
      boxShadow: '0 0 18px rgba(25,211,197,0.3)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--teal-light)',
      border: '1px solid rgba(25,211,197,0.25)',
    },
    danger: {
      background: 'rgba(248,113,113,0.1)',
      color: 'var(--error)',
      border: '1px solid rgba(248,113,113,0.25)',
    },
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseEnter={(e) => {
        if (disabled) return
        e.currentTarget.style.transform = 'translateY(-1px)'
        if (variant === 'primary') e.currentTarget.style.boxShadow = '0 0 28px rgba(25,211,197,0.45)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        if (variant === 'primary') e.currentTarget.style.boxShadow = '0 0 18px rgba(25,211,197,0.3)'
      }}
    >
      {children}
    </button>
  )
}
