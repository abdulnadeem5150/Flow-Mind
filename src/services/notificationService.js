// ============================================================
//  src/services/notificationService.js
//  Real email sending (Nodemailer) + Slack webhook integration
// ============================================================
const nodemailer = require('nodemailer');

// ── Email Transport ───────────────────────────────────────
let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host:   process.env.EMAIL_HOST   || 'smtp.gmail.com',
      port:   parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }
  return transporter;
}

// ── Send Email ────────────────────────────────────────────
async function sendEmail({ to, subject, body, html }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️  Email not configured — skipping send. Set EMAIL_USER and EMAIL_PASS in .env');
    return { skipped: true, reason: 'Email not configured' };
  }

  const mailOptions = {
    from:    process.env.EMAIL_FROM || `FlowMind <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text:    body,
    html:    html || buildEmailHTML(subject, body)
  };

  const info = await getTransporter().sendMail(mailOptions);
  console.log(`📧  Email sent to ${to}: ${info.messageId}`);
  return { sent: true, messageId: info.messageId };
}

// ── Send Slack Webhook ────────────────────────────────────
async function sendSlack({ channel, message, attachment }) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl.includes('YOUR/SLACK')) {
    console.warn('⚠️  Slack webhook not configured — skipping send. Set SLACK_WEBHOOK_URL in .env');
    return { skipped: true, reason: 'Slack not configured' };
  }

  const colorMap = { good: '#10b981', warning: '#f59e0b', danger: '#ef4444' };
  const payload = {
    channel: channel || '#tasks',
    username: 'FlowMind Bot',
    icon_emoji: ':robot_face:',
    text: message,
    ...(attachment && {
      attachments: [{
        title:     attachment.title,
        text:      attachment.text,
        color:     colorMap[attachment.color] || colorMap.warning,
        footer:    'FlowMind',
        ts:        Math.floor(Date.now() / 1000)
      }]
    })
  };

  const res = await fetch(webhookUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  });

  if (!res.ok) throw new Error(`Slack webhook failed: ${res.status} ${await res.text()}`);
  console.log(`💬  Slack message sent to ${channel}`);
  return { sent: true };
}

// ── Task Deadline Reminder Email ──────────────────────────
async function sendDeadlineReminder(user, task) {
  const daysUntil = task.deadline
    ? Math.ceil((new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  const subject = daysUntil <= 0
    ? `⚠️ Overdue: ${task.title}`
    : `⏰ Reminder: "${task.title}" due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`;

  const body = daysUntil <= 0
    ? `Hi ${user.name},\n\nYour task "${task.title}" was due on ${new Date(task.deadline).toDateString()} and is now overdue.\n\nCategory: ${task.category} | Priority: ${task.priority}\n\nPlease update its status in FlowMind.\n\nFlowMind`
    : `Hi ${user.name},\n\nThis is a reminder that your task "${task.title}" is due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''} on ${new Date(task.deadline).toDateString()}.\n\nCategory: ${task.category} | Priority: ${task.priority}\n\nLog in to FlowMind to update progress.\n\nFlowMind`;

  return sendEmail({ to: user.email, subject, body });
}

// ── Workflow Completion Email ─────────────────────────────
async function sendWorkflowEmail(user, task, emailDraft) {
  return sendEmail({
    to:      user.email,
    subject: emailDraft.subject,
    body:    emailDraft.body,
    html:    buildEmailHTML(emailDraft.subject, emailDraft.body)
  });
}

// ── HTML Email Template ───────────────────────────────────
function buildEmailHTML(subject, body) {
  const lines = body.replace(/\n/g, '<br>');
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;padding:40px 20px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#6366f1,#818cf8);padding:28px 32px">
      <div style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px">FlowMind</div>
      <div style="font-size:14px;color:rgba(255,255,255,0.8);margin-top:4px">AI Task & Workflow Dashboard</div>
    </div>
    <div style="padding:32px">
      <h2 style="font-size:18px;font-weight:600;color:#111;margin-bottom:16px">${subject}</h2>
      <p style="font-size:14px;color:#444;line-height:1.8">${lines}</p>
    </div>
    <div style="padding:16px 32px 24px;font-size:11px;color:#999;border-top:1px solid #eee">
      Sent by FlowMind · <a href="#" style="color:#6366f1">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { sendEmail, sendSlack, sendDeadlineReminder, sendWorkflowEmail };
