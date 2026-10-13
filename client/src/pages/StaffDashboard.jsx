import { useState } from 'react';
import { api } from '../services/api';
import { STATUS_LABELS } from '../constants/issueOptions';
import { useDashboardData } from '../hooks/useDashboardData';
import { PageHeading, SummaryCards, LoadingState, ErrorState, Pagination } from '../components/common';
import { IssueList } from '../components/issues/IssueList';
import IssueFilters from '../components/issues/IssueFilters';
import { notifyToast } from '../services/toast';

export default function StaffDashboard({ refreshKey }) {
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
    if (changes.status && changes.status !== issue.status) {
      const confirmed = window.confirm(`Mark “${issue.title}” as ${STATUS_LABELS[changes.status].toLowerCase()}?`)
      if (!confirmed) return
    }
    setActionError('')
    setActionMessage('')
    setUpdatingId(issue._id)
    try {
      await api.updateIssue(issue._id, changes)
      setActionMessage('Issue updated successfully.')
      notifyToast('Issue updated successfully.')
      setLocalRefresh((value) => value + 1)
    } catch (requestError) {
      setActionError(requestError.message)
      notifyToast(requestError.message, 'error')
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
              <IssueFilters draft={draft} onDraftChange={setDraft} onApply={applyFilters} staff />
          {actionError && <div className="alert alert-error" role="alert">{actionError}</div>}
          {actionMessage && <div className="alert alert-success action-notice" role="status">{actionMessage}<button type="button" aria-label="Dismiss notification" onClick={() => setActionMessage('')}>×</button></div>}
          <IssueList issues={issues} loading={loading} staff updatingId={updatingId} onUpdate={updateIssue} />
          <Pagination pagination={pagination} onPage={setPage} />
        </section>
      </>}
    </>
  )
}
