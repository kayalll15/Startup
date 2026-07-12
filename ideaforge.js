/* ═══════════════════════════════════════════════════════════════
   IdeaForge — Frontend Logic
   Chat UI · Business Model Canvas · Budget Chart · Roadmap · Competitors
   ═══════════════════════════════════════════════════════════════ */

"use strict";

// ── Currency formatter (set by /api/health) ───────────────────
let CURRENCY = "INR";
let currencyFormatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function formatCurrency(amount) {
  try { return currencyFormatter.format(amount); }
  catch { return `${CURRENCY} ${amount}`; }
}

// ── Canvas block definitions ──────────────────────────────────
const CANVAS_BLOCKS = [
  { key: "key_partnerships",      label: "Key Partnerships",      icon: "🤝", cssClass: "canvas-kp" },
  { key: "key_activities",        label: "Key Activities",        icon: "⚙️",  cssClass: "canvas-ka" },
  { key: "value_proposition",     label: "Value Proposition",     icon: "💎", cssClass: "canvas-vp" },
  { key: "customer_relationships",label: "Customer Relationships",icon: "❤️",  cssClass: "canvas-cr" },
  { key: "customer_segments",     label: "Customer Segments",     icon: "👥", cssClass: "canvas-cs" },
  { key: "key_resources",         label: "Key Resources",         icon: "🏗️",  cssClass: "canvas-kr" },
  { key: "channels",              label: "Channels",              icon: "📡", cssClass: "canvas-ch" },
  { key: "cost_structure",        label: "Cost Structure",        icon: "📉", cssClass: "canvas-cost" },
  { key: "revenue_streams",       label: "Revenue Streams",       icon: "💰", cssClass: "canvas-rev" },
];

const CHART_COLORS = [
  "#5c7cfa","#3ec9d6","#f5a623","#2ecc71","#e74c3c",
  "#9b59b6","#e67e22","#1abc9c","#3498db","#f39c12"
];

// ── State ─────────────────────────────────────────────────────
let budgetChartInstance = null;
let turnCount = 0;

// ── DOM refs ──────────────────────────────────────────────────
const chatMessages  = document.getElementById("chatMessages");
const chatInput     = document.getElementById("chatInput");
const sendBtn       = document.getElementById("sendBtn");
const resetBtn      = document.getElementById("resetBtn");
const themeToggle   = document.getElementById("themeToggle");
const statusDot     = document.getElementById("statusDot");
const statusText    = document.getElementById("statusText");
const turnCountBadge= document.getElementById("turnCount");
const typingOverlay = document.getElementById("typingOverlay");
const heroBanner    = document.getElementById("heroBanner");
const summaryCard   = document.getElementById("summaryCard");
const summaryText   = document.getElementById("summaryText");

// ── Init ──────────────────────────────────────────────────────
(async function init() {
  bindChips();
  bindTabNav();
  bindInput();
  bindReset();
  bindThemeToggle();
  await fetchHealth();
})();

// ── Health check ─────────────────────────────────────────────
async function fetchHealth() {
  try {
    const res = await fetch("/api/health");
    if (res.ok) {
      const data = await res.json();
      CURRENCY = data.agent?.currency || "INR";
      try {
        currencyFormatter = new Intl.NumberFormat(
          CURRENCY === "INR" ? "en-IN" : "en-US",
          { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 }
        );
      } catch {}
      setStatus("online", `AI ready · ${data.agent?.geo_focus || ""}`);
    } else {
      setStatus("error", "AI offline");
    }
  } catch {
    setStatus("error", "Cannot reach server");
  }
}

function setStatus(state, msg) {
  statusDot.className = `status-dot ${state}`;
  statusText.textContent = msg;
}

// ── Tab nav ───────────────────────────────────────────────────
function bindTabNav() {
  document.querySelectorAll("[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-tab]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".tab-pane").forEach(p => {
        p.classList.remove("show", "active");
      });
      const target = document.getElementById(btn.dataset.tab);
      if (target) {
        target.classList.add("show", "active");
        // Re-trigger chart if switching to budget
        if (btn.dataset.tab === "budgetTab" && budgetChartInstance) {
          budgetChartInstance.update();
        }
      }
    });
  });
}

// ── Chip wiring ───────────────────────────────────────────────
function bindChips() {
  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const prompt = chip.dataset.prompt;
      if (prompt) sendMessage(prompt);
    });
  });
}

// ── Input / send ─────────────────────────────────────────────
function bindInput() {
  sendBtn.addEventListener("click", () => {
    const msg = chatInput.value.trim();
    if (msg) sendMessage(msg);
  });

  chatInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const msg = chatInput.value.trim();
      if (msg) sendMessage(msg);
    }
  });
}

