"""
╔══════════════════════════════════════════════════════════════════╗
║          IdeaForge — AI Startup Advisor                          ║
║          Powered by IBM Watsonx.ai (Granite)                     ║
╚══════════════════════════════════════════════════════════════════╝
"""

import os
import json
import re
from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS
from dotenv import load_dotenv
from ibm_watsonx_ai import Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams

# ─────────────────────────────────────────────────────────────────────────────
# AGENT INSTRUCTIONS — Customize tone, specialization, and safety rules here
# ─────────────────────────────────────────────────────────────────────────────
AGENT_INSTRUCTIONS = {
    # Tone: "professional" | "friendly" | "investor-pitch" | "analytical"
    "tone": "friendly and professional",

    # Industry focus: "general" | "fintech" | "healthtech" | "edtech" | "ecommerce" | "saas"
    "industry_focus": "general",

    # Budget stance: "conservative" | "balanced" | "growth-aggressive"
    "budget_stance": "balanced",

    # Geographic focus: "global" | "India" | "US" | "Southeast Asia" | "Tier 2 cities"
    "geo_focus": "India",

    # Currency: "USD" | "INR" | "EUR"
    "currency": "INR",

    # Max response sections to generate in one pass
    "max_tokens": 3000,

    # Safety rules (appended to every prompt)
    "safety_rules": (
        "Do not provide legal, medical, or financial advice. "
        "Always frame budget figures as rough estimates. "
        "Do not endorse specific vendors or products by name unless asked. "
        "Keep responses factual, concise, and actionable."
    ),

    # Extra persona note appended to the system prompt
    "persona_note": (
        "You are IdeaForge, a seasoned startup mentor and business strategist. "
        "You speak directly to founders, use plain language, and always ground "
        "advice in real-world market realities."
    ),
}
# ─────────────────────────────────────────────────────────────────────────────

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "ideaforge-secret-2024")
CORS(app)

# ── Watsonx.ai setup ──────────────────────────────────────────────────────────
_model: ModelInference | None = None


def get_model() -> ModelInference:
    global _model
    if _model is not None:
        return _model

    api_key = os.getenv("IBM_API_KEY")
    project_id = os.getenv("WATSONX_PROJECT_ID")
    url = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")

    if not api_key or not project_id:
        raise RuntimeError(
            "IBM_API_KEY and WATSONX_PROJECT_ID must be set in .env"
        )

    credentials = Credentials(api_key=api_key, url=url)

    # Use the instruct model available in this environment.
    # Llama instruct models use the /text/chat endpoint via model.chat().
    # Override with WATSONX_MODEL_ID in .env to switch models.
    model_id = os.getenv("WATSONX_MODEL_ID", "meta-llama/llama-3-3-70b-instruct")

    _model = ModelInference(
        model_id=model_id,
        credentials=credentials,
        project_id=project_id,
        params={
            GenParams.MAX_NEW_TOKENS: AGENT_INSTRUCTIONS["max_tokens"],
            GenParams.TEMPERATURE: 0.7,
            GenParams.TOP_P: 0.95,
            GenParams.REPETITION_PENALTY: 1.1,
        },
    )
    return _model


# ── Prompt builder ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = f"""\
{AGENT_INSTRUCTIONS['persona_note']}

Tone: {AGENT_INSTRUCTIONS['tone']}.
Industry focus: {AGENT_INSTRUCTIONS['industry_focus']}.
Budget stance: {AGENT_INSTRUCTIONS['budget_stance']} — prefer {AGENT_INSTRUCTIONS['budget_stance']} cost assumptions.
Geographic focus: {AGENT_INSTRUCTIONS['geo_focus']}.
Currency: {AGENT_INSTRUCTIONS['currency']}.

Safety rules: {AGENT_INSTRUCTIONS['safety_rules']}

When asked to analyse a startup idea, ALWAYS return a valid JSON object with EXACTLY these keys:
{{
  "summary": "<2-3 sentence elevator pitch>",
  "canvas": {{
    "value_proposition": "<text>",
    "customer_segments": "<text>",
    "channels": "<text>",
    "customer_relationships": "<text>",
    "revenue_streams": "<text>",
    "key_resources": "<text>",
    "key_activities": "<text>",
    "key_partnerships": "<text>",
    "cost_structure": "<text>"
  }},
  "budget": [
    {{"label": "<category>", "amount": <number>, "note": "<short note>"}}
  ],
  "roadmap": [
    {{"phase": "<Phase name>", "duration": "<e.g. Month 1-3>", "milestones": ["<m1>","<m2>"]}}
  ],
  "competitors": [
    {{"name": "<competitor>", "strength": "<what they do well>", "gap": "<where you can win>"}}
  ],
  "chat_reply": "<conversational paragraph summarising key insights>"
}}

For follow-up refinement requests (e.g. "make budget leaner", "focus on Tier 2 cities"),
return the SAME JSON structure but update only the relevant sections and set
"refined_sections" to an array of the key names you changed.

Respond with ONLY the JSON object — no markdown fences, no extra commentary.
"""


def build_messages(history: list[dict], user_message: str) -> list[dict]:
    """Build the messages list for the chat endpoint."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    for turn in history[-6:]:   # keep last 6 turns for context window
        role = turn.get("role", "user")
        content = turn.get("content", "")
        # Chat API only accepts "user" and "assistant" roles
        if role in ("user", "assistant"):
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": user_message})
    return messages


def extract_json(raw: str) -> dict | None:
    """Pull first valid JSON object out of model output."""
    # Try to find JSON block
    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        return None
    try:
        return json.loads(match.group())
    except json.JSONDecodeError:
        # Try to repair common issues: trailing commas
        cleaned = re.sub(r",\s*([}\]])", r"\1", match.group())
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            return None


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    session.setdefault("history", [])
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(force=True)
    user_message: str = data.get("message", "").strip()

    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    # Load / init conversation history in session
    history: list[dict] = session.get("history", [])

    try:
        model = get_model()
        messages = build_messages(history, user_message)
        response = model.chat(messages=messages)
        # Extract text from chat response structure
        raw_text: str = (
            response["choices"][0]["message"]["content"]
            if isinstance(response, dict)
            else str(response)
        )
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:                        # noqa: BLE001
        return jsonify({"error": f"Model error: {exc}"}), 500

    parsed = extract_json(raw_text)

    # Save turn to session history
    history.append({"role": "user", "content": user_message})
    history.append({
        "role": "assistant",
        "content": parsed.get("chat_reply", raw_text) if parsed else raw_text,
    })
    session["history"] = history[-20:]  # keep last 20 turns

    if parsed:
        return jsonify({"status": "ok", "data": parsed, "raw": raw_text})
    else:
        # Model returned plain text — wrap it gracefully
        return jsonify({
            "status": "plain",
            "data": {
                "chat_reply": raw_text,
                "canvas": None,
                "budget": None,
                "roadmap": None,
                "competitors": None,
            },
            "raw": raw_text,
        })


@app.route("/api/reset", methods=["POST"])
def reset():
    session["history"] = []
    return jsonify({"status": "ok"})


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "agent": {
            "tone": AGENT_INSTRUCTIONS["tone"],
            "geo_focus": AGENT_INSTRUCTIONS["geo_focus"],
            "currency": AGENT_INSTRUCTIONS["currency"],
            "budget_stance": AGENT_INSTRUCTIONS["budget_stance"],
        },
    })


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_ENV", "development") == "development"
    app.run(host="0.0.0.0", port=port, debug=debug)
