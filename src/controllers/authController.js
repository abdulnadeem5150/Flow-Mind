// ============================================================
//  src/controllers/authController.js
//  Register, Login, Get current user, Logout
// ============================================================
const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// Helper: sign JWT
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });

// Helper: send token in response
const sendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  res.status(statusCode).json({
    success: true,
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role }
  });
};

// ── POST /api/auth/register ───────────────────────────────
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ success: false, error: 'Name, email and password are required' });

    if (password.length < 6)
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists)
      return res.status(409).json({ success: false, error: 'Email already registered' });

    const user = await User.create({ name: name.trim(), email: email.toLowerCase().trim(), password });
    sendToken(user, 201, res);
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ success: false, error: 'Email already registered' });
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/auth/login ──────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, error: 'Email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, error: 'Invalid email or password' });

    sendToken(user, 200, res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET /api/auth/me ──────────────────────────────────────
exports.getMe = async (req, res) => {
  res.json({
    success: true,
    user: { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role }
  });
};

// ── POST /api/auth/logout ─────────────────────────────────
exports.logout = (req, res) => {
  res.json({ success: true, message: 'Logged out — clear your token client-side' });
};
