require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const issueRoutes = require('./routes/issues');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((origin) => origin.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '20kb' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'campusfix-api' }));
app.use('/api/auth', authRoutes);
app.use('/api/issues', issueRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
