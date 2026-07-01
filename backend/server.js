// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const { router: authRouter } = require('./routes/auth');
const consignmentsRouter = require('./routes/consignments');
const pdfRouter = require('./routes/pdf');

const app = express();
const PORT = process.env.PORT || 4000;

// Tell Express to trust the proxy headers set by Render 
// so express-rate-limit can accurately detect client IP addresses.
app.set('trust proxy', 1);

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set in your .env file. Refusing to start.');
  process.exit(1);
}

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
}));
app.use(express.json({ limit: '2mb' }));

// Basic rate limiting on login to slow down brute-force attempts.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts. Please try again later.' },
});
app.use('/api/auth/login', loginLimiter);

app.use('/api/auth', authRouter);
app.use('/api/consignments', consignmentsRouter);
app.use('/api/pdf', pdfRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Mahadev Cargo Movers API' });
});

// Serve the frontend (static files) in production / single-server deploys.
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`Mahadev Cargo Movers server running on http://localhost:${PORT}`);
});
