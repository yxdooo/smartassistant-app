// SmartAssistant Anna App: onboarding, quick logs, intermittent fasting,
// activity telemetry and weekly money & nutrition reviews. Data lives in
// Anna Storage inside Anna and in localStorage when opened outside the host.

import { TOOLS, todayIso } from "./engine.js";

const STORE_KEY = "smartassistant:v1";
const HANDLE = "smartassistant";
const KEEP_DAYS = 120;
const CATEGORIES = ["Food", "Eating out", "Transport", "Bills", "Health", "Fun", "Other"];
const CURRENCIES = ["USD", "EUR", "GBP", "TRY", "CAD", "AUD", "INR"];

const MEAL_PRESETS = [
  { label: "☕ Coffee / Tea", kcal: 40, protein: 1 },
  { label: "🥗 Light Lunch", kcal: 450, protein: 25 },
  { label: "🍗 Protein Meal", kcal: 650, protein: 45 },
  { label: "🍎 Healthy Snack", kcal: 180, protein: 4 },
];

// ---------- tiny DOM helper ----------
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}
const $app = document.getElementById("app");
const $toast = document.getElementById("toast");

let toastTimer;
function toast(msg, undo) {
  $toast.replaceChildren(h("span", {}, msg));
  if (undo) $toast.append(h("button", { onclick: () => { undo(); $toast.hidden = true; } }, "Undo"));
  $toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($toast.hidden = true), 5000);
}

// ---------- host connection ----------
let anna = null;
async function connectHost() {
  try {
    const mod = await import("/static/anna-apps/_sdk/latest/index.js");
    anna = await Promise.race([
      mod.AnnaAppRuntime.connect(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("host handshake timed out")), 3000)),
    ]);
    window.anna = anna;
    try { await anna.window?.ready?.(); } catch { /* optional */ }
  } catch {
    anna = null; // standalone preview
  }
}

// ---------- data layer: one interface, two backends ----------
const store = {
  async load() {
    let raw = null;
    if (anna) {
      const r = await anna.storage.get({ key: STORE_KEY });
      raw = r && "value" in r ? r.value : r;
    } else {
      raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    }
    if (typeof raw === "string") raw = JSON.parse(raw);
    return normalize(raw);
  },
  async save(state) {
    prune(state);
    if (anna) await anna.storage.set({ key: STORE_KEY, value: state });
    else localStorage.setItem(STORE_KEY, JSON.stringify(state));
  },
};

function normalize(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  return {
    v: 1,
    profile: s.profile || null,
    plan: s.plan || null,
    expenses: Array.isArray(s.expenses) ? s.expenses : [],
    meals: Array.isArray(s.meals) ? s.meals : [],
    water: Array.isArray(s.water) ? s.water : [],
    reviews: Array.isArray(s.reviews) ? s.reviews : [],
    fasting: s.fasting && typeof s.fasting === "object" ? s.fasting : null,
  };
}

function prune(s) {
  const d = new Date();
  d.setDate(d.getDate() - KEEP_DAYS);
  const cutoff = d.toISOString().slice(0, 10);
  for (const k of ["expenses", "meals", "water"]) s[k] = s[k].filter((r) => r.date >= cutoff);
  s.reviews = s.reviews.slice(-26);
}

// ---------- tools: Executa first, local engine as fallback ----------
async function callTool(method, args) {
  if (anna) {
    const toolId = (window.__ANNA_TOOL_IDS__ || {})[HANDLE];
    try {
      const res = await anna.tools.invoke({ tool_id: toolId, method, args, timeoutMs: 20000 });
      let out = res && "result" in res ? res.result : res;
      if (out && out.success === false) throw new Error(out.error || "tool failed");
      if (out && out.success === true && "data" in out) out = out.data;
      return { data: out, via: "executa" };
    } catch (e) {
      if (/plan_targets|weekly_review|must be|must be at/.test(String(e.message))) throw e;
      // Executa unreachable: fall through to the same rules in the bundle.
    }
  }
  return { data: TOOLS[method](args), via: "local" };
}

// ---------- state + helpers ----------
let state = normalize(null);
let view = new URLSearchParams(location.search).get("view") || "today";
let reviewState = { status: "idle" };

const uid = () => Math.random().toString(36).slice(2, 10);
const sumWhere = (rows, key, day) => rows.filter((r) => r.date === day).reduce((a, r) => a + (+r[key] || 0), 0);
const fmtMoney = (n) => {
  const cur = state.profile?.currency || "USD";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(n); }
  catch { return n.toFixed(2); }
};
const pct = (a, b) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);

