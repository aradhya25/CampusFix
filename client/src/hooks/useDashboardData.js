import { useEffect, useState } from 'react';
import { api } from '../services/api';

const EMPTY_FILTERS = Object.freeze({})

export function useDashboardData({ staff = false, page = 1, filters = EMPTY_FILTERS, refreshKey = 0 }) {
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
