export function Brand({ compact = false }) {
  return (
    <a className={`brand ${compact ? 'brand-compact' : ''}`} href="#/dashboard" aria-label="CampusFix dashboard">
      <span className="brand-mark" aria-hidden="true"><span /></span>
      {!compact && <span className="brand-name">campus<span>fix</span></span>}
    </a>
  )
}