function calculateStreak() {
  const daysWithLogs = new Set();
  for (const r of state.expenses) daysWithLogs.add(r.date);
  for (const r of state.meals) daysWithLogs.add(r.date);
  for (const r of state.water) daysWithLogs.add(r.date);

  const today = todayIso();
  let streak = 0;
  let curr = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const getIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (!daysWithLogs.has(getIso(curr))) {
    curr.setDate(curr.getDate() - 1);
  }

  while (true) {
    const dStr = getIso(curr);
    if (daysWithLogs.has(dStr)) {
      streak++;
      curr.setDate(curr.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

async function commit(msg, undo) {
  try {
    await store.save(state);
    if (msg) toast(msg, undo);
  } catch (e) {
    toast("Could not save: " + (e.message || "storage error"));
  }
  render();
}

function addRow(kind, row, label) {
  const item = { id: uid(), date: todayIso(), ...row };
  state[kind].push(item);
  commit(label, () => {
    state[kind] = state[kind].filter((r) => r.id !== item.id);
    commit();
  });
}

function removeRow(kind, id, label) {
  const target = state[kind].find((r) => r.id === id);
  if (!target) return;
  state[kind] = state[kind].filter((r) => r.id !== id);
  commit(label || "Entry removed.", () => {
    state[kind].push(target);
    commit();
  });
}

// ---------- views ----------
function field(label, attrs) {
  return h("label", {}, label, h("input", attrs));
}

function onboardingView() {
  const err = h("p", { class: "error", role: "alert" });
  const form = h(
    "form",
    {
      onsubmit: async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(form));
        const btn = form.querySelector("button[type=submit]");
        btn.disabled = true;
        err.textContent = "";
        try {
          const args = {
            weight_kg: f.weight, height_cm: f.height, age: f.age, sex: f.sex, activity: f.activity, goal: f.goal,
            monthly_budget: f.budget, fixed_costs: f.fixed || 0, spent_so_far: 0, today: todayIso(),
          };
          const { data } = await callTool("plan_targets", args);
          state.profile = {
            currency: f.currency, monthly_budget: +f.budget, fixed_costs: +(f.fixed || 0),
            calories: data.calories, protein_g: data.protein_g, water_ml: data.water_ml,
            fat_g: data.fat_g || Math.round(data.calories * 0.25 / 9),
            carbs_g: data.carbs_g || Math.max(0, Math.round((data.calories - data.protein_g * 4 - (data.calories * 0.25)) / 4)),
            inputs: { weight_kg: +f.weight, height_cm: +f.height, age: +f.age, sex: f.sex, activity: f.activity, goal: f.goal },
          };
          state.plan = data;
          await commit();
        } catch (ex) {
          err.textContent = ex.message;
          btn.disabled = false;
        }
      },
    },
    h("h2", {}, "Your numbers"),
    field("Monthly budget", { name: "budget", type: "number", min: 0, step: "any", inputmode: "decimal", required: true }),
    field("Fixed costs already committed (rent, bills)", { name: "fixed", type: "number", min: 0, step: "any", inputmode: "decimal", placeholder: "0" }),
    h("label", {}, "Currency", h("select", { name: "currency" }, CURRENCIES.map((c) => h("option", { value: c }, c)))),
    h("div", { class: "grid" },
      field("Weight (kg)", { name: "weight", type: "number", min: 30, max: 300, step: "any", inputmode: "decimal", required: true }),
      field("Height (cm)", { name: "height", type: "number", min: 120, max: 230, step: "any", inputmode: "decimal", required: true }),
      field("Age", { name: "age", type: "number", min: 14, max: 100, inputmode: "numeric", required: true })),
    h("div", { class: "grid" },
      h("label", {}, "Sex (for the calorie formula)", h("select", { name: "sex" }, h("option", { value: "female" }, "Female"), h("option", { value: "male" }, "Male"))),
      h("label", {}, "Activity", h("select", { name: "activity" },
        h("option", { value: "sedentary" }, "Mostly sitting"), h("option", { value: "light", selected: true }, "Light, 1–3 workouts a week"),
        h("option", { value: "moderate" }, "Moderate, 3–5 a week"), h("option", { value: "active" }, "Hard training most days"))),
      h("label", {}, "Goal", h("select", { name: "goal" },
        h("option", { value: "lose" }, "Lose weight"), h("option", { value: "maintain", selected: true }, "Maintain"), h("option", { value: "gain" }, "Gain muscle")))),
    err,
    h("button", { class: "primary", type: "submit" }, "Show my daily numbers"),
    h("p", { class: "muted" }, "Calories use the Mifflin-St Jeor formula. These are estimates, not medical advice. Your data stays in your Anna storage."),
  );
  return h("section", {}, h("h1", {}, "Set up in about a minute"),
    h("p", { class: "muted" }, "You will get a safe daily spend and daily calorie, protein and water targets."), h("div", { class: "card" }, form));
}

function fastingWidget() {
  const f = state.fasting;
  if (!f || !f.started_at) {
    return h("div", { class: "card" },
      h("div", { class: "fasting-header" },
        h("div", {},
          h("h2", {}, "⏱️ Intermittent Fasting (16:8)"),
          h("p", { class: "muted" }, "Ready to fast? Most people start after dinner and break fast around noon.")),
        h("button", {
          class: "primary",
          onclick: () => {
            state.fasting = { started_at: new Date().toISOString(), target_hours: 16 };
            commit("Fasting timer started!");
          }
        }, "Start 16h Fast")));
  }

  const startTime = new Date(f.started_at).getTime();
  const now = Date.now();
  const elapsedMs = Math.max(0, now - startTime);
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const targetHours = f.target_hours || 16;
  const progressPct = Math.min(100, Math.round((elapsedHours / targetHours) * 100));
  const hours = Math.floor(elapsedHours);
  const minutes = Math.floor((elapsedHours - hours) * 60);
  const isComplete = elapsedHours >= targetHours;

  return h("div", { class: "card" },
    h("div", { class: "fasting-header" },
      h("div", {},
        h("div", { class: "row", style: "gap: 8px;" },
          h("h2", {}, isComplete ? "🎉 Fast Target Reached!" : "⏳ Fasting in Progress"),
          h("span", { class: "badge " + (isComplete ? "badge-success" : "badge-active") }, isComplete ? "Goal Met" : "Active")),
        h("p", { class: "muted" }, `Started ${new Date(f.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Target: ${targetHours} hours`)),
      h("button", {
        onclick: () => {
          if (confirm("End fasting session?")) {
            state.fasting = null;
            commit("Fast ended.");
          }
        }
      }, isComplete ? "Break Fast" : "Stop Fast")),
    h("div", { class: "fasting-timer" },
      h("span", { class: "timer-digits" }, `${hours}h ${minutes}m`),
      h("span", { class: "timer-target" }, `/ ${targetHours}h`)),
    h("div", { class: "bar" + (isComplete ? " goal-met" : "") },
      h("i", { style: `width: ${progressPct}%` })));
}

function todayView() {
  const day = todayIso();
  const p = state.profile;
  const spentToday = sumWhere(state.expenses, "amount", day);
  const kcalToday = sumWhere(state.meals, "kcal", day);
  const proteinToday = sumWhere(state.meals, "protein", day);
  const waterToday = sumWhere(state.water, "ml", day);
  const monthPrefix = day.slice(0, 7);
  const monthSpent = state.expenses.filter((r) => r.date.startsWith(monthPrefix)).reduce((a, r) => a + r.amount, 0);
  let safe = null;
  try {
    safe = TOOLS.plan_targets({ ...p.inputs, monthly_budget: p.monthly_budget, fixed_costs: p.fixed_costs, spent_so_far: monthSpent - spentToday, today: day });
  } catch { /* shown as unavailable */ }
  const leftToday = safe ? safe.safe_daily_spend - spentToday : null;

  // Water calculations
  const targetWater = p.water_ml || 2000;
  const waterPillsCount = 8;
  const filledPills = Math.min(waterPillsCount, Math.round((waterToday / targetWater) * waterPillsCount));

  // Today's logs
  const todayExpenses = state.expenses.filter((r) => r.date === day);
  const todayMeals = state.meals.filter((r) => r.date === day);
  const todayWater = state.water.filter((r) => r.date === day);

  const amount = h("input", { id: "amt", type: "number", min: 0, step: "any", inputmode: "decimal", "aria-label": "Expense amount", placeholder: "Amount" });
  const addExpense = (cat) => {
    const v = parseFloat(amount.value);
    if (!(v > 0)) { toast("Enter an amount first."); amount.focus(); return; }
    addRow("expenses", { amount: v, category: cat }, `Added ${fmtMoney(v)} to ${cat}`);
    amount.value = "";
  };

  const kcal = h("input", { type: "number", min: 0, inputmode: "numeric", "aria-label": "Calories", placeholder: "kcal" });
  const prot = h("input", { type: "number", min: 0, inputmode: "numeric", "aria-label": "Protein grams", placeholder: "protein g" });
  const lastMeal = state.meals[state.meals.length - 1];

  return h("section", {},
    // Today Overview
    h("div", { class: "card" },
      h("h2", {}, "Today's Runway & Metrics"),
      h("div", { class: "grid" },
        h("div", { class: "stat" }, h("b", {}, safe ? fmtMoney(Math.max(0, leftToday)) : "–"), h("span", {}, leftToday != null && leftToday < 0 ? "over today's safe spend" : "left to spend today")),
        h("div", { class: "stat" }, h("b", {}, `${kcalToday} / ${p.calories}`), h("span", {}, "kcal")),
        h("div", { class: "stat" }, h("b", {}, `${proteinToday} / ${p.protein_g} g`), h("span", {}, "protein")),
        h("div", { class: "stat" }, h("b", {}, `${waterToday} / ${p.water_ml}`), h("span", {}, "ml water"))),
      h("div", { class: "bar" + (leftToday != null && leftToday < 0 ? " over" : "") }, h("i", { style: `width:${safe ? pct(spentToday, safe.safe_daily_spend) : 0}%` })),
      // Macro breakdown
      h("div", { class: "macro-bars" },
        h("div", { class: "macro-col" },
          h("b", {}, `${proteinToday}g`), h("span", {}, `Protein (${pct(proteinToday, p.protein_g)}%)`),
          h("div", { class: "bar macro-p" }, h("i", { style: `width: ${pct(proteinToday, p.protein_g)}%` }))),
        h("div", { class: "macro-col" },
          h("b", {}, `${p.carbs_g ? Math.round(p.carbs_g) : "–"}g`), h("span", {}, "Carbs Target"),
          h("div", { class: "bar macro-c" }, h("i", { style: `width: 50%` }))),
        h("div", { class: "macro-col" },
          h("b", {}, `${p.fat_g ? Math.round(p.fat_g) : "–"}g`), h("span", {}, "Fats Target"),
          h("div", { class: "bar macro-f" }, h("i", { style: `width: 50%` }))))),

    // Fasting Widget
    fastingWidget(),

    // Hydration Card
    h("div", { class: "card" },
      h("h2", {}, "Hydration"),
      h("div", { class: "water-pills" },
        Array.from({ length: waterPillsCount }, (_, i) => h("div", { class: "water-pill" + (i < filledPills ? " filled" : "") }))),
      h("div", { class: "row" },
        h("button", { onclick: () => addRow("water", { ml: 250 }, `Added 250 ml (Glass)`) }, "💧 +250 ml"),
        h("button", { onclick: () => addRow("water", { ml: 500 }, `Added 500 ml (Bottle)`) }, "🧴 +500 ml"),
        todayWater.length > 0 && h("button", { class: "del-btn", onclick: () => {
          const last = todayWater[todayWater.length - 1];
          removeRow("water", last.id, "Removed last water entry.");
        } }, "Undo last glass"))),

    // Expense Card
    h("div", { class: "card" },
      h("h2", {}, "Expense"),
      h("div", { class: "row" }, h("div", { class: "grow" }, amount)),
      h("p", { class: "muted" }, "Type amount, then tap a category to log instantly:"),
      h("div", { class: "row chips" }, CATEGORIES.map((c) => h("button", { onclick: () => addExpense(c) }, c))),
      todayExpenses.length > 0 && h("div", { class: "log-list" },
        todayExpenses.map((exp) => h("div", { class: "log-item" },
          h("span", {}, `💰 ${exp.category}: ${fmtMoney(exp.amount)}`),
          h("button", { class: "del-btn", onclick: () => removeRow("expenses", exp.id, `Removed ${exp.category} expense`) }, "✕"))))),

    // Meal Card
    h("div", { class: "card" },
      h("h2", {}, "Meal & Nutrition"),
      h("div", { class: "row" },
        h("div", { class: "grow" }, kcal),
        h("div", { class: "grow" }, prot),
        h("button", { class: "primary", onclick: () => {
          const k = parseFloat(kcal.value);
          if (!(k > 0)) { toast("Enter the calories first."); kcal.focus(); return; }
          addRow("meals", { kcal: k, protein: Math.max(0, parseFloat(prot.value) || 0) }, `Added ${Math.round(k)} kcal`);
          kcal.value = "";
          prot.value = "";
        } }, "Add Meal")),
      h("p", { class: "muted", style: "margin-top: 10px;" }, "Quick meal presets:"),
      h("div", { class: "row chips" },
        MEAL_PRESETS.map((m) => h("button", { onclick: () => addRow("meals", { kcal: m.kcal, protein: m.protein }, `Added ${m.label}`) }, m.label))),
      lastMeal && h("div", { class: "row", style: "margin-top: 8px;" },
        h("button", { onclick: () => addRow("meals", { kcal: lastMeal.kcal, protein: lastMeal.protein }, `Repeated ${Math.round(lastMeal.kcal)} kcal`) },
          `Repeat last meal (${Math.round(lastMeal.kcal)} kcal)`)),
      todayMeals.length > 0 && h("div", { class: "log-list" },
        todayMeals.map((meal) => h("div", { class: "log-item" },
          h("span", {}, `🥗 ${Math.round(meal.kcal)} kcal, ${meal.protein || 0}g protein`),
          h("button", { class: "del-btn", onclick: () => removeRow("meals", meal.id, `Removed meal entry`) }, "✕"))))));
}

function reviewView() {
  if (reviewState.status === "idle" && state.reviews && state.reviews.length > 0) {
    reviewState = { status: "ok", data: state.reviews[state.reviews.length - 1] };
  }
  const r = reviewState;
  let body;
  if (r.status === "loading") body = h("p", { role: "status" }, h("span", { class: "spinner" }), "Reviewing your last 7 days…");
  else if (r.status === "error") body = h("p", { class: "error", role: "alert" }, r.message);
  else if (r.status === "insufficient_data") body = h("p", {}, r.data.message);
  else if (r.status === "ok") body = reviewResult(r.data);
  else body = h("p", { class: "muted" }, "Compares the last 7 days of spending with your budget, and your calories, protein and water with your targets.");

  return h("section", {}, h("div", { class: "card" }, h("h2", {}, "Weekly review"),
    h("button", { class: "primary", disabled: r.status === "loading", onclick: runReview }, "Review my week"),
    h("div", { style: "margin-top:12px", "aria-live": "polite" }, body)));
}

function reviewResult(d) {
  const text = [d.headline, ...d.actions.map((a) => "- " + a)].join("\n");
  const m = d.money, n = d.nutrition;
  return h("div", {},
    h("p", {}, h("b", {}, d.headline)),
    h("div", { class: "grid" },
      h("div", { class: "stat" }, h("b", {}, fmtMoney(m.spent)), h("span", {}, `spent of ${fmtMoney(m.weekly_allowance)} allowance`)),
      n.meal_days ? h("div", { class: "stat" }, h("b", {}, `${n.avg_calories} kcal`), h("span", {}, `avg on ${n.meal_days} logged days`)) : null,
      n.meal_days ? h("div", { class: "stat" }, h("b", {}, `${n.avg_protein_g} g`), h("span", {}, "avg protein")) : null,
      n.water_days ? h("div", { class: "stat" }, h("b", {}, `${n.water_days_on_target}/${n.water_days}`), h("span", {}, "days near water goal")) : null),
    m.top_categories.length ? h("p", { class: "muted", style: "margin-top:8px" }, "Top categories: " + m.top_categories.map((c) => `${c.category} ${fmtMoney(c.amount)}`).join(", ")) : null,
    h("h2", { style: "margin-top:12px" }, "What to do next week"),
    h("ul", { class: "actions" }, d.actions.map((a) => h("li", {}, a))),
    h("div", { class: "row" }, h("button", { onclick: () => shareText(text) }, "Copy summary"),
      anna?.llm ? h("button", { onclick: () => plainSummary(d) }, "Short plain-text note") : null),
    h("p", { id: "note", class: "muted", "aria-live": "polite" }));
}

async function runReview() {
  reviewState = { status: "loading" };
  render();
  try {
    const p = state.profile;
    const { data } = await callTool("weekly_review", {
      profile: { monthly_budget: p.monthly_budget, fixed_costs: p.fixed_costs, calories: p.calories, protein_g: p.protein_g, water_ml: p.water_ml },
      expenses: state.expenses, meals: state.meals, water: state.water, week_end: todayIso(),
    });
    reviewState = { status: data.status, data };
    if (data.status === "ok") {
      state.reviews.push({ at: new Date().toISOString(), week_end: data.period.end, days_logged: data.days_logged, actions: data.actions.length });
      await store.save(state);
    }
  } catch (e) {
    reviewState = { status: "error", message: "The review could not run: " + (e.message || e) };
  }
  render();
}

async function shareText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Summary copied.");
  } catch {
    const note = document.getElementById("note");
    if (note) note.textContent = text;
    toast("Copy is blocked here. The text is shown below.");
  }
}

