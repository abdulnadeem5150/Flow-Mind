// ============================================================
//  src/middleware/rateLimiter.js
// ============================================================
const rateLimit = require('express-rate-limit');

// General API limiter — 100 req per 15 min per IP
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message:  { success: false, error: 'Too many requests — try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders:   false
});

// Strict limiter for auth routes — 10 attempts per 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  message:  { success: false, error: 'Too many login attempts — try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders:   false
});

// AI routes — 30 GPT calls per 15 min per user
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      30,
  keyGenerator: (req) => req.user?.id || req.ip,
  message:  { success: false, error: 'AI rate limit reached — try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders:   false
});

module.exports = { apiLimiter, authLimiter, aiLimiter };
