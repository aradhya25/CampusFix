const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const previousJwtSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = 'test-secret-for-route-tests-only';
const app = require('../src/app');
const Issue = require('../src/models/Issue');
const User = require('../src/models/User');

const STATUSES = ['open', 'in-progress', 'resolved', 'closed'];
const fixtures = [
  { _id: 'issue1', title: 'Library light', description: 'The light above desk one flickers.', location: 'Library', status: 'open', category: 'facilities', priority: 'medium', createdBy: 'student1', createdAt: new Date('2025-04-04') },
  { _id: 'issue2', title: 'Lab network', description: 'Network access is down in the lab.', location: 'Lab', status: 'in-progress', category: 'it', priority: 'high', createdBy: 'student2', createdAt: new Date('2025-04-03') },
  { _id: 'issue3', title: 'Broken chair', description: 'A chair is broken in room 12.', location: 'Room 12', status: 'resolved', category: 'facilities', priority: 'low', createdBy: 'student1', createdAt: new Date('2025-04-02') },
  { _id: 'issue4', title: 'Hall cleanup', description: 'Please clean the east hall.', location: 'East hall', status: 'closed', category: 'cleanliness', priority: 'low', createdBy: 'student2', createdAt: new Date('2025-04-01') },
  { _id: 'issue5', title: 'Another light', description: 'A second library light is out.', location: 'Library', status: 'open', category: 'facilities', priority: 'medium', createdBy: 'student1', createdAt: new Date('2025-03-31') },
];

function matches(issue, filter) {
  if (filter.createdBy && issue.createdBy !== String(filter.createdBy)) return false;
  for (const field of ['status', 'category', 'priority']) {
    if (filter[field] && issue[field] !== filter[field]) return false;
  }
  if (filter.$or) {
    const found = filter.$or.some((condition) => {
      const field = Object.keys(condition)[0];
      const expression = new RegExp(condition[field].$regex, condition[field].$options);
      return expression.test(issue[field]);
    });
    if (!found) return false;
  }
  return true;
}

