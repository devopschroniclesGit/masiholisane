export default function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  loading = false,
  className = '',
  type = 'button',
}) {
  const variants = {
    primary:   { backgroundColor: '#1B2F5E', color: 'white' },
    green:     { backgroundColor: '#3A8B2F', color: 'white' },
    orange:    { backgroundColor: '#E8621A', color: 'white' },
    outline:   { backgroundColor: 'transparent', color: '#1B2F5E', border: '2px solid #1B2F5E' },
    danger:    { backgroundColor: '#dc2626', color: 'white' },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={variants[variant]}
      className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-opacity
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 cursor-pointer'}
        ${className}`}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
}
