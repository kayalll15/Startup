# 🔥 IdeaForge — AI-Powered Startup Advisor

> Turn any startup idea into a complete business blueprint in seconds.  
> Powered by **IBM Watsonx.ai (Granite)** · Built with **Flask** · Beautiful **Bootstrap 5** UI.

---

## ✨ Features

| Feature | Description |
|---|---|
| 💬 **Chat UI** | Conversational interface with follow-up refinement support |
| 🗺️ **Business Model Canvas** | Full 9-block BMC rendered as an interactive grid |
| 💰 **Budget Breakdown** | Doughnut chart + itemised table with currency formatting |
| 🗓️ **Go-to-Market Roadmap** | Phased timeline with milestones |
| 🔍 **Competitor Snapshot** | Competitor strengths + your differentiation gaps |
| ⚡ **Quick Chips** | Instant idea & refinement pill buttons |
| 🌙 **Dark / Light Mode** | Theme toggle with persistent preference |
| 📱 **Mobile Responsive** | Works on all screen sizes |
| 🔧 **AGENT_INSTRUCTIONS** | Easy customisation of tone, currency, geography, and safety rules |

---

## 📁 Project Structure

```
IdeaForge/
├── app.py                  # Flask backend + Watsonx.ai integration + AGENT_INSTRUCTIONS
├── requirements.txt        # Python dependencies
├── .env.example            # Environment variable template
├── .env                    # Your secrets (never commit this!)
├── templates/
│   └── index.html          # Main HTML template
└── static/
    ├── css/
    │   └── ideaforge.css   # All styles (dark mode, animations, responsive)
    └── js/
        └── ideaforge.js    # Frontend logic (chat, canvas, chart, roadmap)
```

---

## 🚀 Quick Start (Local)

### 1. Clone / Download

```bash
git clone <your-repo-url>
cd IdeaForge
```

### 2. Create a virtual environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in your real values:

```dotenv
IBM_API_KEY=your_ibm_cloud_api_key_here
WATSONX_PROJECT_ID=your_watsonx_project_id_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com
FLASK_SECRET_KEY=some-long-random-string
FLASK_ENV=development
```

> **How to get IBM credentials:**
> 1. Log in to [IBM Cloud](https://cloud.ibm.com)
> 2. Go to **Manage → Access (IAM) → API Keys** and create a new API key
> 3. Open [Watsonx.ai](https://dataplatform.cloud.ibm.com) and create/open a project
> 4. Copy the **Project ID** from the project settings

### 5. Run the app

```bash
python app.py
```

Open your browser at **http://localhost:5000** 🎉

---

## 🔧 Customising the AI Agent

Open `app.py` and find the `AGENT_INSTRUCTIONS` dictionary near the top:

```python
AGENT_INSTRUCTIONS = {
    "tone": "friendly and professional",   # Change to "analytical", "investor-pitch", etc.
    "industry_focus": "general",            # "fintech", "healthtech", "edtech", "saas" …
    "budget_stance": "balanced",            # "conservative" | "balanced" | "growth-aggressive"
    "geo_focus": "India",                   # "US", "Southeast Asia", "Tier 2 cities" …
    "currency": "INR",                      # "USD", "EUR", "GBP" …
    "max_tokens": 3000,
    "safety_rules": "...",                  # Append or replace safety guardrails
    "persona_note": "...",                  # Rewrite the agent's persona entirely
}
```

No other files need to change — the backend propagates these values into every prompt automatically.

---

## 🌐 Deployment

### Option A — Render.com (Free tier)

1. Push code to a GitHub repo (make sure `.env` is in `.gitignore`)
2. Create a new **Web Service** on [Render](https://render.com)
3. Set **Build Command**: `pip install -r requirements.txt`
4. Set **Start Command**: `gunicorn app:app`
5. Add environment variables (`IBM_API_KEY`, `WATSONX_PROJECT_ID`, etc.) in the Render dashboard

### Option B — IBM Code Engine

```bash
# Build and push image
ibmcloud ce project select --name ideaforge
ibmcloud ce app create \
  --name ideaforge \
  --image icr.io/<namespace>/ideaforge:latest \
  --env IBM_API_KEY=<key> \
  --env WATSONX_PROJECT_ID=<id> \
  --env FLASK_SECRET_KEY=<secret> \
  --min-scale 1
```

### Option C — Docker (any cloud)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "app:app"]
```

```bash
docker build -t ideaforge .
docker run -p 5000:5000 --env-file .env ideaforge
```

### Option D — Heroku

```bash
echo "web: gunicorn app:app" > Procfile
heroku create ideaforge-app
heroku config:set IBM_API_KEY=<key> WATSONX_PROJECT_ID=<id> FLASK_SECRET_KEY=<secret>
git push heroku main
```

---

## 📡 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Serve the main UI |
| `/api/chat` | POST | Send a message; returns structured JSON with canvas, budget, roadmap, competitors |
| `/api/reset` | POST | Clear session conversation history |
| `/api/health` | GET | Check AI status and agent configuration |

### `/api/chat` request body

```json
{ "message": "Build a food delivery app for Tier 2 cities" }
```

### `/api/chat` response

```json
{
  "status": "ok",
  "data": {
    "summary": "...",
    "chat_reply": "...",
    "canvas": { "value_proposition": "...", "customer_segments": "...", ... },
    "budget": [ { "label": "Tech development", "amount": 500000, "note": "MVP build" } ],
    "roadmap": [ { "phase": "Phase 1 — MVP", "duration": "Month 1-3", "milestones": ["..."] } ],
    "competitors": [ { "name": "Swiggy", "strength": "Scale", "gap": "Hyperlocal focus" } ]
  }
}
```

---

## 🔒 Security Notes

- **Never commit `.env`** — add it to `.gitignore`
- The session uses a signed cookie; set a strong `FLASK_SECRET_KEY` in production
- All HTML output from the AI is escaped before rendering
- Safety rules in `AGENT_INSTRUCTIONS` are injected into every prompt

---

## 🛠️ Troubleshooting

| Problem | Fix |
|---|---|
| `RuntimeError: IBM_API_KEY … must be set` | Check `.env` file exists and is loaded |
| `Model error: 401 Unauthorized` | API key expired or wrong — regenerate in IBM Cloud |
| `Model error: 404 Not Found` | Wrong `WATSONX_URL` for your region or model ID |
| Canvas shows "—" for all blocks | Model returned plain text — refine the prompt or check token limit |
| Budget chart not rendering | Ensure Chart.js CDN is accessible; check browser console |

---

## 📄 License

MIT License — free to use, modify, and deploy.

---

*Built for the AICTE IBM Edunet Internship 2026 · Powered by IBM Watsonx.ai Granite*
