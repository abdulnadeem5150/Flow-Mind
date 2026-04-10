// ============================================================
//  src/services/aiService.js
//  Groq AI — 100% FREE, ultra-fast inference
//
//  Get your free key: https://console.groq.com/keys
//  Free tier: 14,400 req/day · 30 req/min · $0 forever
//  Model: llama-3.1-8b-instant (fast + high quality)
//
//  All 7 AI features:
//    1. generateSubtasks   — break task into steps + time estimate
//    2. analyzePriority    — score High / Medium / Low with reasoning
//    3. suggestAutomations — 3 workflow ideas with one-click create
//    4. draftEmail         — professional email notification copy
//    5. draftSlack         — Slack message with attachment block
//    6. executeAiAction    — called by workflow engine on trigger
//    7. contextChat        — full task-aware conversation
// ============================================================

const Groq = require('groq-sdk');

// ── Groq client (lazy init) ───────────────────────────────
let _client = null;

function getClient() {
  if (!_client) {
    const key = process.env.GROQ_API_KEY;
    if (!key) {
      throw new Error(
        'GROQ_API_KEY is not set in your .env file.\n' +
        '  → Get a FREE key at: https://console.groq.com/keys\n' +
        '  → Sign up with Google/GitHub, click API Keys, create one.\n' +
        '  → Free tier: 14,400 requests/day, no credit card needed.'
      );
    }
    _client = new Groq({ apiKey: key });
  }
  return _client;
}

// ── Core chat helper ──────────────────────────────────────
// systemMsg  : Groq system prompt (role + rules)
// userMsg    : the actual question / task
// maxTokens  : max response length
async function chat(systemMsg, userMsg, maxTokens = 600) {
  const client = getClient();
  const res = await client.chat.completions.create({
    model:       'llama-3.1-8b-instant',
    max_tokens:  maxTokens,
    temperature: 0.7,
    messages: [
      { role: 'system', content: systemMsg },
      { role: 'user',   content: userMsg   }
    ]
  });
  return res.choices[0].message.content.trim();
}

