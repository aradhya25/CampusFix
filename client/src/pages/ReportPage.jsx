import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { CATEGORIES, PRIORITIES } from '../constants/issueOptions';
import { Field, PageHeading } from '../components/common';
import { notifyToast } from '../services/toast';

export default function ReportPage({ onCreated }) {
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
      notifyToast('Your report has been submitted.')
      setForm({ title: '', description: '', category: 'facilities', location: '', priority: 'medium' })
      setImage(null)
      setImagePreview('')
      window.setTimeout(onCreated, 700)
    } catch (requestError) {
      setError(requestError.message)
      notifyToast(requestError.message, 'error')
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
