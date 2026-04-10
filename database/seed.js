// ============================================================
//  database/seed.js — Seed demo user + tasks + workflows
//  Run:  node database/seed.js
// ============================================================
require('dotenv').config();
const mongoose = require('mongoose');
const User     = require('../src/models/User');
const Task     = require('../src/models/Task');
const Workflow = require('../src/models/Workflow');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB...');

  // Clear existing data
  await Promise.all([User.deleteMany(), Task.deleteMany(), Workflow.deleteMany()]);
  console.log('Cleared existing data');

  // Create demo user
  const user = await User.create({
    name:     'Demo User',
    email:    'demo@flowmind.app',
    password: 'password123',
    role:     'user'
  });
  console.log(`Created user: ${user.email} / password123`);

  // Create tasks
  await Task.insertMany([
    { userId: user._id, title: 'Design new landing page',   desc: 'Redesign hero section and CTA buttons', category: 'Design',      status: 'inprogress', priority: 'high',   deadline: new Date('2026-04-10'), gptEnhanced: false },
    { userId: user._id, title: 'Set up CI/CD pipeline',     desc: 'Configure GitHub Actions for auto-deploy', category: 'Engineering', status: 'todo',       priority: 'medium', deadline: new Date('2026-04-15'), gptEnhanced: false },
    { userId: user._id, title: 'Write Q2 marketing brief',  desc: '', category: 'Marketing', status: 'todo', priority: 'low', deadline: new Date('2026-04-20'), gptEnhanced: false },
    { userId: user._id, title: 'User research interviews',  desc: 'Conduct 5 interviews for feedback', category: 'Research', status: 'done', priority: 'high', deadline: new Date('2026-04-05'), gptEnhanced: true },
    { userId: user._id, title: 'Fix auth token expiry bug', desc: 'JWT tokens expiring too early', category: 'Engineering', status: 'inprogress', priority: 'high', deadline: new Date('2026-04-08'), gptEnhanced: false },
  ]);
  console.log('Created 5 tasks');

  // Create workflows
  await Workflow.insertMany([
    { userId: user._id, name: 'GPT email on task done',          trigger: 'task-done',     action: 'gpt-email', active: true,  runs: 2 },
    { userId: user._id, name: 'GPT Slack alert on high-priority',trigger: 'high-priority', action: 'gpt-slack', active: true,  runs: 1 },
    { userId: user._id, name: 'Auto-summarize on completion',    trigger: 'task-done',     action: 'gpt-summary', active: false, runs: 0 },
  ]);
  console.log('Created 3 workflows');

  console.log('\n✅  Seed complete!');
  console.log('   Login: demo@flowmind.app / password123');
  await mongoose.disconnect();
};

seed().catch(err => { console.error(err); process.exit(1); });
