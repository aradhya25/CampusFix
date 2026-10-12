import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, clearToken, getSavedUser, getToken, saveSession } from './services/api'
import './App.css'

const STATUSES = ['open', 'in-progress', 'resolved', 'closed']
const CATEGORIES = ['facilities', 'cleanliness', 'it', 'safety', 'other']
const STATUS_LABELS = {
  open: 'Open',
  'in-progress': 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

function readRoute() {
  return window.location.hash.replace(/^#\/?/, '') || 'dashboard'
}

function useHashRoute() {
  const [route, setRoute] = useState(readRoute)
  useEffect(() => {
    const update = () => setRoute(readRoute())
    window.addEventListener('hashchange', update)
    if (!window.location.hash) window.location.hash = '#/dashboard'
    return () => window.removeEventListener('hashchange', update)
  }, [])
  const navigate = useCallback((nextRoute) => { window.location.hash = `#/${nextRoute}` }, [])
  return [route, navigate]
}

function Brand({ compact = false }) {
  return (
    <a className={`brand ${compact ? 'brand-compact' : ''}`} href="#/dashboard" aria-label="CampusFix dashboard">
      <span className="brand-mark" aria-hidden="true"><span /></span>
      {!compact && <span className="brand-name">campus<span>fix</span></span>}
    </a>
  )
}

function App() {
  const [route, navigate] = useHashRoute()
  const [token, setTokenState] = useState(getToken)
  const [user, setUser] = useState(getSavedUser)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const isAuthPage = route === 'login' || route === 'register'
    if (!token || !user) {
      if (!isAuthPage) navigate('login')
    } else if (isAuthPage) {
      navigate('dashboard')
    } else if (route === 'report' && user.role !== 'student') {
      navigate('dashboard')
    }
  }, [route, token, user, navigate])

  function onAuthenticated(session) {
    saveSession(session)
    setTokenState(session.token)
    setUser(session.user)
    navigate('dashboard')
  }

  function logout() {
    clearToken()
    setTokenState(null)
    setUser(null)
    navigate('login')
  }

  useEffect(() => {
    const handleUnauthorized = () => {
      clearToken()
      setTokenState(null)
      setUser(null)
      navigate('login')
    }
    window.addEventListener('campusfix:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('campusfix:unauthorized', handleUnauthorized)
  }, [navigate])

  if (!token || !user) {
    return <AuthPage mode={route === 'register' ? 'register' : 'login'} navigate={navigate} onAuthenticated={onAuthenticated} />
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <div className="topbar-right">
          <div className="user-chip">
            <span className="avatar">{user.name?.trim()?.charAt(0)?.toUpperCase() || 'U'}</span>
            <span className="user-copy"><strong>{user.name}</strong><small>{user.role}</small></span>
          </div>
          <button className="button button-quiet logout-button" onClick={logout}>Log out</button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar" aria-label="Main navigation">
          <p className="nav-caption">WORKSPACE</p>
          <a className={`nav-link ${route === 'dashboard' ? 'active' : ''}`} href="#/dashboard">
            <span className="nav-icon">▦</span> Overview
          </a>
          {user.role === 'student' && (
            <a className={`nav-link ${route === 'report' ? 'active' : ''}`} href="#/report">
              <span className="nav-icon">＋</span> Report an issue
            </a>
          )}
          <div className="sidebar-help">
            <span className="help-dot" />
            <strong>Campus care, together.</strong>
            <p>Every report helps make campus a better place.</p>
          </div>
          <div className="sidebar-footer">CampusFix <span>•</span> Issue portal</div>
        </aside>

        <main className="main-content">
          {user.role === 'staff' ? (
            <StaffDashboard user={user} refreshKey={refreshKey} />
          ) : route === 'report' ? (
            <ReportPage onCreated={() => { setRefreshKey((value) => value + 1); navigate('dashboard') }} />
          ) : (
            <StudentDashboard user={user} refreshKey={refreshKey} navigate={navigate} />
          )}
        </main>
      </div>
    </div>
  )
}

function AuthPage({ mode, navigate, onAuthenticated }) {
  const isRegister = mode === 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (isRegister && form.name.trim().length < 2) return setError('Enter your name (at least 2 characters).')
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError('Enter a valid email address.')
    if (form.password.length < 8) return setError('Your password must be at least 8 characters.')
    if (isRegister && form.password !== form.confirmPassword) return setError('The passwords do not match.')

    setBusy(true)
    try {
      const session = isRegister
        ? await api.register({ name: form.name.trim(), email: form.email.trim(), password: form.password })
        : await api.login({ email: form.email.trim(), password: form.password })
      onAuthenticated(session)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-top"><Brand /><span className="auth-top-note">Campus issue portal</span></div>
      <main className="auth-layout">
        <section className="auth-aside">
          <div className="eyebrow"><span className="eyebrow-line" /> A better campus starts here</div>
          <h1>Small fixes.<br /><span>Better days.</span></h1>
          <p>Report an issue, follow its progress, and help make campus work better for everyone.</p>
          <div className="auth-illustration" aria-hidden="true">
            <div className="illustration-window"><div className="window-top"><i /><i /><i /></div><div className="window-content"><span className="window-icon">✓</span><div><b>Issue received</b><small>We’ll take it from here.</small></div></div></div>
            <span className="illustration-spark spark-one">✳</span><span className="illustration-spark spark-two">✦</span>
          </div>
        </section>
        <section className="auth-card">
          <div className="auth-card-heading">
            <span className="small-label">{isRegister ? 'GET STARTED' : 'WELCOME BACK'}</span>
            <h2>{isRegister ? 'Create your account' : 'Sign in to CampusFix'}</h2>
            <p>{isRegister ? 'Use your student account to submit and track reports.' : 'Your campus issue dashboard is one step away.'}</p>
          </div>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <form className="form-stack" onSubmit={submit}>
            {isRegister && <Field label="Full name" name="name" value={form.name} onChange={update} placeholder="e.g. Alex Morgan" autoComplete="name" required />}
            <Field label="Email address" name="email" type="email" value={form.email} onChange={update} placeholder="you@university.edu" autoComplete="email" required />
            <Field label="Password" name="password" type="password" value={form.password} onChange={update} placeholder="At least 8 characters" autoComplete={isRegister ? 'new-password' : 'current-password'} required />
            {isRegister && <Field label="Confirm password" name="confirmPassword" type="password" value={form.confirmPassword} onChange={update} placeholder="Enter your password again" autoComplete="new-password" required />}
            <button className="button button-primary button-full auth-submit" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : isRegister ? 'Create student account' : 'Sign in'} <span aria-hidden="true">→</span>
            </button>
          </form>
          <div className="auth-switch">
            {isRegister ? 'Already have an account?' : 'New to CampusFix?'}{' '}
            <a href={isRegister ? '#/login' : '#/register'} onClick={(event) => { event.preventDefault(); navigate(isRegister ? 'login' : 'register') }}>
              {isRegister ? 'Sign in' : 'Create an account'}
            </a>
          </div>
          <p className="auth-role-note">Staff accounts are set up by your campus administrator.</p>
        </section>
      </main>
      <footer className="auth-footer">© {new Date().getFullYear()} CampusFix <span>•</span> Making campus better, together</footer>
    </div>
  )
}

