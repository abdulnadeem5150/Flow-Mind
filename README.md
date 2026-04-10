# FlowMind — AI Task & Workflow Dashboard

> **Powered by Groq AI (100% Free) · MongoDB · Node.js · JWT Auth**

A full-stack task management dashboard with AI-powered subtask generation, priority scoring, workflow automation, and email/Slack notifications — all using **Groq's free API** (14,400 requests/day, no credit card).

---

## ✨ Features

| Feature | Details |
|---------|---------|
| 🤖 **Groq AI** | Subtask generation, priority scoring, automation suggestions, email/Slack drafts |
| 📋 **Kanban Board** | Drag-and-drop tasks across To-do / In Progress / Done |
| ⚡ **Workflow Engine** | Trigger real actions (email, Slack, AI suggestions) when tasks change |
| 🔐 **JWT Auth** | Register/login with per-user data isolation |
| 🗄️ **MongoDB** | Persistent storage with Mongoose schemas |
| 📧 **Email** | Nodemailer — sends real emails via Gmail SMTP |
| 💬 **Slack** | Webhook integration for team notifications |
| 📅 **Calendar View** | See tasks plotted by deadline |
| 📊 **Analytics** | Live completion rates and category breakdown |
| ⏰ **Cron Jobs** | Daily deadline reminders via email |
| 📥 **CSV Export** | Download all tasks as a spreadsheet |

---

## 🚀 Quick Start (5 minutes)

### 1. Install dependencies
```bash
npm install
```

### 2. Get your FREE Groq API key
1. Go to **https://console.groq.com/keys**
2. Sign up with Google or GitHub (free)
3. Click **"Create API Key"** → copy the key

### 3. Configure environment
```bash
cp .env.example .env
```
Edit `.env` — fill in at minimum:
```env
MONGODB_URI=mongodb://localhost:27017/flowmind
JWT_SECRET=your_long_random_secret_here
GROQ_API_KEY=gsk_your_groq_key_here
```

### 4. Generate JWT secret
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Paste the output as `JWT_SECRET` in `.env`

### 5. Seed demo data
```bash
node database/seed.js
```
Creates: `demo@flowmind.app` / `password123`

### 6. Start the server
```bash
npm run dev        # development (auto-reload)
npm start          # production
```

### 7. Open the app
```
http://localhost:3000
```

---

## 📁 Project Structure

```
flowmind/
├── server.js                      ← Express entry point
├── package.json
├── .env.example                   ← Copy to .env
├── .gitignore
├── README.md
│
├── config/
│   └── db.js                      ← MongoDB connection
│
├── database/
│   └── seed.js                    ← Demo data seeder
│
├── public/                        ← Frontend (served as static)
│   ├── index.html                 ← Dashboard + auth UI
│   ├── style.css                  ← All styles
│   └── app.js                     ← Frontend logic (API-driven)
│
└── src/
    ├── models/
    │   ├── User.js                ← User schema (bcrypt passwords)
    │   ├── Task.js                ← Task schema (per-user)
    │   └── Workflow.js            ← Workflow schema (per-user)
    │
    ├── controllers/
    │   ├── authController.js      ← Register / Login / Me
    │   ├── taskController.js      ← CRUD + workflow triggers
    │   ├── workflowController.js  ← CRUD + toggle + execution log
    │   └── aiController.js        ← All 5 Groq AI endpoints
    │
    ├── services/
    │   ├── aiService.js           ← Groq AI (all prompts + parsing)
    │   ├── workflowEngine.js      ← Trigger→Action executor
    │   └── notificationService.js ← Nodemailer + Slack webhook
    │
    ├── middleware/
    │   ├── auth.js                ← JWT protect middleware
    │   └── rateLimiter.js         ← API rate limiting
    │
    ├── routes/
    │   └── index.js               ← All API routes
    │
    └── jobs/
        └── cronJobs.js            ← Daily deadline reminders
```

---

## 🔌 API Reference

### Auth
```
POST /api/auth/register   { name, email, password }
POST /api/auth/login      { email, password }
GET  /api/auth/me         → current user (JWT required)
```

