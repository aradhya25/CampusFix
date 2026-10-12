const DEFAULT_TARGETS_HOURS = Object.freeze({ urgent: 4, high: 24, medium: 72, low: 120 });
const ACTIVE_STATUSES = new Set(['open', 'in-progress']);

function getTargetsHours(env = process.env) {
  return Object.fromEntries(Object.entries(DEFAULT_TARGETS_HOURS).map(([priority, fallback]) => {
    const configured = Number(env[`SLA_TARGET_${priority.toUpperCase()}_HOURS`]);
    return [priority, Number.isFinite(configured) && configured > 0 ? configured : fallback];
  }));
}

function calculateSla(issue, now = new Date(), targetsHours = getTargetsHours()) {
  const createdAt = new Date(issue.createdAt);
  const targetHours = targetsHours[issue.priority] || targetsHours.medium;
  const dueAt = new Date(createdAt.getTime() + targetHours * 60 * 60 * 1000);
  const ageHours = Math.max(0, (now.getTime() - createdAt.getTime()) / (60 * 60 * 1000));
  return {
    ageHours: Math.round(ageHours * 10) / 10,
    targetHours,
    dueAt,
    isOverdue: ACTIVE_STATUSES.has(issue.status) && now.getTime() > dueAt.getTime(),
  };
}

module.exports = { DEFAULT_TARGETS_HOURS, getTargetsHours, calculateSla };