async function plainSummary(d) {
  const note = document.getElementById("note");
  note.replaceChildren(h("span", { class: "spinner" }), "Writing…");
  try {
    const reply = await anna.llm.complete({
      messages: [{ role: "user", content: { type: "text", text:
        "Rewrite this weekly money and nutrition review as three short plain sentences for the person who logged it. " +
        "Use only the numbers given. Do not add advice that is not in the list.\n\n" + JSON.stringify({ headline: d.headline, actions: d.actions }) } }],
      maxTokens: 220,
    });
    note.textContent = reply?.content?.text || "No text came back.";
  } catch (e) {
    note.textContent = "The note could not be written (" + (e.code || e.message || "error") + "). The review above is complete.";
  }
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `smartassistant-backup-${todayIso()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast("Backup exported successfully.");
}

function importBackup(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const parsed = JSON.parse(evt.target.result);
      state = normalize(parsed);
      await commit("Backup restored successfully!");
    } catch {
      toast("Invalid backup file.");
    }
  };
  reader.readAsText(file);
}

function settingsView() {
  const done = state.reviews.length;
  const streak = calculateStreak();
  const fileInput = h("input", { type: "file", accept: ".json", style: "display:none;", onchange: importBackup });

  return h("section", {},
    h("div", { class: "card" }, h("h2", {}, "Targets"),
      h("p", {}, `${state.profile.calories} kcal, ${state.profile.protein_g} g protein, ${state.profile.water_ml} ml water per day.`),
      h("p", { class: "muted" }, `Monthly budget ${fmtMoney(state.profile.monthly_budget)}, fixed costs ${fmtMoney(state.profile.fixed_costs)}.`),
      h("button", { onclick: async () => { state.profile = null; state.plan = null; await commit(); } }, "Change my numbers")),

    h("div", { class: "card" }, h("h2", {}, "Your Consistency & Stats"),
      h("p", {}, `🔥 Current Streak: ${streak} day${streak === 1 ? "" : "s"} in a row.`),
      h("p", {}, `${state.expenses.length} expenses, ${state.meals.length} meals and ${state.water.length} water entries stored. Reviews completed: ${done}.`),
      h("p", { class: "muted" }, `Entries older than ${KEEP_DAYS} days are automatically pruned to keep your Anna storage lightweight.`)),

    h("div", { class: "card" }, h("h2", {}, "Backup & Privacy"),
      h("p", { class: "muted" }, "Your data is stored locally in Anna storage. You can export or restore anytime:"),
      h("div", { class: "row" },
        h("button", { onclick: exportBackup }, "📥 Export Data (JSON)"),
        h("button", { onclick: () => fileInput.click() }, "📤 Restore from Backup"),
        fileInput)),

    h("div", { class: "card" }, h("h2", {}, "Reset"),
      h("button", { onclick: async () => {
        if (!confirm("Delete all entries and targets? This cannot be undone.")) return;
        state = normalize(null); reviewState = { status: "idle" }; view = "today"; await commit("All data deleted.");
      } }, "Delete all my data")));
}

function render() {
  $app.setAttribute("aria-busy", "false");
  if (!state.profile) { $app.replaceChildren(onboardingView()); return; }

  const streak = calculateStreak();
  const tab = (id, label) => h("button", { "aria-current": view === id ? "page" : null, onclick: () => { view = id; render(); } }, label);
  const views = { today: todayView, review: reviewView, settings: settingsView };

  $app.replaceChildren(
    h("nav", { class: "tabs", "aria-label": "Sections" },
      tab("today", "Today"),
      tab("review", "Weekly review"),
      tab("settings", "Settings"),
      streak > 0 && h("span", { class: "streak-badge", title: `${streak} day streak` }, `🔥 ${streak}d`)),
    views[view]());
}

async function main() {
  await connectHost();
  try {
    state = await store.load();
    render();
    // Live ticking timer for fasting
    setInterval(() => {
      if (state.fasting && view === "today") render();
    }, 60000);
  } catch (e) {
    $app.setAttribute("aria-busy", "false");
    $app.replaceChildren(h("p", { class: "error", role: "alert" }, "Could not load your data: " + (e.message || e)),
      h("button", { class: "primary", onclick: () => location.reload() }, "Try again"));
  }
}
main();
