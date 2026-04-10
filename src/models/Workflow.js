// ============================================================
//  src/models/Workflow.js — Workflow schema (per-user)
// ============================================================
const mongoose = require('mongoose');

const WorkflowSchema = new mongoose.Schema({
  userId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    index:    true
  },
  name: {
    type:      String,
    required:  [true, 'Name is required'],
    trim:      true,
    maxlength: [200, 'Name max 200 chars']
  },
  trigger: {
    type: String,
    enum: ['task-done', 'task-created', 'high-priority', 'task-overdue'],
    required: true
  },
  action: {
    type: String,
    enum: ['notify', 'gpt-suggest', 'gpt-summary', 'gpt-email', 'gpt-slack', 'move-done'],
    required: true
  },
  active: {
    type:    Boolean,
    default: true
  },
  runs: {
    type:    Number,
    default: 0
  },
  // Execution log (last 20 entries)
  log: [{
    taskTitle:  String,
    result:     String,
    executedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

WorkflowSchema.index({ userId: 1, active: 1, trigger: 1 });

module.exports = mongoose.model('Workflow', WorkflowSchema);
