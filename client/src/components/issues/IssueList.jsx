import { useEffect, useState } from "react";
import { api } from "../../services/api";
import {
  STATUSES,
  CATEGORIES,
  PRIORITIES,
  STATUS_LABELS,
} from "../../constants/issueOptions";
import { Field, LoadingState } from "../common";
import { notifyToast } from "../../services/toast";

export function IssueList({
  issues,
  loading,
  staff = false,
  student = false,
  updatingId,
  onUpdate,
  onUpdated,
}) {
  if (loading) return <LoadingState label="Loading reports…" compact />;
  if (!issues.length)
    return (
      <div className="empty-state">
        <span className="empty-icon">⌕</span>
        <h3>{staff ? "No matching issues" : "No reports yet"}</h3>
        <p>
          {staff
            ? "Try a different search or adjust your filters."
            : "When you report a campus issue, it will show up here."}
        </p>
      </div>
    );

  return (
    <div className="issue-list">
      {issues.map((issue) => (
        <IssueCard
          key={issue._id}
          issue={issue}
          staff={staff}
          student={student}
          updating={updatingId === issue._id}
          onUpdate={onUpdate}
          onUpdated={onUpdated}
        />
      ))}
    </div>
  );
}

export function IssueCard({
  issue,
  staff,
  student,
  updating,
  onUpdate,
  onUpdated,
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: issue.title,
    description: issue.description,
    category: issue.category,
    location: issue.location,
  });
  const [notes, setNotes] = useState(issue.resolutionNotes || "");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const createdAt = new Date(issue.createdAt);
  const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(createdAt);
  const relativeDate = (() => {
    const hours = issue.sla?.ageHours ?? 0;
    const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    if (hours < 1) return "just now";
    if (hours < 24) return relative.format(-Math.floor(hours), "hour");
    if (hours < 720) return relative.format(-Math.floor(hours / 24), "day");
    return relative.format(-Math.floor(hours / 720), "month");
  })();

  function toggleDetails() {
    const willExpand = !expanded;
    setExpanded(willExpand);
    if (willExpand) {
      setDetailLoading(true);
      setDetailError("");
    }
  }

  useEffect(() => {
    if (!expanded) return undefined;
    let active = true;
    api
      .getIssue(issue._id)
      .then((response) => {
        if (active) setDetail(response.issue);
      })
      .catch((requestError) => {
        if (active) setDetailError(requestError.message);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [expanded, issue._id]);

  async function saveStudentEdit(event) {
    event.preventDefault();
    setActionError("");
    if (editForm.title.trim().length < 4)
      return setActionError("Title must be at least 4 characters.");
    if (editForm.description.trim().length < 10)
      return setActionError("Description must be at least 10 characters.");
    if (!editForm.location.trim())
      return setActionError("Location is required.");
    setSaving(true);
    try {
      await api.updateIssue(issue._id, {
        ...editForm,
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        location: editForm.location.trim(),
      });
      setEditing(false);
      onUpdated("Your report was updated.");
      notifyToast("Your report was updated.");
    } catch (requestError) {
      setActionError(requestError.message);
      notifyToast(requestError.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function cancelReport() {
    if (
      !window.confirm(
        `Cancel and delete “${issue.title}”? This action cannot be undone.`,
      )
    )
      return;
    setActionError("");
    setSaving(true);
    try {
      await api.deleteIssue(issue._id);
      onUpdated("Your report was cancelled.");
      notifyToast("Your report was cancelled.");
    } catch (requestError) {
      setActionError(requestError.message);
      notifyToast(requestError.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function updateEditField(event) {
    setEditForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  return (
    <article className="issue-card">
      <button
        className="issue-card-main"
        onClick={toggleDetails}
        aria-expanded={expanded}
      >
        <span className="issue-category-icon">
          {issue.category === "it"
            ? "⌘"
            : issue.category === "safety"
              ? "◇"
              : issue.category === "cleanliness"
                ? "✳"
                : "⌂"}
        </span>
        <span className="issue-main-copy">
          <strong>{issue.title}</strong>
          <span>
            {issue.category} <i>•</i> {issue.location}
          </span>
        </span>
        <span className="issue-relative-mobile" aria-label={`Reported ${relativeDate}`}>{relativeDate}</span>
        <span className="issue-reporter">
          <time dateTime={createdAt.toISOString()} title={date}>
            {staff ? `By ${issue.createdBy?.name || "Campus user"} · ` : ""}{relativeDate}
          </time>
        </span>
        <PriorityBadge priority={issue.priority} />
        <StatusBadge status={issue.status} />
        <span className="issue-chevron" aria-hidden="true">
          {expanded ? "−" : "+"}
        </span>
      </button>
      {expanded && (
        <div className="issue-expanded">
          {actionError && (
            <div className="alert alert-error" role="alert">
              {actionError}
            </div>
          )}
          {detailLoading && (
            <LoadingState label="Loading issue details…" compact />
          )}
          {detailError && (
            <div className="alert alert-error" role="alert">
              {detailError}
            </div>
          )}
          {editing ? (
            <form className="issue-edit-form" onSubmit={saveStudentEdit}>
              <Field
                label="Issue title"
                name="title"
                value={editForm.title}
                onChange={updateEditField}
                maxLength={120}
                required
              />
              <label className="field">
                <span>Description</span>
                <textarea
                  name="description"
                  value={editForm.description}
                  onChange={updateEditField}
                  maxLength={2000}
                  rows="4"
                  required
                />
              </label>
              <div className="form-row">
                <label className="field">
                  <span>Category</span>
                  <select
                    name="category"
                    value={editForm.category}
                    onChange={updateEditField}
                  >
                    {CATEGORIES.map((category) => (
                      <option value={category} key={category}>
                        {category[0].toUpperCase() + category.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Location"
                  name="location"
                  value={editForm.location}
                  onChange={updateEditField}
                  maxLength={120}
                  required
                />
              </div>
              <div className="form-actions">
                <button
                  className="button button-quiet"
                  type="button"
                  onClick={() => setEditing(false)}
                >
                  Keep current report
                </button>
                <button
                  className="button button-primary"
                  disabled={saving}
                  type="submit"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          ) : (
            !detailLoading &&
            !detailError && (
              <>
                <div className="issue-description">
                  <span className="detail-label">DESCRIPTION</span>
                  <p>{issue.description}</p>
                </div>
                {(detail?.image || issue.image)?.url && (
                  <a
                    className="issue-image-link"
                    href={(detail?.image || issue.image).url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      className="issue-image"
                      src={(detail?.image || issue.image).url}
                      alt={`Photo attached to ${issue.title}`}
                      loading="lazy"
                    />
                  </a>
                )}
                <div className="issue-meta">
                  <span>
                    <small>Reported</small>
                    <strong><time dateTime={createdAt.toISOString()} title={relativeDate}>{date} ({relativeDate})</time></strong>
                  </span>
                  <span>
                    <small>Priority</small>
                    <PriorityBadge priority={issue.priority} />
                  </span>
                  <span>
                    <small>Location</small>
                    <strong>{issue.location}</strong>
                  </span>
                  <span>
                    <small>Age / resolution target</small>
                    <strong>
                      {formatIssueAge(issue.sla?.ageHours)} /{" "}
                      {issue.sla?.targetHours ?? "—"} hours
                    </strong>
                  </span>
                </div>
                {issue.sla?.isOverdue && (
                  <p className="sla-indicator overdue" role="status">
                    Overdue · target was{" "}
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(issue.sla.dueAt))}
                  </p>
                )}
                <p className="resolution-note">
                  <strong>Resolution notes</strong>
                  <span>
                    {issue.resolutionNotes || "No resolution notes yet."}
                  </span>
                </p>
                <IssueTimeline activity={detail?.activity || []} />
                {staff && (
                  <StaffIssueControls
                    issue={issue}
                    notes={notes}
                    setNotes={setNotes}
                    updating={updating}
                    onUpdate={onUpdate}
                  />
                )}
                {student && (
                  <div className="issue-actions">
                    <button
                      className="button button-secondary"
                      onClick={() => {
                        setActionError("");
                        setEditing(true);
                      }}
                      disabled={saving}
                    >
                      Edit report
                    </button>
                    <button
                      className="button button-danger-quiet"
                      onClick={cancelReport}
                      disabled={saving}
                    >
                      {saving ? "Cancelling…" : "Cancel report"}
                    </button>
                  </div>
                )}
              </>
            )
          )}
        </div>
      )}
    </article>
  );
}

function formatIssueAge(ageHours = 0) {
  if (ageHours < 1) return `${Math.max(0, Math.round(ageHours * 60))} min`;
  if (ageHours < 24) return `${ageHours} hours`;
  return `${Math.floor(ageHours / 24)} days`;
}

export function IssueTimeline({ activity }) {
  if (!activity.length)
    return (
      <div className="timeline-empty">
        No activity history is available for this issue yet.
      </div>
    );
  return (
    <section className="issue-timeline" aria-label="Issue activity history">
      <h3>Activity history</h3>
      <ol>
        {activity.map((entry) => (
          <li key={entry._id || `${entry.action}-${entry.changedAt}`}>
            <span className="timeline-marker" aria-hidden="true" />
            <div>
              <strong>
                {entry.action === "reported"
                  ? "Issue reported"
                  : `Status changed: ${STATUS_LABELS[entry.fromStatus] || entry.fromStatus} → ${STATUS_LABELS[entry.toStatus] || entry.toStatus}`}
              </strong>
              <p>
                By {entry.actor?.name || "CampusFix user"} ·{" "}
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(entry.changedAt))}
              </p>
              {entry.note && <p className="timeline-note">{entry.note}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function StaffIssueControls({
  issue,
  notes,
  setNotes,
  updating,
  onUpdate,
}) {
  return (
    <div className="staff-controls">
      <div className="staff-control-row">
        <label className="status-control">
          <span>Update status</span>
          <select
            value={issue.status}
            disabled={updating}
            onChange={(event) =>
              onUpdate(issue, { status: event.target.value })
            }
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="status-control">
          <span>Priority</span>
          <select
            value={issue.priority}
            disabled={updating}
            onChange={(event) =>
              onUpdate(issue, { priority: event.target.value })
            }
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority[0].toUpperCase() + priority.slice(1)}
              </option>
            ))}
          </select>
        </label>
        {updating && <small className="saving-label">Saving…</small>}
      </div>
      <label className="field resolution-field">
        <span>Resolution notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={2000}
          rows="3"
          placeholder="Share what was done to resolve the issue…"
        />
      </label>
      <div className="form-actions">
        <button
          className="button button-secondary"
          disabled={updating || notes === (issue.resolutionNotes || "")}
          onClick={() => onUpdate(issue, { resolutionNotes: notes })}
        >
          Save resolution notes
        </button>
      </div>
    </div>
  );
}

export function PriorityBadge({ priority = "medium" }) {
  return (
    <span className={`priority-badge priority-${priority}`}>
      <i />
      {priority}
    </span>
  );
}

export function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${status}`}>
      <i />
      {STATUS_LABELS[status] || status}
    </span>
  );
}
