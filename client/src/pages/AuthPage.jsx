import { useState } from 'react';
import { api } from '../services/api';
import { Field } from '../components/common';
import { Brand } from '../components/layout/Brand';
import { notifyToast } from '../services/toast';

export default function AuthPage({ mode, navigate, onAuthenticated }) {
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
      notifyToast(isRegister ? 'Student account created.' : 'Signed in successfully.')
    } catch (requestError) {
      setError(requestError.message)
      notifyToast(requestError.message, 'error')
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
