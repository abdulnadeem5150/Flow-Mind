// ============================================================
//  FlowMind — server.js
//  Run:  node server.js   |   Dev:  npm run dev
//  Open: http://localhost:3000
// ============================================================
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const connectDB  = require('./config/db');
const routes     = require('./src/routes/index');
const { startJobs } = require('./src/jobs/cronJobs');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Static files ──────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── API routes ────────────────────────────────────────────
app.use('/api', routes);

// ── SPA fallback ──────────────────────────────────────────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// ── Global error handler ──────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ success: false, error: err.message });
});

// ── Start ─────────────────────────────────────────────────
const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║         FlowMind v2 is running!          ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log(`\n  🌍  Open:    http://localhost:${PORT}`);
    console.log(`  🔌  Health:  http://localhost:${PORT}/api/health`);
    console.log(`  🗄️   DB:      ${process.env.MONGODB_URI || 'not set'}`);
    console.log(`  🤖  AI:      ${process.env.GROQ_API_KEY ? '✅ Groq (llama-3.1-8b-instant) — FREE' : '❌ GROQ_API_KEY not set in .env — get free key at console.groq.com'}`);
    console.log(`  📧  Email:   ${process.env.EMAIL_USER    ? '✅ configured' : '⚠️  not set (optional)'}`);
    console.log(`  💬  Slack:   ${process.env.SLACK_WEBHOOK_URL && !process.env.SLACK_WEBHOOK_URL.includes('YOUR') ? '✅ configured' : '⚠️  not set (optional)'}`);
    console.log('');
  });
  if (process.env.NODE_ENV !== 'test') startJobs();
};

start().catch(err => {
  console.error('❌  Failed to start:', err.message);
  process.exit(1);
});

module.exports = app;
