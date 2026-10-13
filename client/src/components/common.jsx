export function ToastViewport({ toast, onDismiss }) {
  if (!toast) return null
  return <div className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
    <span>{toast.message}</span><button type="button" aria-label="Dismiss notification" onClick={onDismiss}>×</button>
  </div>
}

export function Field({ label, ...props }) {
  return <label className="field"><span>{label}</span><input {...props} /></label>
}

export function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div><span className="small-label">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      {action}
    </div>
  )
}

export function SummaryCards({ stats, staff = false }) {
  const cards = [
    { label: 'All issues', value: stats?.total ?? 0, tone: 'blue', icon: '▤' },
    { label: 'Open', value: stats?.byStatus?.open ?? 0, tone: 'amber', icon: '◷' },
    { label: 'In progress', value: stats?.byStatus?.['in-progress'] ?? 0, tone: 'violet', icon: '↗' },
    { label: 'Resolved', value: stats?.byStatus?.resolved ?? 0, tone: 'green', icon: '✓' },
    ...(staff ? [{ label: 'Closed', value: stats?.byStatus?.closed ?? 0, tone: 'slate', icon: '—' }] : []),
  ]
  return <div className={`summary-grid ${staff ? 'staff-summary-grid' : ''}`}>{cards.map((card) => <article className="summary-card" key={card.label}><span className={`summary-icon ${card.tone}`}>{card.icon}</span><div><span className="summary-label">{card.label}</span><strong>{card.value}</strong></div></article>)}</div>
}

export function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) return null
  return (
    <div className="pagination"><span>Showing page <strong>{pagination.page}</strong> of <strong>{pagination.pages}</strong></span><div><button className="button button-page" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>← Previous</button><button className="button button-page" disabled={pagination.page >= pagination.pages} onClick={() => onPage(pagination.page + 1)}>Next →</button></div></div>
  )
}

export function LoadingState({ label, compact = false }) {
  return <div className={`loading-state ${compact ? 'loading-compact' : ''}`} role="status"><span className="loading-mark" />{label}</div>
}

export function ErrorState({ message }) {
  return <div className="error-state" role="alert"><span>!</span><div><strong>We couldn’t load your dashboard</strong><p>{message}</p><button className="button button-secondary" onClick={() => window.location.reload()}>Try again</button></div></div>
}
