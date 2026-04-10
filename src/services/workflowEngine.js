// ============================================================
//  src/services/workflowEngine.js
//  Real workflow execution: trigger listeners + action executors
// ============================================================
const Workflow            = require('../models/Workflow');
const User                = require('../models/User');
const ai                  = require('./aiService');
const { sendEmail, sendSlack, sendWorkflowEmail } = require('./notificationService');

// ── MAIN TRIGGER ENTRY POINT ──────────────────────────────
// Called from task controller whenever a task changes state.
// Finds all active workflows for the user that match the trigger,
// then executes their actions.
async function fire(trigger, task, userId) {
  try {
    const workflows = await Workflow.find({ userId, active: true, trigger });
    if (!workflows.length) return;

    const user = await User.findById(userId).select('name email');
    if (!user) return;

    // Execute all matching workflows in parallel
    await Promise.allSettled(workflows.map(wf => executeWorkflow(wf, task, user)));
  } catch (err) {
    console.error('WorkflowEngine.fire error:', err.message);
  }
}

// ── EXECUTE A SINGLE WORKFLOW ─────────────────────────────
async function executeWorkflow(workflow, task, user) {
  console.log(`⚡  Workflow "${workflow.name}" fired [trigger: ${workflow.trigger}] → [action: ${workflow.action}]`);

  let result = 'executed';

  try {
    switch (workflow.action) {

      // ── Basic: in-app notification (logged) ──────────────
      case 'notify':
        result = `Notification: task "${task.title}" triggered "${workflow.name}"`;
        break;

      // ── GPT: suggest next task ────────────────────────────
      case 'gpt-suggest': {
        const suggestion = await ai.executeAiAction('gpt-suggest', task);
        result = suggestion;
        // Send as email if user has email configured
        await sendEmail({
          to:      user.email,
          subject: `FlowMind: Next step suggestion for "${task.title}"`,
          body:    `Hi ${user.name},\n\nYour task "${task.title}" was completed.\n\nGPT Suggestion:\n${suggestion}\n\nFlowMind`
        }).catch(() => {});
        break;
      }

      // ── GPT: generate summary ─────────────────────────────
      case 'gpt-summary': {
        const summary = await ai.executeAiAction('gpt-summary', task);
        result = summary;
        break;
      }

      // ── GPT: draft + SEND email ───────────────────────────
      case 'gpt-email': {
        const emailDraft = await ai.draftEmail(task, task.status === 'done' ? 'completed' : 'updated');
        await sendWorkflowEmail(user, task, emailDraft);
        result = `Email drafted and sent: "${emailDraft.subject}"`;
        break;
      }

      // ── GPT: draft + SEND Slack message ──────────────────
      case 'gpt-slack': {
        const slackDraft = await ai.draftSlack(task, task.status === 'done' ? 'completed' : 'updated');
        await sendSlack(slackDraft);
        result = `Slack message sent to ${slackDraft.channel}`;
        break;
      }

      // ── Auto: move task to Done ───────────────────────────
      case 'move-done': {
        const Task = require('../models/Task');
        await Task.findByIdAndUpdate(task._id, { status: 'done' });
        result = `Task automatically moved to Done`;
        break;
      }

      default:
        result = `Unknown action: ${workflow.action}`;
    }

    // Log the execution
    await Workflow.findByIdAndUpdate(workflow._id, {
      $inc: { runs: 1 },
      $push: {
        log: {
          $each:  [{ taskTitle: task.title, result, executedAt: new Date() }],
          $slice: -20   // keep only last 20 log entries
        }
      }
    });

    console.log(`   ✅ Action "${workflow.action}" completed: ${String(result).slice(0, 80)}`);
    return { success: true, result };

  } catch (err) {
    console.error(`   ❌ Action "${workflow.action}" failed: ${err.message}`);
    // Still increment runs, log the error
    await Workflow.findByIdAndUpdate(workflow._id, {
      $inc: { runs: 1 },
      $push: { log: { $each: [{ taskTitle: task.title, result: `ERROR: ${err.message}`, executedAt: new Date() }], $slice: -20 } }
    }).catch(() => {});
    return { success: false, error: err.message };
  }
}

module.exports = { fire };