function Field({ label, ...props }) {
  return <label className="field"><span>{label}</span><input {...props} /></label>
}

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div><span className="small-label">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      {action}
    </div>
  )
}

function SummaryCards({ stats, staff = false }) {
  const cards = [
    { label: 'All issues', value: stats?.total ?? 0, tone: 'blue', icon: '▤' },
    { label: 'Open', value: stats?.byStatus?.open ?? 0, tone: 'amber', icon: '◷' },
    { label: 'In progress', value: stats?.byStatus?.['in-progress'] ?? 0, tone: 'violet', icon: '↗' },
    { label: 'Resolved', value: stats?.byStatus?.resolved ?? 0, tone: 'green', icon: '✓' },
    ...(staff ? [{ label: 'Closed', value: stats?.byStatus?.closed ?? 0, tone: 'slate', icon: '—' }] : []),
  ]
  return <div className={`summary-grid ${staff ? 'staff-summary-grid' : ''}`}>{cards.map((card) => <article className="summary-card" key={card.label}><span className={`summary-icon ${card.tone}`}>{card.icon}</span><div><span className="summary-label">{card.label}</span><strong>{card.value}</strong></div></article>)}</div>
}

const EMPTY_FILTERS = Object.freeze({})

function useDashboardData({ staff = false, page = 1, filters = EMPTY_FILTERS, refreshKey = 0 }) {
  const requestKey = JSON.stringify({ staff, page, filters, refreshKey })
  const [result, setResult] = useState(null)

  useEffect(() => {
    let active = true
    const params = { page, limit: 10, ...filters }
    Promise.all([api.getIssues(params), api.getStats()])
      .then(([issuesResult, statsResult]) => {
        if (!active) return
        setResult({ key: requestKey, issues: issuesResult.issues, pagination: issuesResult.pagination, stats: statsResult, error: '' })
      })
      .catch((requestError) => {
        if (!active) return
        setResult({ key: requestKey, issues: [], pagination: { page, limit: 10, total: 0, pages: 0 }, stats: null, error: requestError.message })
      })
    return () => { active = false }
  }, [staff, page, filters, refreshKey, requestKey])

  const current = result?.key === requestKey ? result : null
  return {
    issues: current?.issues || [],
    pagination: current?.pagination || { page, limit: 10, total: 0, pages: 0 },
    stats: current?.stats || null,
    loading: !current,
    error: current?.error || '',
  }
}

