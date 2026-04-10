// ============================================================
//  src/jobs/cronJobs.js
//  Background cron jobs: deadline reminders + overdue triggers
// ============================================================
const cron      = require('node-cron');
const Task      = require('../models/Task');
const User      = require('../models/User');
const engine    = require('../services/workflowEngine');
const { sendDeadlineReminder } = require('../services/notificationService');

// ── JOB 1: Deadline Reminder ──────────────────────────────
// Runs every day at 8:00 AM
// Sends email reminders for tasks due in 1 day or overdue
const deadlineReminder = cron.schedule('0 8 * * *', async () => {
  console.log('🕐  [CRON] Running deadline reminder job...');
  const now      = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  try {
    // Find all non-done tasks with deadlines in the next 24h or already past
    const tasks = await Task.find({
      status:   { $ne: 'done' },
      deadline: { $ne: null, $lte: tomorrow },
      // Only remind once per day
      $or: [
        { reminderSentAt: { $exists: false } },
        { reminderSentAt: { $lt: new Date(now.setHours(0,0,0,0)) } }
      ]
    }).populate('userId', 'name email');

    console.log(`   Found ${tasks.length} tasks needing reminders`);

    for (const task of tasks) {
      const user = task.userId;
      if (!user?.email) continue;

      // Send email reminder
      await sendDeadlineReminder(user, task).catch(e =>
        console.error(`   Reminder failed for task ${task._id}: ${e.message}`)
      );

      // Fire overdue workflow trigger if past deadline
      if (task.deadline < now) {
        await engine.fire('task-overdue', task, user._id);
      }

      // Mark reminder as sent
      await Task.findByIdAndUpdate(task._id, { reminderSentAt: new Date() });
    }

    console.log(`✅  [CRON] Deadline reminders done`);
  } catch (err) {
    console.error(`❌  [CRON] Deadline reminder job failed: ${err.message}`);
  }
}, { scheduled: false }); // start manually below

// ── JOB 2: Analytics snapshot (every hour) ───────────────
// In a real app, save stats to a separate collection for historical charts
const analyticsSnapshot = cron.schedule('0 * * * *', async () => {
  try {
    const total      = await Task.countDocuments();
    const done       = await Task.countDocuments({ status: 'done' });
    const inprogress = await Task.countDocuments({ status: 'inprogress' });
    console.log(`📊  [CRON] Analytics: ${total} tasks total, ${done} done, ${inprogress} in progress`);
  } catch (err) {
    console.error(`❌  [CRON] Analytics snapshot failed: ${err.message}`);
  }
}, { scheduled: false });

// ── Start all jobs ────────────────────────────────────────
function startJobs() {
  deadlineReminder.start();
  analyticsSnapshot.start();
  console.log('⏰  Background cron jobs started:');
  console.log('    • Deadline reminders: daily at 8:00 AM');
  console.log('    • Analytics snapshot: every hour');
}

function stopJobs() {
  deadlineReminder.stop();
  analyticsSnapshot.stop();
}

module.exports = { startJobs, stopJobs };
