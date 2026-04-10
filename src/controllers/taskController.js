// ============================================================
//  src/controllers/taskController.js
//  Full CRUD + workflow trigger firing on every state change
// ============================================================
const Task   = require('../models/Task');
const engine = require('../services/workflowEngine');

// ── GET /api/tasks ────────────────────────────────────────
exports.getTasks = async (req, res) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.status)   filter.status   = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.priority) filter.priority = req.query.priority;

    const tasks = await Task.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: tasks.length, data: tasks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET /api/tasks/:id ────────────────────────────────────
exports.getTask = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    res.json({ success: true, data: task });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── POST /api/tasks ───────────────────────────────────────
exports.createTask = async (req, res) => {
  try {
    const { title, desc, category, status, priority, deadline, gptEnhanced, subtasks, aiAnalysis } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, error: 'Title is required' });

    const task = await Task.create({
      userId:      req.user._id,
      title:       title.trim(),
      desc:        desc?.trim() || '',
      category:    category    || 'Other',
      status:      status      || 'todo',
      priority:    priority    || 'medium',
      deadline:    deadline    || null,
      gptEnhanced: !!gptEnhanced,
      subtasks:    subtasks    || [],
      aiAnalysis:  aiAnalysis  || undefined
    });

    // Fire workflow triggers for newly created task
    await engine.fire('task-created', task, req.user._id);
    if (task.priority === 'high') {
      await engine.fire('high-priority', task, req.user._id);
    }

    res.status(201).json({ success: true, data: task });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: Object.values(err.errors).map(e => e.message).join(', ') });
    }
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── PUT /api/tasks/:id ────────────────────────────────────
exports.updateTask = async (req, res) => {
  try {
    const existing = await Task.findOne({ _id: req.params.id, userId: req.user._id });
    if (!existing) return res.status(404).json({ success: false, error: 'Task not found' });

    const oldStatus = existing.status;
    const allowedFields = ['title','desc','category','status','priority','deadline','gptEnhanced','subtasks','aiAnalysis'];
    const updates = {};
    allowedFields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (updates.title) updates.title = updates.title.trim();

    const task = await Task.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });

    // Fire workflow triggers based on what changed
    if (updates.status && updates.status !== oldStatus) {
      if (updates.status === 'done') {
        await engine.fire('task-done', task, req.user._id);
      }
    }
    if (updates.priority === 'high' && existing.priority !== 'high') {
      await engine.fire('high-priority', task, req.user._id);
    }

    res.json({ success: true, data: task });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: Object.values(err.errors).map(e => e.message).join(', ') });
    }
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── PATCH /api/tasks/:id/status (drag-drop shortcut) ─────
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['todo','inprogress','done'];
    if (!validStatuses.includes(status))
      return res.status(400).json({ success: false, error: 'Invalid status' });

    const existing = await Task.findOne({ _id: req.params.id, userId: req.user._id });
    if (!existing) return res.status(404).json({ success: false, error: 'Task not found' });

    const task = await Task.findByIdAndUpdate(req.params.id, { status }, { new: true });

    if (status === 'done' && existing.status !== 'done') {
      await engine.fire('task-done', task, req.user._id);
    }

    res.json({ success: true, data: task });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── DELETE /api/tasks/:id ─────────────────────────────────
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET /api/tasks/export/csv ─────────────────────────────
exports.exportCSV = async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user._id }).sort({ createdAt: -1 });
    const header = 'ID,Title,Description,Category,Status,Priority,Deadline,GPT Enhanced,Created\n';
    const rows   = tasks.map(t =>
      `${t._id},"${(t.title||'').replace(/"/g,'""')}","${(t.desc||'').replace(/"/g,'""')}",${t.category},${t.status},${t.priority},${t.deadline ? t.deadline.toISOString().slice(0,10) : ''},${t.gptEnhanced},${t.createdAt.toISOString()}`
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=flowmind-tasks-${Date.now()}.csv`);
    res.send(header + rows);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET /api/analytics ────────────────────────────────────
exports.getAnalytics = async (req, res) => {
  try {
    const uid   = req.user._id;
    const total = await Task.countDocuments({ userId: uid });
    const done  = await Task.countDocuments({ userId: uid, status: 'done' });
    const inprogress = await Task.countDocuments({ userId: uid, status: 'inprogress' });
    const todo  = await Task.countDocuments({ userId: uid, status: 'todo' });

    const cats  = ['Design','Engineering','Marketing','Research','Other'];
    const byCategory = {};
    await Promise.all(cats.map(async c => {
      byCategory[c] = await Task.countDocuments({ userId: uid, category: c });
    }));

    const byPriority = {};
    await Promise.all(['low','medium','high'].map(async p => {
      byPriority[p] = await Task.countDocuments({ userId: uid, priority: p });
    }));

    const now      = new Date();
    const overdue  = await Task.countDocuments({ userId: uid, status: { $ne: 'done' }, deadline: { $lt: now } });
    const dueToday = await Task.countDocuments({
      userId: uid, status: { $ne: 'done' },
      deadline: { $gte: new Date(now.setHours(0,0,0,0)), $lte: new Date(now.setHours(23,59,59,999)) }
    });

    res.json({
      success: true,
      data: {
        total, done, inprogress, todo,
        completionRate: total ? Math.round(done / total * 100) : 0,
        byCategory, byPriority, overdue, dueToday
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