// ── Reset ─────────────────────────────────────────────────────
function bindReset() {
  resetBtn.addEventListener("click", async () => {
    if (!confirm("Start a new session? Current conversation will be cleared.")) return;
    await fetch("/api/reset", { method: "POST" });
    chatMessages.innerHTML = "";
    turnCount = 0;
    turnCountBadge.textContent = "0 turns";
    clearDashboard();
    heroBanner.style.display = "";
    appendMessage("assistant",
      "Session reset! Describe a new startup idea to begin. 🔥",
      "🔥"
    );
  });
}

// ── Theme toggle ──────────────────────────────────────────────
function bindThemeToggle() {
  themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    const isDark = html.getAttribute("data-bs-theme") === "dark";
    html.setAttribute("data-bs-theme", isDark ? "light" : "dark");
    themeToggle.innerHTML = isDark
      ? '<i class="bi bi-sun-fill"></i>'
      : '<i class="bi bi-moon-stars-fill"></i>';
    // Redraw chart with new theme background
    if (budgetChartInstance) {
      budgetChartInstance.update();
    }
  });
}

// ── Send message ──────────────────────────────────────────────
async function sendMessage(text) {
  chatInput.value = "";
  chatInput.style.height = "auto";

  heroBanner.style.display = "none";

  appendMessage("user", escapeHtml(text), "👤");
  showTyping(true);
  setStatus("online", "Thinking…");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    const json = await res.json();
    showTyping(false);

    if (!res.ok) {
      showToast(json.error || "Server error");
      setStatus("error", "Error");
      return;
    }

    turnCount++;
    turnCountBadge.textContent = `${turnCount} turn${turnCount !== 1 ? "s" : ""}`;

    const data = json.data || {};
    const reply = data.chat_reply || "(No response text)";
    appendMessage("assistant", escapeHtml(reply), "🔥");

    if (data.summary) {
      summaryText.textContent = data.summary;
      summaryCard.classList.remove("d-none");
    }

    if (data.canvas) renderCanvas(data.canvas, data.refined_sections);
    if (data.budget && data.budget.length) renderBudget(data.budget);
    if (data.roadmap && data.roadmap.length) renderRoadmap(data.roadmap);
    if (data.competitors && data.competitors.length) renderCompetitors(data.competitors);

    setStatus("online", `AI ready · turn ${turnCount}`);

  } catch (err) {
    showTyping(false);
    setStatus("error", "Network error");
    showToast("Network error: " + err.message);
  }
}

