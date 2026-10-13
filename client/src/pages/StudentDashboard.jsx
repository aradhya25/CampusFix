import { useState } from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { PageHeading, SummaryCards, LoadingState, ErrorState, Pagination } from '../components/common';
import { IssueList } from '../components/issues/IssueList';
import IssueFilters from '../components/issues/IssueFilters';

export default function StudentDashboard({ user, refreshKey, navigate }) {
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
              <IssueFilters draft={draft} onDraftChange={setDraft} onApply={applyFilters} />
          <IssueList issues={issues} loading={loading} student onUpdated={(message) => { setNotice(message); setLocalRefresh((value) => value + 1) }} />
          <Pagination pagination={pagination} onPage={setPage} />
        </section>
      </>}
    </>
  )
}
