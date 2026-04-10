// ============================================================
//  src/middleware/auth.js — JWT verification middleware
// ============================================================
const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  // Accept token from Authorization header or cookie
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Not authenticated — please log in' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'User no longer exists' });
    }
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Session expired — please log in again' : 'Invalid token';
    return res.status(401).json({ success: false, error: msg });
  }
};

// Admin-only guard (use after protect)
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
};

module.exports = { protect, adminOnly };