function StudentDashboard({ user, refreshKey, navigate }) {
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState({ search: '', status: '', category: '', priority: '', sort: 'newest' })
  const [filters, setFilters] = useState({ sort: 'newest' })
  const [localRefresh, setLocalRefresh] = useState(0)
  const [notice, setNotice] = useState('')
  const { issues, pagination, stats, loading, error } = useDashboardData({ page, filters, refreshKey: refreshKey + localRefresh })
  function applyFilters(event) {
    event.preventDefault()
    setPage(1)
    setFilters({ ...draft })
  }
  return (
    <>
      <PageHeading eyebrow="STUDENT DASHBOARD" title={`Good to see you, ${user.name.split(' ')[0]}`} description="Here’s what’s happening with your campus reports." action={<button className="button button-primary" onClick={() => navigate('report')}><span>＋</span> Report an issue</button>} />
      {loading && !stats ? <LoadingState label="Loading your dashboard…" /> : error ? <ErrorState message={error} /> : <>
        <SummaryCards stats={stats} />
        <section className="content-panel issue-panel">
          <div className="panel-heading"><div><h2>Your reports</h2><p>Keep track of the issues you’ve shared.</p></div><span className="count-pill">{pagination.total} {pagination.total === 1 ? 'report' : 'reports'}</span></div>
          {notice && <div className="alert alert-success action-notice" role="status">{notice}<button type="button" aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div>}
          <form className="filter-bar student-filter-bar" onSubmit={applyFilters}>
            <label className="search-field"><span className="sr-only">Search your issues</span><span className="search-icon">⌕</span><input value={draft.search} onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))} maxLength={100} placeholder="Search your reports…" /></label>
            <label className="filter-select"><span className="sr-only">Filter by status</span><select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}><option value="">All statuses</option>{STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></label>
            <label className="filter-select"><span className="sr-only">Filter by category</span><select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}><option value="">All categories</option>{CATEGORIES.map((category) => <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>)}</select></label>
            <label className="filter-select"><span className="sr-only">Filter by priority</span><select value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value }))}><option value="">All priorities</option>{PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}</select></label>
            <label className="filter-select"><span className="sr-only">Sort reports</span><select value={draft.sort} onChange={(event) => setDraft((current) => ({ ...current, sort: event.target.value }))}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="priority">Highest priority</option></select></label>
            <button className="button button-secondary filter-button" type="submit">Apply</button>
          </form>
          <IssueList issues={issues} loading={loading} student onUpdated={(message) => { setNotice(message); setLocalRefresh((value) => value + 1) }} />
          <Pagination pagination={pagination} onPage={setPage} />
        </section>
      </>}
    </>
  )
}

