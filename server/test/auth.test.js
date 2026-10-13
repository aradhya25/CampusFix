const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const User = require('../src/models/User');

test('public registration always creates a student and login verifies credentials', async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'auth-route-tests-only-secret';
  const originals = { create: User.create, findOne: User.findOne };
  const created = [];
  const account = {
    id: 'student-1', name: 'Test Student', email: 'student@example.test', role: 'student',
    comparePassword: async (password) => password === 'password123',
  };
  User.create = async (data) => {
    created.push(data);
    return { ...account, ...data, id: account.id };
  };
  User.findOne = (filter) => ({
    select: async () => filter.email === account.email ? account : null,
  });
  t.after(() => {
    User.create = originals.create;
    User.findOne = originals.findOne;
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise((resolve) => server.once('listening', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/api/auth`;

  const registration = await fetch(`${endpoint}/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: account.name, email: account.email, password: 'password123', role: 'staff' }),
  });
  assert.equal(registration.status, 201);
  const registered = await registration.json();
  assert.equal(registered.user.role, 'student');
  assert.equal(created[0].role, 'student');
  assert.equal(jwt.verify(registered.token, process.env.JWT_SECRET).sub, account.id);

  const login = await fetch(`${endpoint}/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: 'password123' }),
  });
  assert.equal(login.status, 200);
  assert.equal((await login.json()).user.id, account.id);

  const rejectedLogin = await fetch(`${endpoint}/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: 'wrong-password' }),
  });
  assert.equal(rejectedLogin.status, 401);
});
