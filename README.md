# FlowMind v2 — Production-Ready AI Task Dashboard

All 8 gaps fixed. Every feature fully implemented.

## What's fixed vs v1

| Gap | Status | Solution |
|-----|--------|----------|
| Real Database | ✅ Fixed | MongoDB + Mongoose with full schemas |
| Authentication | ✅ Fixed | JWT + bcrypt, per-user data isolation |
| AI Integration | ✅ Fixed | 4 structured GPT endpoints + context chat |
| Workflow Engine | ✅ Fixed | Real trigger listener + action executor |
| Real Notifications | ✅ Fixed | Nodemailer email + Slack webhooks |
| Frontend–Backend | ✅ Fixed | 100% API-driven, zero local state |
| Real-time/Automation | ✅ Fixed | node-cron deadline reminders daily at 8 AM |
| Security | ✅ Fixed | helmet, rate limiting, JWT auth middleware |

---

## Project Structure

```
flowmind-complete/
├── server.js                    ← Entry point
├── package.json
├── .env.example                 ← Copy → .env
├── config/
│   └── db.js                   ← MongoDB connection
├── src/
│   ├── models/
│   │   ├── User.js              ← User schema (bcrypt)
│   │   ├── Task.js              ← Task schema (per-user)
│   │   └── Workflow.js          ← Workflow schema (per-user)
│   ├── middleware/
│   │   ├── auth.js              ← JWT protect middleware
│   │   └── rateLimiter.js       ← express-rate-limit configs
│   ├── controllers/
│   │   ├── authController.js    ← Register / Login / Me
│   │   ├── taskController.js    ← CRUD + workflow triggers
│   │   ├── workflowController.js← CRUD + toggle + log
│   │   └── aiController.js      ← 4 GPT features + chat
│   ├── services/
│   │   ├── aiService.js         ← All OpenAI calls + prompts
│   │   ├── notificationService.js← Nodemailer + Slack webhook
│   │   └── workflowEngine.js    ← Trigger → Action executor
│   ├── routes/
│   │   └── index.js             ← All API routes
│   └── jobs/
│       └── cronJobs.js          ← Deadline reminders cron
├── database/
│   └── seed.js                  ← Demo data seeder
└── public/
    ├── index.html               ← Dashboard + auth UI
    ├── style.css                ← All styles
    └── app.js                   ← API-driven frontend
```

---

## Setup — Step by Step

### 1. Install MongoDB

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```

**Windows:** Download from https://www.mongodb.com/try/download/community

**Linux (Ubuntu):**
```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl start mongod
```

**Or use MongoDB Atlas (cloud, free tier):**
1. Go to https://www.mongodb.com/atlas
2. Create free cluster
3. Get connection string → paste as MONGODB_URI in .env

### 2. Install Node.js dependencies

```bash
cd flowmind-complete
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
MONGODB_URI=mongodb://localhost:27017/flowmind
JWT_SECRET=generate-a-long-random-string-here
OPENAI_API_KEY=sk-proj-your-key-here

# Email (Gmail example — use App Password)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@gmail.com
EMAIL_PASS=your-16-char-app-password

# Slack webhook
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Gmail App Password:**
1. Go to myaccount.google.com/security
2. Enable 2-Step Verification
3. Search "App passwords" → create one for "Mail"
4. Use the 16-character password as EMAIL_PASS

**Slack Webhook:**
1. Go to api.slack.com/apps
2. Create App → Incoming Webhooks → Activate → Add to workspace
3. Copy the webhook URL

### 4. Seed demo data (optional)

```bash
node database/seed.js
# Creates: demo@flowmind.app / password123
```

### 5. Start the server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

### 6. Open the app

Go to **http://localhost:3000**

Login with `demo@flowmind.app` / `password123`
or register a new account.

---

## API Reference

### Auth
| Method | Endpoint | Body |
|--------|----------|------|
| POST | /api/auth/register | `{name, email, password}` |
| POST | /api/auth/login | `{email, password}` |
| GET  | /api/auth/me | — (JWT required) |

All protected routes require: `Authorization: Bearer <token>`

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/tasks | List (filter: ?status= ?category=) |
| POST | /api/tasks | Create |
| PUT | /api/tasks/:id | Update |
| PATCH | /api/tasks/:id/status | Status update (drag-drop) |
| DELETE | /api/tasks/:id | Delete |
| GET | /api/tasks/export/csv | Download CSV |

### AI Endpoints
| Method | Endpoint | Body |
|--------|----------|------|
| POST | /api/ai/subtasks | `{taskTitle, taskDesc}` |
| POST | /api/ai/priority | `{taskTitle, taskDesc, deadline}` |
| POST | /api/ai/automation | `{taskTitle, taskDesc}` |
| POST | /api/ai/notify | `{taskTitle, taskDesc, priority}` |
| POST | /api/ai/chat | `{message}` |

### Workflows
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/workflows | List |
| POST | /api/workflows | Create |
| PATCH | /api/workflows/:id/toggle | Toggle active |
| DELETE | /api/workflows/:id | Delete |
| GET | /api/workflows/:id/log | Execution log |

---

## Workflow Engine

When you update a task, the engine automatically:

1. Finds all active workflows for that user matching the trigger
2. Executes the action:
   - `gpt-email` → GPT drafts + Nodemailer sends
   - `gpt-slack` → GPT drafts + Slack webhook sends
   - `gpt-suggest` → GPT suggests next task, sends email
   - `gpt-summary` → GPT writes status summary
   - `move-done` → Task auto-moved to Done in DB
3. Logs execution in `workflow.log[]`

---

## Cron Jobs

- **Daily 8 AM**: Deadline reminders sent by email for tasks due within 24h
- **Hourly**: Analytics snapshot logged to console

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Ctrl+K | New Task |
| Escape | Close modal |
| Drag card | Move between columns |
