import {
  STATUSES,
  CATEGORIES,
  PRIORITIES,
  STATUS_LABELS,
} from "../../constants/issueOptions";

export default function IssueFilters({
  draft,
  onDraftChange,
  onApply,
  staff = false,
}) {
  function updateField(name, value) {
    onDraftChange((current) => ({ ...current, [name]: value }));
  }

  return (
    <form
      className={`filter-bar ${staff ? "staff-filter-bar" : "student-filter-bar"}`}
      onSubmit={onApply}
    >
      <label className="search-field">
        <span className="sr-only">
          {staff ? "Search issues" : "Search your issues"}
        </span>
        <span className="search-icon">🔍</span>
        <input
          value={draft.search}
          onChange={(event) => updateField("search", event.target.value)}
          maxLength={100}
          placeholder={
            staff
              ? "Search title, description, location..."
              : "Search your reports..."
          }
        />
      </label>
      <label className="filter-select">
        <span className="sr-only">Filter by status</span>
        <select
          value={draft.status}
          onChange={(event) => updateField("status", event.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-select">
        <span className="sr-only">Filter by category</span>
        <select
          value={draft.category}
          onChange={(event) => updateField("category", event.target.value)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category[0].toUpperCase() + category.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-select">
        <span className="sr-only">Filter by priority</span>
        <select
          value={draft.priority}
          onChange={(event) => updateField("priority", event.target.value)}
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority[0].toUpperCase() + priority.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-select">
        <span className="sr-only">
          {staff ? "Sort issue queue" : "Sort reports"}
        </span>
        <select
          value={draft.sort}
          onChange={(event) => updateField("sort", event.target.value)}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="priority">Highest priority</option>
        </select>
      </label>
      <button className="button button-secondary filter-button" type="submit">
        {staff ? "Apply filters" : "Apply"}
      </button>
    </form>
  );
}
