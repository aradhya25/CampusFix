import { useCallback, useEffect, useState } from 'react';
import { clearToken, getSavedUser, getToken, saveSession } from './services/api';
import { Brand } from './components/layout/Brand';
import AuthPage from './pages/AuthPage';
import ReportPage from './pages/ReportPage';
import StudentDashboard from './pages/StudentDashboard';
import StaffDashboard from './pages/StaffDashboard';
import { ToastViewport } from './components/common';
import './App.css';

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



function App() {
  const [route, navigate] = useHashRoute()
  const [token, setTokenState] = useState(getToken)
  const [user, setUser] = useState(getSavedUser)
  const [refreshKey, setRefreshKey] = useState(0)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const showToast = (event) => {
      setToast(event.detail)
      window.clearTimeout(showToast.timer)
      showToast.timer = window.setTimeout(() => setToast(null), 4500)
    }
    window.addEventListener('campusfix:toast', showToast)
    return () => window.removeEventListener('campusfix:toast', showToast)
  }, [])

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
    return <><ToastViewport toast={toast} onDismiss={() => setToast(null)} /><AuthPage mode={route === 'register' ? 'register' : 'login'} navigate={navigate} onAuthenticated={onAuthenticated} /></>
  }

  return (
    <div className="app-shell">
      <ToastViewport toast={toast} onDismiss={() => setToast(null)} />
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

export default App;
