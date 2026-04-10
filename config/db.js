// ============================================================
//  config/db.js — MongoDB connection via Mongoose
// ============================================================
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅  MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`❌  MongoDB connection failed: ${err.message}`);
    console.error('    Make sure MongoDB is running and MONGODB_URI is set in .env');
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️   MongoDB disconnected');
});

module.exports = connectDB;
