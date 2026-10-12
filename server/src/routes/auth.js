const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validate, isEmail, isObject } = require('../middleware/validate');

const router = express.Router();
const authInput = validate(({ body }) => {
  const errors = [];
  if (!isObject(body)) return ['Request body must be a JSON object'];
  if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 80) errors.push('Name must be 2 to 80 characters');
  if (!isEmail(body.email)) errors.push('A valid email is required');
  if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) errors.push('Password must be 8 to 128 characters');
  return errors;
});

function createToken(user) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

router.post('/register', authInput, async (req, res) => {
  const { name, email, password } = req.body;
  const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), password, role: 'student' });
  res.status(201).json({ user: publicUser(user), token: createToken(user) });
});

router.post('/login', validate(({ body }) => {
  if (!isObject(body)) return ['Request body must be a JSON object'];
  const errors = [];
  if (!isEmail(body.email)) errors.push('A valid email is required');
  if (typeof body.password !== 'string' || !body.password) errors.push('Password is required');
  return errors;
}), async (req, res) => {
  const user = await User.findOne({ email: req.body.email.trim().toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(req.body.password))) {
    return res.status(401).json({ message: 'Email or password is incorrect' });
  }
  return res.json({ user: publicUser(user), token: createToken(user) });
});

module.exports = router;