const PRIORITIES = ['low', 'medium', 'high', 'urgent']

function ReportPage({ onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', category: 'facilities', location: '', priority: 'medium' })
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    return () => { if (imagePreview) URL.revokeObjectURL(imagePreview) }
  }, [imagePreview])

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function selectImage(event) {
    const selected = event.target.files?.[0]
    event.target.value = ''
    setError('')
    if (!selected) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) {
      setImage(null)
      setImagePreview('')
      setError('Choose a JPEG, PNG, or WebP image.')
      return
    }
    if (selected.size > 5 * 1024 * 1024) {
      setImage(null)
      setImagePreview('')
      setError('Image must be 5 MB or smaller.')
      return
    }
    setImage(selected)
    setImagePreview(URL.createObjectURL(selected))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (form.title.trim().length < 4) return setError('Title must be at least 4 characters.')
    if (form.description.trim().length < 10) return setError('Description must be at least 10 characters.')
    if (!PRIORITIES.includes(form.priority)) return setError('Choose a priority for this report.')
    if (!form.location.trim()) return setError('Add a location so staff can find the issue.')
    setBusy(true)
    try {
      await api.createIssue({ ...form, title: form.title.trim(), description: form.description.trim(), location: form.location.trim() }, image)
      setSuccess('Your report has been submitted.')
      setForm({ title: '', description: '', category: 'facilities', location: '', priority: 'medium' })
      setImage(null)
      setImagePreview('')
      window.setTimeout(onCreated, 700)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeading eyebrow="NEW REPORT" title="Report an issue" description="Tell us what needs attention and where to find it." />
      <section className="content-panel report-panel">
        <div className="panel-heading"><div><h2>Issue details</h2><p>Share a few details so the right team can help.</p></div><span className="required-note">* Required</span></div>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {success && <div className="alert alert-success" role="status">{success}</div>}
        <form className="report-form" onSubmit={submit}>
          <Field label="Issue title *" name="title" value={form.title} onChange={update} placeholder="What needs to be fixed?" maxLength={120} required />
          <label className="field"><span>Description *</span><textarea name="description" value={form.description} onChange={update} placeholder="Add details that will help us understand the issue…" rows="5" maxLength={2000} required /></label>
          <div className="form-row">
            <label className="field"><span>Category *</span><select name="category" value={form.category} onChange={update}>{CATEGORIES.map((category) => <option value={category} key={category}>{category[0].toUpperCase() + category.slice(1)}</option>)}</select></label>
            <Field label="Location *" name="location" value={form.location} onChange={update} placeholder="Building, floor, or area" maxLength={120} required />
          </div>
          <label className="field"><span>Priority *</span><select name="priority" value={form.priority} onChange={update} required>{PRIORITIES.map((priority) => <option value={priority} key={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}</select></label>
          <label className="field"><span>Photo attachment <small>(optional, JPEG / PNG / WebP, up to 5 MB)</small></span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} disabled={busy} /></label>
          {imagePreview && <div className="image-preview"><img src={imagePreview} alt="Preview of the selected issue attachment" /><div><strong>{image?.name}</strong><small>{(image?.size / (1024 * 1024)).toFixed(2)} MB</small><button type="button" className="button button-quiet" onClick={() => { setImage(null); setImagePreview('') }} disabled={busy}>Remove photo</button></div></div>}
          <div className="form-actions"><a className="button button-quiet" href="#/dashboard">Cancel</a><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit report'} <span aria-hidden="true">→</span></button></div>
        </form>
      </section>
    </>
  )
}