// ── Append chat message ───────────────────────────────────────
function appendMessage(role, html, avatar) {
  const div = document.createElement("div");
  div.className = `message ${role}-message`;
  div.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-body">${html}</div>
  `;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ── Typing indicator ──────────────────────────────────────────
function showTyping(show) {
  typingOverlay.classList.toggle("d-none", !show);
  sendBtn.disabled = show;
  chatInput.disabled = show;
}

// ── Clear dashboard ───────────────────────────────────────────
function clearDashboard() {
  document.getElementById("canvasGrid").style.display = "none";
  document.getElementById("canvasEmpty").style.display = "";
  document.getElementById("budgetContent").style.display = "none";
  document.getElementById("budgetEmpty").style.display = "";
  document.getElementById("roadmapTimeline").style.display = "none";
  document.getElementById("roadmapEmpty").style.display = "";
  document.getElementById("competitorsGrid").style.display = "none";
  document.getElementById("competitorsEmpty").style.display = "";
  summaryCard.classList.add("d-none");
  if (budgetChartInstance) { budgetChartInstance.destroy(); budgetChartInstance = null; }
}

// ── Render Business Model Canvas ─────────────────────────────
function renderCanvas(canvas, refinedSections = []) {
  const grid = document.getElementById("canvasGrid");
  grid.innerHTML = "";

  CANVAS_BLOCKS.forEach(({ key, label, icon, cssClass }) => {
    const text = canvas[key] || "—";
    const isRefined = refinedSections && refinedSections.includes("canvas");
    const block = document.createElement("div");
    block.className = `canvas-block ${cssClass}${isRefined ? " refined-pulse" : ""}`;
    block.innerHTML = `
      <div class="canvas-block-title">
        <span class="canvas-block-icon">${icon}</span>${label}
      </div>
      <div class="canvas-block-body">${escapeHtml(text)}</div>
    `;
    grid.appendChild(block);
  });

  grid.style.display = "";
  document.getElementById("canvasEmpty").style.display = "none";
  switchTab("canvasTab");
}

// ── Render Budget ─────────────────────────────────────────────
function renderBudget(items) {
  // Table
  const tbody = document.getElementById("budgetTable");
  tbody.innerHTML = "";
  let total = 0;

  items.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="fw-semibold">${escapeHtml(item.label)}</div>
        ${item.note ? `<small class="text-muted">${escapeHtml(item.note)}</small>` : ""}
      </td>
      <td class="text-end">${formatCurrency(item.amount)}</td>
    `;
    tbody.appendChild(tr);
    total += Number(item.amount) || 0;
  });

  document.getElementById("budgetTotal").textContent = formatCurrency(total);

  // Chart
  if (budgetChartInstance) { budgetChartInstance.destroy(); }
  const ctx = document.getElementById("budgetChart").getContext("2d");
  const isDark = document.documentElement.getAttribute("data-bs-theme") === "dark";

  budgetChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: items.map(i => i.label),
      datasets: [{
        data: items.map(i => i.amount),
        backgroundColor: CHART_COLORS.slice(0, items.length),
        borderColor: isDark ? "#1a1d27" : "#ffffff",
        borderWidth: 3,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: isDark ? "#e6e8f0" : "#1a1e35",
            boxWidth: 12,
            padding: 12,
            font: { size: 11 },
          },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.raw)}`,
          },
        },
      },
    },
  });

  document.getElementById("budgetContent").style.display = "";
  document.getElementById("budgetEmpty").style.display = "none";
}

// ── Render Roadmap ────────────────────────────────────────────
function renderRoadmap(phases) {
  const timeline = document.getElementById("roadmapTimeline");
  timeline.innerHTML = "";

  const phaseColors = ["#5c7cfa", "#3ec9d6", "#f5a623", "#2ecc71", "#e74c3c", "#9b59b6"];

  phases.forEach((phase, i) => {
    const color = phaseColors[i % phaseColors.length];
    const milestoneHtml = (phase.milestones || [])
      .map(m => `<li>${escapeHtml(m)}</li>`)
      .join("");

    const div = document.createElement("div");
    div.className = "roadmap-phase";
    div.style.animationDelay = `${i * 0.08}s`;
    div.innerHTML = `
      <div class="roadmap-phase-dot" style="background:${color};box-shadow:0 0 0 2px ${color}"></div>
      <div class="roadmap-phase-header">
        <span class="roadmap-phase-name">${escapeHtml(phase.phase)}</span>
        <span class="roadmap-phase-duration">${escapeHtml(phase.duration || "")}</span>
      </div>
      <ul class="roadmap-milestones">${milestoneHtml}</ul>
    `;
    timeline.appendChild(div);
  });

  timeline.style.display = "";
  document.getElementById("roadmapEmpty").style.display = "none";
}

// ── Render Competitors ────────────────────────────────────────
function renderCompetitors(competitors) {
  const grid = document.getElementById("competitorsGrid");
  grid.innerHTML = "";

  competitors.forEach((comp, i) => {
    const col = document.createElement("div");
    col.className = "col-12 col-sm-6 col-xl-4";
    col.style.animationDelay = `${i * 0.07}s`;
    col.innerHTML = `
      <div class="competitor-card">
        <div class="competitor-name">
          <span class="me-2">🏢</span>${escapeHtml(comp.name)}
        </div>
        <div class="mb-2">
          <span class="competitor-badge bg-success bg-opacity-15 text-success me-1">Strength</span>
          <span class="small text-muted">${escapeHtml(comp.strength)}</span>
        </div>
        <div>
          <span class="competitor-badge bg-primary bg-opacity-15 text-primary me-1">Your Edge</span>
          <span class="small text-muted">${escapeHtml(comp.gap)}</span>
        </div>
      </div>
    `;
    grid.appendChild(col);
  });

  grid.style.display = "";
  document.getElementById("competitorsEmpty").style.display = "none";
}

// ── Tab switcher helper ────────────────────────────────────────
function switchTab(tabId) {
  document.querySelectorAll("[data-tab]").forEach(b => {
    const active = b.dataset.tab === tabId;
    b.classList.toggle("active", active);
  });
  document.querySelectorAll(".tab-pane").forEach(p => {
    const active = p.id === tabId;
    p.classList.toggle("show", active);
    p.classList.toggle("active", active);
  });
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg) {
  const el = document.getElementById("toastMsg");
  document.getElementById("toastBody").textContent = msg;
  const toast = new bootstrap.Toast(el, { delay: 5000 });
  toast.show();
}

// ── Utility ───────────────────────────────────────────────────
function escapeHtml(str) {
  if (typeof str !== "string") return String(str ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
