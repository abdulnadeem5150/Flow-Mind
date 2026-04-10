// ============================================================
//  src/controllers/aiController.js
//  All AI endpoints — powered by Groq (FREE, ultra-fast)
// ============================================================
const ai       = require('../services/aiService');
const Task     = require('../models/Task');
const Workflow = require('../models/Workflow');

// GET /api/ai/provider — tells frontend which AI is active
exports.getProvider = (req, res) => {
  res.json({ success: true, data: ai.providerInfo() });
};

// POST /api/ai/subtasks
exports.generateSubtasks = async (req, res) => {
  try {
    const { taskTitle, taskDesc } = req.body;
    if (!taskTitle?.trim()) return res.status(400).json({ success: false, error: 'taskTitle required' });
    const result = await ai.generateSubtasks(taskTitle, taskDesc);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/ai/priority
exports.analyzePriority = async (req, res) => {
  try {
    const { taskTitle, taskDesc, deadline } = req.body;
    if (!taskTitle?.trim()) return res.status(400).json({ success: false, error: 'taskTitle required' });
    const result = await ai.analyzePriority(taskTitle, taskDesc, deadline);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/ai/automation
exports.suggestAutomations = async (req, res) => {
  try {
    const { taskTitle, taskDesc } = req.body;
    if (!taskTitle?.trim()) return res.status(400).json({ success: false, error: 'taskTitle required' });
    const userWorkflows = await Workflow.find({ userId: req.user._id }).select('name trigger action');
    const result = await ai.suggestAutomations(taskTitle, taskDesc, userWorkflows);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/ai/notify
exports.draftNotifications = async (req, res) => {
  try {
    const { taskTitle, taskDesc, deadline, priority, event } = req.body;
    if (!taskTitle?.trim()) return res.status(400).json({ success: false, error: 'taskTitle required' });
    const mockTask = { title: taskTitle, desc: taskDesc, deadline, priority: priority || 'medium', category: 'Other' };
    const [emailDraft, slackDraft] = await Promise.all([
      ai.draftEmail(mockTask, event || 'updated'),
      ai.draftSlack(mockTask,  event || 'updated')
    ]);
    res.json({ success: true, data: { email: emailDraft, slack: slackDraft } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/ai/chat
exports.chat = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, error: 'message required' });
    const [tasks, workflows] = await Promise.all([
      Task.find({ userId: req.user._id }).select('title status priority category deadline').lean(),
      Workflow.find({ userId: req.user._id }).select('name trigger action active runs').lean()
    ]);
    const reply = await ai.contextChat(message, tasks, workflows);
    res.json({ success: true, data: { reply } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
