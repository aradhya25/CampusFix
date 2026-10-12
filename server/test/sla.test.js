const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_TARGETS_HOURS, getTargetsHours, calculateSla } = require('../src/utils/sla');

test('SLA targets have safe defaults and accept positive environment overrides', () => {
  assert.deepEqual(getTargetsHours({}), DEFAULT_TARGETS_HOURS);
  assert.deepEqual(getTargetsHours({ SLA_TARGET_URGENT_HOURS: '2.5', SLA_TARGET_LOW_HOURS: '-1' }), {
    urgent: 2.5, high: 24, medium: 72, low: 120,
  });
});

test('SLA age, due date and overdue status use issue creation time and priority', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const now = new Date('2026-01-02T01:00:00.000Z');
  const sla = calculateSla({ createdAt, priority: 'high', status: 'in-progress' }, now);
  assert.equal(sla.targetHours, 24);
  assert.equal(sla.ageHours, 25);
  assert.equal(sla.dueAt.toISOString(), '2026-01-02T00:00:00.000Z');
  assert.equal(sla.isOverdue, true);
});

test('resolved and closed issues are not marked overdue', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const now = new Date('2026-02-01T00:00:00.000Z');
  for (const status of ['resolved', 'closed']) {
    assert.equal(calculateSla({ createdAt, priority: 'urgent', status }, now).isOverdue, false);
  }
});