test('issue statistics and list queries enforce the API contract', async (t) => {
  const originals = {
    findById: User.findById,
    countDocuments: Issue.countDocuments,
    aggregate: Issue.aggregate,
    find: Issue.find,
  };
  const observed = { findFilters: [], statsMatches: [] };
  User.findById = (id) => ({
    select: async () => ({
      _id: id,
      id,
      name: id,
      email: `${id}@example.test`,
      role: id === 'staff1' ? 'staff' : 'student',
    }),
  });
  Issue.countDocuments = async (filter) => fixtures.filter((issue) => matches(issue, filter)).length;
  Issue.aggregate = async ([{ $match: filter }, { $group: { _id: groupField } }]) => {
    observed.statsMatches.push(filter);
    const counts = new Map();
    for (const issue of fixtures.filter((entry) => matches(entry, filter))) {
      const field = groupField.slice(1);
      counts.set(issue[field], (counts.get(issue[field]) || 0) + 1);
    }
    return [...counts].map(([_id, count]) => ({ _id, count }));
  };
  Issue.find = (filter) => {
    observed.findFilters.push(filter);
    const result = fixtures.filter((issue) => matches(issue, filter)).sort((a, b) => b.createdAt - a.createdAt);
    const query = {
      populate() { return this; },
      sort() { return this; },
      skip(value) { this.offset = value; return this; },
      limit(value) { this.pageLimit = value; return this; },
      then(resolve, reject) {
        return Promise.resolve(result.slice(this.offset, this.offset + this.pageLimit)).then(resolve, reject);
      },
    };
    return query;
  };

  t.after(() => {
    User.findById = originals.findById;
    Issue.countDocuments = originals.countDocuments;
    Issue.aggregate = originals.aggregate;
    Issue.find = originals.find;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  });

  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/issues`;
  const tokenFor = (id) => jwt.sign({ sub: id }, process.env.JWT_SECRET);
  const get = (path, id) => fetch(`${baseUrl}${path}`, {
    headers: id ? { Authorization: `Bearer ${tokenFor(id)}` } : {},
  });

  assert.equal((await get('/', null)).status, 401, 'issue endpoints require a bearer token');

  const staffStatsResponse = await get('/stats', 'staff1');
  assert.equal(staffStatsResponse.status, 200);
  const staffStats = await staffStatsResponse.json();
  assert.equal(staffStats.total, fixtures.length);
  assert.deepEqual(staffStats.byStatus, { open: 2, 'in-progress': 1, resolved: 1, closed: 1 });
  assert.equal(Object.values(staffStats.byStatus).reduce((sum, count) => sum + count, 0), staffStats.total);

  const studentStats = await (await get('/stats', 'student1')).json();
  assert.equal(studentStats.total, 3);
  assert.deepEqual(studentStats.byStatus, { open: 2, 'in-progress': 0, resolved: 1, closed: 0 });
  assert.equal(Object.values(studentStats.byStatus).reduce((sum, count) => sum + count, 0), studentStats.total);
  assert.deepEqual(observed.statsMatches[0], {});
  assert.equal(String(observed.statsMatches[2].createdBy), 'student1');

  for (const status of STATUSES) {
    const response = await get(`/?status=${encodeURIComponent(status)}`, 'staff1');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(body.issues.length > 0);
    assert.ok(body.issues.every((issue) => issue.status === status));
    assert.equal(body.pagination.total, fixtures.filter((issue) => issue.status === status).length);
  }
  const invalidStatus = await get('/?status=unknown', 'staff1');
  assert.equal(invalidStatus.status, 400);
  assert.match((await invalidStatus.json()).message, /status must be one of/);

  const pageResponse = await get('/?page=2&limit=2', 'staff1');
  const page = await pageResponse.json();
  assert.equal(pageResponse.status, 200);
  assert.equal(page.issues.length, 2);
  assert.deepEqual(page.pagination, { page: 2, limit: 2, total: 5, pages: 3 });
  assert.equal((await get('/?page=0', 'staff1')).status, 400);
  assert.equal((await get('/?page=1.5', 'staff1')).status, 400);
  assert.equal((await get('/?page=9007199254740991&limit=100', 'staff1')).status, 400);
  assert.equal((await get('/?limit=0', 'staff1')).status, 400);
  assert.equal((await get('/?limit=101', 'staff1')).status, 400);

  const titleSearch = await (await get('/?search=library&page=1&limit=1', 'staff1')).json();
  assert.equal(titleSearch.pagination.total, 2);
  assert.equal(titleSearch.issues.length, 1);
  assert.match(titleSearch.issues[0].title, /library/i);
  const descriptionSearch = await (await get('/?search=desk%20one%20flickers', 'staff1')).json();
  assert.equal(descriptionSearch.pagination.total, 1);
  assert.match(descriptionSearch.issues[0].description, /desk one flickers/i);

  const combinedSearch = await (await get('/?status=open&search=library&page=1&limit=1', 'student1')).json();
  assert.equal(combinedSearch.pagination.total, 2);
  assert.equal(combinedSearch.issues.length, 1);
  assert.equal(combinedSearch.issues[0].status, 'open');

  const searchQuery = '/?status=open&search=%28a%2B%29%2B%24&page=1&limit=1';
  const searchResponse = await get(searchQuery, 'student1');
  const searchBody = await searchResponse.json();
  assert.equal(searchResponse.status, 200);
  assert.ok(searchBody.issues.length <= 1);
  assert.equal(searchBody.pagination.total, 0);
  const combinedFilter = observed.findFilters.at(-1);
  assert.equal(combinedFilter.status, 'open');
  assert.equal(String(combinedFilter.createdBy), 'student1');
  assert.equal(combinedFilter.$or[0].title.$regex, '\\(a\\+\\)\\+\\$');

  const tooLongSearch = await get(`/?search=${'a'.repeat(101)}`, 'staff1');
  assert.equal(tooLongSearch.status, 400);
  const repeatedStatus = await get('/?status=open&status=closed', 'staff1');
  assert.equal(repeatedStatus.status, 400);

  const studentList = await (await get('/', 'student1')).json();
  assert.ok(studentList.issues.every((issue) => issue.createdBy === 'student1'));
  assert.deepEqual(observed.findFilters.at(-1).createdBy, 'student1');
  await get('/', 'staff1');
  assert.deepEqual(observed.findFilters.at(-1), {});
});