### Tasks *(all require JWT)*
```
GET    /api/tasks                    → list (filter: ?status= ?category=)
POST   /api/tasks                    → create
PUT    /api/tasks/:id                → update
PATCH  /api/tasks/:id/status         → quick status update (drag-drop)
DELETE /api/tasks/:id                → delete
GET    /api/tasks/export/csv         → download CSV
GET    /api/analytics                → stats
```

### Workflows *(all require JWT)*
```
GET    /api/workflows                → list
POST   /api/workflows                → create
PATCH  /api/workflows/:id/toggle     → enable/disable
DELETE /api/workflows/:id            → delete
GET    /api/workflows/:id/log        → execution history
```

### AI *(all require JWT)*
```
GET  /api/ai/provider       → { provider, model, free }
POST /api/ai/subtasks       → { taskTitle, taskDesc }
POST /api/ai/priority       → { taskTitle, taskDesc, deadline }
POST /api/ai/automation     → { taskTitle, taskDesc }
POST /api/ai/notify         → { taskTitle, taskDesc, priority }
POST /api/ai/chat           → { message }
```

---

## ⚡ Workflow Engine

When a task changes state, the engine automatically finds all active workflows matching the trigger and executes their action:

| Trigger | When it fires |
|---------|--------------|
| `task-done` | Task dragged to Done column |
| `task-created` | New task saved |
| `high-priority` | Task saved with priority = high |
| `task-overdue` | Cron job (daily 8AM) finds overdue tasks |

| Action | What happens |
|--------|-------------|
| `notify` | In-app notification logged |
| `gpt-suggest` | Groq suggests next task → email sent |
| `gpt-summary` | Groq writes one-sentence status update |
| `gpt-email` | Groq drafts + Nodemailer sends email |
| `gpt-slack` | Groq drafts + Slack webhook posts |
| `move-done` | Task automatically moved to Done in DB |

---

## 🤖 Groq AI Details

**Model:** `llama-3.1-8b-instant`
**Free tier:** 14,400 requests/day · 30 req/min · $0 forever
**Get key:** https://console.groq.com/keys

All AI features are server-side — the API key never touches the browser.

---

## 🗄️ Database Setup

### Local MongoDB
```bash
# macOS
brew install mongodb-community && brew services start mongodb-community

# Windows — download from mongodb.com/try/download/community
# Linux (Ubuntu)
sudo apt install mongodb-org && sudo systemctl start mongod
```

### MongoDB Atlas (Cloud — free tier)
1. Go to **mongodb.com/atlas** → Create free M0 cluster
2. Create a DB user + password
3. Add your IP to Network Access (or 0.0.0.0/0 for development)
4. Click Connect → Drivers → copy connection string
5. Replace `<password>` and add `/flowmind` before `?`

---

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | ✅ Yes | MongoDB connection string |
| `JWT_SECRET` | ✅ Yes | Long random string for signing tokens |
| `GROQ_API_KEY` | ✅ Yes | Free key from console.groq.com |
| `EMAIL_USER` | Optional | Gmail address for email notifications |
| `EMAIL_PASS` | Optional | Gmail App Password (16 chars) |
| `SLACK_WEBHOOK_URL` | Optional | Slack incoming webhook URL |

---

## 🛡️ Security

- Passwords hashed with **bcrypt** (12 salt rounds)
- Routes protected with **JWT** middleware
- Rate limiting: 100 req/15min (API), 10 req/15min (auth), 30 req/15min (AI)
- Input sanitization on all controllers
- CORS enabled for development

---

## 📋 Demo Credentials

After running `node database/seed.js`:

```
Email:    demo@flowmind.app
Password: password123
```

---

## 🔧 Scripts

```bash
npm run dev      # Start with nodemon (auto-reload on save)
npm start        # Production start
node database/seed.js   # Seed demo data (clears existing)
```

---

## 🧩 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express 4 |
| Database | MongoDB + Mongoose |
| AI | Groq (llama-3.1-8b-instant) |
| Auth | JWT + bcrypt |
| Email | Nodemailer |
| Notifications | Slack Webhooks |
| Scheduler | node-cron |
| Frontend | Vanilla HTML/CSS/JS |

---

## 📄 License

MIT — free to use, modify, and distribute.