function StaffDashboard({ refreshKey }) {
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState({ status: '', category: '', priority: '', search: '', sort: 'newest' })
  const [filters, setFilters] = useState({ sort: 'newest' })
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [updatingId, setUpdatingId] = useState('')
  const [localRefresh, setLocalRefresh] = useState(0)
  const { issues, pagination, stats, loading, error } = useDashboardData({ staff: true, page, filters, refreshKey: refreshKey + localRefresh })

  function applyFilters(event) {
    event.preventDefault()
    setPage(1)
    setFilters({ ...draft })
  }

  async function updateIssue(issue, changes) {
    if (changes.status && ['resolved', 'closed'].includes(changes.status)) {
      const confirmed = window.confirm(`Mark “${issue.title}” as ${STATUS_LABELS[changes.status].toLowerCase()}?`)
      if (!confirmed) return
    }
    setActionError('')
    setActionMessage('')
    setUpdatingId(issue._id)
    try {
      await api.updateIssue(issue._id, changes)
      setActionMessage('Issue updated successfully.')
      setLocalRefresh((value) => value + 1)
    } catch (requestError) {
      setActionError(requestError.message)
    } finally {
      setUpdatingId('')
    }
  }

  return (
    <>
      <PageHeading eyebrow="STAFF DASHBOARD" title="Issue overview" description="Review reports and keep campus improvements moving." />
      {loading && !stats ? <LoadingState label="Loading issue overview…" /> : error ? <ErrorState message={error} /> : <>
        <SummaryCards stats={stats} staff />
        <section className="content-panel queue-panel">
          <div className="panel-heading"><div><h2>Issue queue</h2><p>Search and filter all campus reports.</p></div><span className="count-pill">{pagination.total} results</span></div>
          <form className="filter-bar staff-filter-bar" onSubmit={applyFilters}>
            <label className="search-field"><span className="sr-only">Search issues</span><span className="search-icon">⌕</span><input value={draft.search} onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))} maxLength={100} placeholder="Search title, description, location…" /></label>
            <label className="filter-select"><span className="sr-only">Filter by status</span><select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}><option value="">All statuses</option>{STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></label>
            <label className="filter-select"><span className="sr-only">Filter by category</span><select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}><option value="">All categories</option>{CATEGORIES.map((category) => <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>)}</select></label>
            <label className="filter-select"><span className="sr-only">Filter by priority</span><select value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value }))}><option value="">All priorities</option>{PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}</select></label>
            <label className="filter-select"><span className="sr-only">Sort issue queue</span><select value={draft.sort} onChange={(event) => setDraft((current) => ({ ...current, sort: event.target.value }))}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="priority">Highest priority</option></select></label>
            <button className="button button-secondary filter-button" type="submit">Apply filters</button>
          </form>
          {actionError && <div className="alert alert-error" role="alert">{actionError}</div>}
          {actionMessage && <div className="alert alert-success action-notice" role="status">{actionMessage}<button type="button" aria-label="Dismiss notification" onClick={() => setActionMessage('')}>×</button></div>}
          <IssueList issues={issues} loading={loading} staff updatingId={updatingId} onUpdate={updateIssue} />
          <Pagination pagination={pagination} onPage={setPage} />
        </section>
      </>}
    </>
  )
}

function IssueList({ issues, loading, staff = false, student = false, updatingId, onUpdate, onUpdated }) {
  if (loading) return <LoadingState label="Loading reports…" compact />
  if (!issues.length) return <div className="empty-state"><span className="empty-icon">⌕</span><h3>{staff ? 'No matching issues' : 'No reports yet'}</h3><p>{staff ? 'Try a different search or adjust your filters.' : 'When you report a campus issue, it will show up here.'}</p></div>

  return (
    <div className="issue-list">
      {issues.map((issue) => <IssueCard key={issue._id} issue={issue} staff={staff} student={student} updating={updatingId === issue._id} onUpdate={onUpdate} onUpdated={onUpdated} />)}
    </div>
  )
}

