// ============================================================
//  src/controllers/workflowController.js
// ============================================================
const Workflow = require('../models/Workflow');

exports.getWorkflows = async (req, res) => {
  try {
    const workflows = await Workflow.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, count: workflows.length, data: workflows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createWorkflow = async (req, res) => {
  try {
    const { name, trigger, action } = req.body;
    if (!name || !trigger || !action)
      return res.status(400).json({ success: false, error: 'name, trigger, action required' });
    const wf = await Workflow.create({ userId: req.user._id, name: name.trim(), trigger, action });
    res.status(201).json({ success: true, data: wf });
  } catch (err) {
    if (err.name === 'ValidationError')
      return res.status(400).json({ success: false, error: Object.values(err.errors).map(e => e.message).join(', ') });
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.toggleWorkflow = async (req, res) => {
  try {
    const wf = await Workflow.findOne({ _id: req.params.id, userId: req.user._id });
    if (!wf) return res.status(404).json({ success: false, error: 'Not found' });
    wf.active = !wf.active;
    await wf.save();
    res.json({ success: true, data: wf });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteWorkflow = async (req, res) => {
  try {
    const wf = await Workflow.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!wf) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, message: 'Workflow deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getWorkflowLog = async (req, res) => {
  try {
    const wf = await Workflow.findOne({ _id: req.params.id, userId: req.user._id }).select('name log');
    if (!wf) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: wf.log });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