// ── Safe JSON parser ──────────────────────────────────────
// Strips markdown code fences that LLMs sometimes add
function parseJSON(raw) {
  try {
    const clean = raw
      .replace(/^```json\s*/im, '')
      .replace(/^```\s*/m,      '')
      .replace(/```\s*$/m,      '')
      .trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

// ── Provider info (sent to frontend) ─────────────────────
function providerInfo() {
  return {
    provider: 'groq',
    model:    'llama-3.1-8b-instant',
    free:     true
  };
}

// ═══════════════════════════════════════════════════════════
//  1. SUBTASK GENERATION
//     Input : taskTitle, taskDesc
//     Output: { subtasks[], estimated_hours, complexity, tip }
// ═══════════════════════════════════════════════════════════
async function generateSubtasks(taskTitle, taskDesc = '') {
  const ctx = taskDesc ? ` (${taskDesc})` : '';
  const raw = await chat(
    'You are a senior project manager. Break tasks into clear, actionable subtasks. ' +
    'You MUST respond with ONLY valid JSON. No markdown, no explanation, just the JSON object.',
    `Task: "${taskTitle}"${ctx}\n\n` +
    `Respond with ONLY this JSON (no other text):\n` +
    `{"subtasks":["step 1","step 2","step 3","step 4","step 5"],"estimated_hours":4,"complexity":"low","tip":"one actionable productivity tip"}`,
    700
  );
  const data = parseJSON(raw);
  if (!data) throw new Error(`Groq returned unparseable response. Raw: ${raw.slice(0, 200)}`);
  return {
    subtasks:        (data.subtasks || []).slice(0, 8).map(s => ({ title: String(s), completed: false })),
    estimated_hours: Number(data.estimated_hours) || 2,
    complexity:      ['low','medium','high'].includes(data.complexity) ? data.complexity : 'medium',
    tip:             String(data.tip || '')
  };
}

// ═══════════════════════════════════════════════════════════
//  2. PRIORITY RECOMMENDATION
//     Input : taskTitle, taskDesc, deadline
//     Output: { priority, score, reasoning, factors[], recommendation }
// ═══════════════════════════════════════════════════════════
async function analyzePriority(taskTitle, taskDesc = '', deadline = null) {
  const dlInfo = deadline ? ` Deadline: ${new Date(deadline).toDateString()}.` : '';
  const raw = await chat(
    'You are a project prioritization expert. Analyze task urgency and importance. ' +
    'You MUST respond with ONLY valid JSON. No markdown, no explanation, just the JSON object.',
    `Task: "${taskTitle}"${taskDesc ? ` — ${taskDesc}` : ''}.${dlInfo}\n\n` +
    `Respond with ONLY this JSON (no other text):\n` +
    `{"priority":"high","score":8,"reasoning":"Two sentence explanation here.","factors":["factor 1","factor 2","factor 3"],"recommendation":"One specific action to take."}`,
    500
  );
  const data = parseJSON(raw);
  if (!data) throw new Error(`Groq returned unparseable response. Raw: ${raw.slice(0, 200)}`);
  return {
    priority:       ['high','medium','low'].includes(data.priority) ? data.priority : 'medium',
    score:          Math.min(10, Math.max(1, Number(data.score) || 5)),
    reasoning:      String(data.reasoning      || ''),
    factors:        (data.factors || []).slice(0, 5).map(String),
    recommendation: String(data.recommendation || '')
  };
}

// ═══════════════════════════════════════════════════════════
//  3. AUTOMATION SUGGESTIONS
//     Input : taskTitle, taskDesc, existingWorkflows[]
//     Output: { workflows[{name,trigger,action,benefit}], summary }
// ═══════════════════════════════════════════════════════════
async function suggestAutomations(taskTitle, taskDesc = '', existingWorkflows = []) {
  const existing = existingWorkflows.length
    ? `Existing workflows: ${existingWorkflows.map(w => w.name).join(', ')}.`
    : 'No existing workflows.';
  const raw = await chat(
    'You are a workflow automation expert. Suggest practical automations that save time. ' +
    'Valid triggers: task-done, task-created, high-priority, task-overdue. ' +
    'Valid actions: notify, gpt-suggest, gpt-summary, gpt-email, gpt-slack, move-done. ' +
    'You MUST respond with ONLY valid JSON. No markdown, no explanation, just the JSON object.',
    `Task: "${taskTitle}"${taskDesc ? ` (${taskDesc})` : ''}. ${existing}\n\n` +
    `Suggest 3 NEW automation workflows. Respond with ONLY this JSON (no other text):\n` +
    `{"workflows":[{"name":"Workflow Name","trigger":"task-done","action":"gpt-email","benefit":"why this saves time"},{"name":"Name 2","trigger":"high-priority","action":"notify","benefit":"benefit here"},{"name":"Name 3","trigger":"task-created","action":"gpt-suggest","benefit":"benefit here"}],"summary":"One sentence overview."}`,
    800
  );
  const data = parseJSON(raw);
  if (!data) throw new Error(`Groq returned unparseable response. Raw: ${raw.slice(0, 200)}`);
  const validTriggers = ['task-done','task-created','high-priority','task-overdue'];
  const validActions  = ['notify','gpt-suggest','gpt-summary','gpt-email','gpt-slack','move-done'];
  return {
    workflows: (data.workflows || []).slice(0, 5).map(w => ({
      name:    String(w.name    || ''),
      trigger: validTriggers.includes(w.trigger) ? w.trigger : 'task-done',
      action:  validActions.includes(w.action)   ? w.action  : 'notify',
      benefit: String(w.benefit || '')
    })),
    summary: String(data.summary || '')
  };
}

// ═══════════════════════════════════════════════════════════
//  4A. DRAFT EMAIL NOTIFICATION
//      Input : task, event
//      Output: { to, subject, body }
// ═══════════════════════════════════════════════════════════
async function draftEmail(task, event = 'updated') {
  const raw = await chat(
    'You are a professional business communications writer. Write clear email notifications. ' +
    'You MUST respond with ONLY valid JSON. No markdown, no explanation, just the JSON object.',
    `Write an email for:\nTask: "${task.title}"\nEvent: ${event}\nPriority: ${task.priority || 'medium'}\n` +
    `Deadline: ${task.deadline ? new Date(task.deadline).toDateString() : 'Not set'}\n\n` +
    `Respond with ONLY this JSON (no other text):\n` +
    `{"to":"team@company.com","subject":"Task Update: task name","body":"Professional 3-4 sentence email body here."}`,
    450
  );
  const data = parseJSON(raw);
  if (!data) throw new Error(`Groq returned unparseable response. Raw: ${raw.slice(0, 200)}`);
  return {
    to:      String(data.to      || 'team@company.com'),
    subject: String(data.subject || `Task Update: ${task.title}`),
    body:    String(data.body    || '')
  };
}

// ═══════════════════════════════════════════════════════════
//  4B. DRAFT SLACK NOTIFICATION
//      Input : task, event
//      Output: { channel, message, attachment{title,text,color} }
// ═══════════════════════════════════════════════════════════
async function draftSlack(task, event = 'updated') {
  const raw = await chat(
    'You are a team communication expert. Write concise Slack messages. ' +
    'You MUST respond with ONLY valid JSON. No markdown, no explanation, just the JSON object.',
    `Write a Slack message for:\nTask: "${task.title}"\nEvent: ${event}\nPriority: ${task.priority || 'medium'}\n` +
    `Deadline: ${task.deadline ? new Date(task.deadline).toDateString() : 'Not set'}\n\n` +
    `Respond with ONLY this JSON (no other text):\n` +
    `{"channel":"#tasks","message":"1-2 sentence Slack message here.","attachment":{"title":"${task.title}","text":"Brief description.","color":"good"}}`,
    400
  );
  const data = parseJSON(raw);
  if (!data) throw new Error(`Groq returned unparseable response. Raw: ${raw.slice(0, 200)}`);
  return {
    channel:    String(data.channel    || '#tasks'),
    message:    String(data.message    || ''),
    attachment: {
      title: String(data.attachment?.title || task.title),
      text:  String(data.attachment?.text  || ''),
      color: ['good','warning','danger'].includes(data.attachment?.color)
               ? data.attachment.color : 'warning'
    }
  };
}

// ═══════════════════════════════════════════════════════════
//  5. WORKFLOW AI ACTION
//     Called by workflowEngine.js when a workflow fires
// ═══════════════════════════════════════════════════════════
async function executeAiAction(action, task) {
  switch (action) {
    case 'gpt-suggest':
      return chat(
        'You are a productivity coach. Give specific, actionable next-step suggestions. Be brief.',
        `The task "${task.title}" was just completed. Suggest the single best next task. 2 sentences max.`,
        200
      );
    case 'gpt-summary':
      return chat(
        'You are a professional status reporter. Write clear, concise summaries.',
        `One sentence status update: "${task.title}" is done. Category: ${task.category}. Priority: ${task.priority}.`,
        150
      );
    case 'gpt-email':
      return draftEmail(task, 'completed');
    case 'gpt-slack':
      return draftSlack(task, 'completed');
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════
//  6. CONTEXT-AWARE CHAT
//     Has full knowledge of user's tasks + workflows
// ═══════════════════════════════════════════════════════════
async function contextChat(message, allTasks = [], allWorkflows = []) {
  const taskList = allTasks.length
    ? allTasks.map(t =>
        `• ${t.title} [${t.status}, ${t.priority}, ${t.category}${
          t.deadline ? ', due ' + new Date(t.deadline).toLocaleDateString() : ''
        }]`
      ).join('\n')
    : 'No tasks yet.';

  const wfList = allWorkflows.length
    ? allWorkflows.map(w =>
        `• ${w.name}: when "${w.trigger}" → "${w.action}" (${w.active ? 'active' : 'paused'}, ran ${w.runs} times)`
      ).join('\n')
    : 'No workflows yet.';

  return chat(
    `You are FlowMind AI, a smart task management assistant powered by Groq + Llama 3.\n` +
    `You have full context of the user's tasks and workflows.\n` +
    `Be concise — max 3 sentences or a short bullet list.\n` +
    `Suggest workflow automations or prioritization strategies when relevant.\n` +
    `Today's date: ${new Date().toDateString()}.`,
    `USER'S TASKS:\n${taskList}\n\nUSER'S WORKFLOWS:\n${wfList}\n\nUser: ${message}`,
    500
  );
}

module.exports = {
  generateSubtasks,
  analyzePriority,
  suggestAutomations,
  draftEmail,
  draftSlack,
  executeAiAction,
  contextChat,
  providerInfo
};
