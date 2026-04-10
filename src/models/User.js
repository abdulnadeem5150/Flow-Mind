// ============================================================
//  src/models/User.js — User schema with bcrypt hashing
// ============================================================
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type:      String,
    required:  [true, 'Name is required'],
    trim:      true,
    maxlength: [80, 'Name max 80 chars']
  },
  email: {
    type:      String,
    required:  [true, 'Email is required'],
    unique:    true,
    lowercase: true,
    trim:      true,
    match:     [/^\S+@\S+\.\S+$/, 'Invalid email address']
  },
  password: {
    type:      String,
    required:  [true, 'Password is required'],
    minlength: [6, 'Password minimum 6 characters'],
    select:    false   // never returned in queries by default
  },
  role: {
    type:    String,
    enum:    ['user', 'admin'],
    default: 'user'
  },
  createdAt: {
    type:    Date,
    default: Date.now
  }
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare plain password with hashed
UserSchema.methods.matchPassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', UserSchema);
