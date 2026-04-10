// ============================================================
//  src/routes/index.js — All API routes
// ============================================================
const express  = require('express');
const router   = express.Router();

const { protect }        = require('../middleware/auth');
const { authLimiter, aiLimiter } = require('../middleware/rateLimiter');

const auth      = require('../controllers/authController');
const tasks     = require('../controllers/taskController');
const workflows = require('../controllers/workflowController');
const ai        = require('../controllers/aiController');

// ── Auth ──────────────────────────────────────────────────
router.post('/auth/register', authLimiter, auth.register);
router.post('/auth/login',    authLimiter, auth.login);
router.get ('/auth/me',       protect,     auth.getMe);
router.post('/auth/logout',   protect,     auth.logout);

// ── Tasks (all protected) ─────────────────────────────────
router.get ('/tasks/export/csv',     protect, tasks.exportCSV);
router.get ('/tasks',                protect, tasks.getTasks);
router.get ('/tasks/:id',            protect, tasks.getTask);
router.post('/tasks',                protect, tasks.createTask);
router.put ('/tasks/:id',            protect, tasks.updateTask);
router.patch('/tasks/:id/status',    protect, tasks.updateStatus);
router.delete('/tasks/:id',          protect, tasks.deleteTask);

// ── Analytics ─────────────────────────────────────────────
router.get('/analytics', protect, tasks.getAnalytics);

// ── Workflows ─────────────────────────────────────────────
router.get   ('/workflows',           protect, workflows.getWorkflows);
router.post  ('/workflows',           protect, workflows.createWorkflow);
router.patch ('/workflows/:id/toggle',protect, workflows.toggleWorkflow);
router.delete('/workflows/:id',       protect, workflows.deleteWorkflow);
router.get   ('/workflows/:id/log',   protect, workflows.getWorkflowLog);

// ── AI (rate-limited separately) ─────────────────────────
router.get ('/ai/provider',    protect,            ai.getProvider);
router.post('/ai/subtasks',    protect, aiLimiter, ai.generateSubtasks);
router.post('/ai/priority',    protect, aiLimiter, ai.analyzePriority);
router.post('/ai/automation',  protect, aiLimiter, ai.suggestAutomations);
router.post('/ai/notify',      protect, aiLimiter, ai.draftNotifications);
router.post('/ai/chat',        protect, aiLimiter, ai.chat);

// ── Health check ──────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    ai: {
      provider: 'groq',
      model:    'llama-3.1-8b-instant',
      free:     true,
      keySet:   !!process.env.GROQ_API_KEY
    },
    email: !!process.env.EMAIL_USER,
    slack: !!(process.env.SLACK_WEBHOOK_URL && !process.env.SLACK_WEBHOOK_URL.includes('YOUR'))
  });
});
});

module.exports = router;