function IssueCard({ issue, staff, student, updating, onUpdate, onUpdated }) {
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ title: issue.title, description: issue.description, category: issue.category, location: issue.location })
  const [notes, setNotes] = useState(issue.resolutionNotes || '')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const date = useMemo(() => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(issue.createdAt)), [issue.createdAt])

  function toggleDetails() {
    const willExpand = !expanded
    setExpanded(willExpand)
    if (willExpand) {
      setDetailLoading(true)
      setDetailError('')
    }
  }

  useEffect(() => {
    if (!expanded) return undefined
    let active = true
    api.getIssue(issue._id)
      .then((response) => { if (active) setDetail(response.issue) })
      .catch((requestError) => { if (active) setDetailError(requestError.message) })
      .finally(() => { if (active) setDetailLoading(false) })
    return () => { active = false }
  }, [expanded, issue._id])

  async function saveStudentEdit(event) {
    event.preventDefault()
    setActionError('')
    if (editForm.title.trim().length < 4) return setActionError('Title must be at least 4 characters.')
    if (editForm.description.trim().length < 10) return setActionError('Description must be at least 10 characters.')
    if (!editForm.location.trim()) return setActionError('Location is required.')
    setSaving(true)
    try {
      await api.updateIssue(issue._id, { ...editForm, title: editForm.title.trim(), description: editForm.description.trim(), location: editForm.location.trim() })
      setEditing(false)
      onUpdated('Your report was updated.')
    } catch (requestError) {
      setActionError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  async function cancelReport() {
    if (!window.confirm(`Cancel and delete “${issue.title}”? This action cannot be undone.`)) return
    setActionError('')
    setSaving(true)
    try {
      await api.deleteIssue(issue._id)
      onUpdated('Your report was cancelled.')
    } catch (requestError) {
      setActionError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  function updateEditField(event) {
    setEditForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  return (
    <article className="issue-card">
      <button className="issue-card-main" onClick={toggleDetails} aria-expanded={expanded}>
        <span className="issue-category-icon">{issue.category === 'it' ? '⌘' : issue.category === 'safety' ? '◇' : issue.category === 'cleanliness' ? '✳' : '⌂'}</span>
        <span className="issue-main-copy"><strong>{issue.title}</strong><span>{issue.category} <i>•</i> {issue.location}</span></span>
        <span className="issue-reporter">{staff ? `By ${issue.createdBy?.name || 'Campus user'} · ${date}` : date}</span>
        <PriorityBadge priority={issue.priority} />
        <StatusBadge status={issue.status} />
        <span className="issue-chevron" aria-hidden="true">{expanded ? '−' : '+'}</span>
      </button>
      {expanded && <div className="issue-expanded">
        {actionError && <div className="alert alert-error" role="alert">{actionError}</div>}
        {detailLoading && <LoadingState label="Loading issue details…" compact />}
        {detailError && <div className="alert alert-error" role="alert">{detailError}</div>}
        {editing ? (
          <form className="issue-edit-form" onSubmit={saveStudentEdit}>
            <Field label="Issue title" name="title" value={editForm.title} onChange={updateEditField} maxLength={120} required />
            <label className="field"><span>Description</span><textarea name="description" value={editForm.description} onChange={updateEditField} maxLength={2000} rows="4" required /></label>
            <div className="form-row"><label className="field"><span>Category</span><select name="category" value={editForm.category} onChange={updateEditField}>{CATEGORIES.map((category) => <option value={category} key={category}>{category[0].toUpperCase() + category.slice(1)}</option>)}</select></label><Field label="Location" name="location" value={editForm.location} onChange={updateEditField} maxLength={120} required /></div>
            <div className="form-actions"><button className="button button-quiet" type="button" onClick={() => setEditing(false)}>Keep current report</button><button className="button button-primary" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save changes'}</button></div>
          </form>
        ) : !detailLoading && !detailError && <>
          <div className="issue-description"><span className="detail-label">DESCRIPTION</span><p>{issue.description}</p></div>
          {(detail?.image || issue.image)?.url && <a className="issue-image-link" href={(detail?.image || issue.image).url} target="_blank" rel="noreferrer"><img className="issue-image" src={(detail?.image || issue.image).url} alt={`Photo attached to ${issue.title}`} loading="lazy" /></a>}
          <div className="issue-meta"><span><small>Reported</small><strong>{date}</strong></span><span><small>Priority</small><PriorityBadge priority={issue.priority} /></span><span><small>Location</small><strong>{issue.location}</strong></span><span><small>Age / resolution target</small><strong>{formatIssueAge(issue.sla?.ageHours)} / {issue.sla?.targetHours ?? '—'} hours</strong></span></div>
          {issue.sla?.isOverdue && <p className="sla-indicator overdue" role="status">Overdue · target was {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(issue.sla.dueAt))}</p>}
          <p className="resolution-note"><strong>Resolution notes</strong><span>{issue.resolutionNotes || 'No resolution notes yet.'}</span></p>
          <IssueTimeline activity={detail?.activity || []} />
          {staff && <StaffIssueControls issue={issue} notes={notes} setNotes={setNotes} updating={updating} onUpdate={onUpdate} />}
          {student && <div className="issue-actions"><button className="button button-secondary" onClick={() => { setActionError(''); setEditing(true) }} disabled={saving}>Edit report</button><button className="button button-danger-quiet" onClick={cancelReport} disabled={saving}>{saving ? 'Cancelling…' : 'Cancel report'}</button></div>}
        </>}
      </div>}
    </article>
  )
}

function formatIssueAge(ageHours = 0) {
  if (ageHours < 1) return `${Math.max(0, Math.round(ageHours * 60))} min`
  if (ageHours < 24) return `${ageHours} hours`
  return `${Math.floor(ageHours / 24)} days`
}

function IssueTimeline({ activity }) {
  if (!activity.length) return <div className="timeline-empty">No activity history is available for this issue yet.</div>
  return <section className="issue-timeline" aria-label="Issue activity history">
    <h3>Activity history</h3>
    <ol>{activity.map((entry) => <li key={entry._id || `${entry.action}-${entry.changedAt}`}>
      <span className="timeline-marker" aria-hidden="true" />
      <div><strong>{entry.action === 'reported' ? 'Issue reported' : `Status changed: ${STATUS_LABELS[entry.fromStatus] || entry.fromStatus} → ${STATUS_LABELS[entry.toStatus] || entry.toStatus}`}</strong>
        <p>By {entry.actor?.name || 'CampusFix user'} · {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.changedAt))}</p>
        {entry.note && <p className="timeline-note">{entry.note}</p>}
      </div>
    </li>)}</ol>
  </section>
}

function StaffIssueControls({ issue, notes, setNotes, updating, onUpdate }) {
  return (
    <div className="staff-controls">
      <div className="staff-control-row">
        <label className="status-control"><span>Update status</span><select value={issue.status} disabled={updating} onChange={(event) => onUpdate(issue, { status: event.target.value })}>{STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></label>
        <label className="status-control"><span>Priority</span><select value={issue.priority} disabled={updating} onChange={(event) => onUpdate(issue, { priority: event.target.value })}>{PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}</select></label>
        {updating && <small className="saving-label">Saving…</small>}
      </div>
      <label className="field resolution-field"><span>Resolution notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows="3" placeholder="Share what was done to resolve the issue…" /></label>
      <div className="form-actions"><button className="button button-secondary" disabled={updating || notes === (issue.resolutionNotes || '')} onClick={() => onUpdate(issue, { resolutionNotes: notes })}>Save resolution notes</button></div>
    </div>
  )
}

function PriorityBadge({ priority = 'medium' }) {
  return <span className={`priority-badge priority-${priority}`}><i />{priority}</span>
}

function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}><i />{STATUS_LABELS[status] || status}</span>
}

function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) return null
  return (
    <div className="pagination"><span>Showing page <strong>{pagination.page}</strong> of <strong>{pagination.pages}</strong></span><div><button className="button button-page" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>← Previous</button><button className="button button-page" disabled={pagination.page >= pagination.pages} onClick={() => onPage(pagination.page + 1)}>Next →</button></div></div>
  )
}

function LoadingState({ label, compact = false }) {
  return <div className={`loading-state ${compact ? 'loading-compact' : ''}`} role="status"><span className="loading-mark" />{label}</div>
}

function ErrorState({ message }) {
  return <div className="error-state" role="alert"><span>!</span><div><strong>We couldn’t load your dashboard</strong><p>{message}</p><button className="button button-secondary" onClick={() => window.location.reload()}>Try again</button></div></div>
}

export default App
