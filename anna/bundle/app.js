// SmartAssistant Anna App: onboarding, quick logs and a weekly money and
// nutrition review. Data lives in Anna Storage inside Anna and in
// localStorage when the bundle is opened outside the host.

import { TOOLS, todayIso } from "./engine.js";

const STORE_KEY = "smartassistant:v1";
const HANDLE = "smartassistant";
const KEEP_DAYS = 120; // storage values are capped at 256 KB, so old rows are pruned
const CATEGORIES = ["Food", "Eating out", "Transport", "Bills", "Health", "Fun", "Other"];
const CURRENCIES = ["USD", "EUR", "GBP", "TRY", "CAD", "AUD", "INR"];

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
let view = "today";
let busy = false;
let reviewState = { status: "idle" };

const uid = () => Math.random().toString(36).slice(2, 10);
const sumWhere = (rows, key, day) => rows.filter((r) => r.date === day).reduce((a, r) => a + (+r[key] || 0), 0);
const fmtMoney = (n) => {
  const cur = state.profile?.currency || "USD";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(n); }
  catch { return n.toFixed(2); }
};
const pct = (a, b) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);

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

  const amount = h("input", { id: "amt", type: "number", min: 0, step: "any", inputmode: "decimal", "aria-label": "Expense amount", placeholder: "Amount" });
  const addExpense = (cat) => {
    const v = parseFloat(amount.value);
    if (!(v > 0)) { toast("Enter an amount first."); amount.focus(); return; }
    addRow("expenses", { amount: v, category: cat }, `Added ${fmtMoney(v)} to ${cat}`);
  };
  const kcal = h("input", { type: "number", min: 0, inputmode: "numeric", "aria-label": "Calories", placeholder: "kcal" });
  const prot = h("input", { type: "number", min: 0, inputmode: "numeric", "aria-label": "Protein grams", placeholder: "protein g" });
  const lastMeal = state.meals[state.meals.length - 1];

  return h("section", {},
    h("div", { class: "card" }, h("h2", {}, "Today"),
      h("div", { class: "grid" },
        h("div", { class: "stat" }, h("b", {}, safe ? fmtMoney(Math.max(0, leftToday)) : "–"), h("span", {}, leftToday != null && leftToday < 0 ? "over today's safe spend" : "left to spend today")),
        h("div", { class: "stat" }, h("b", {}, `${kcalToday} / ${p.calories}`), h("span", {}, "kcal")),
        h("div", { class: "stat" }, h("b", {}, `${proteinToday} / ${p.protein_g} g`), h("span", {}, "protein")),
        h("div", { class: "stat" }, h("b", {}, `${waterToday} / ${p.water_ml}`), h("span", {}, "ml water"))),
      h("div", { class: "bar" + (leftToday != null && leftToday < 0 ? " over" : "") }, h("i", { style: `width:${safe ? pct(spentToday, safe.safe_daily_spend) : 0}%` }))),
    h("div", { class: "card" }, h("h2", {}, "Water"),
      h("div", { class: "row" },
        [250, 500].map((ml) => h("button", { onclick: () => addRow("water", { ml }, `Added ${ml} ml`) }, `+${ml} ml`)))),
    h("div", { class: "card" }, h("h2", {}, "Expense"),
      h("div", { class: "row" }, h("div", { class: "grow" }, amount)),
      h("p", { class: "muted" }, "Type the amount, then tap a category."),
      h("div", { class: "row chips" }, CATEGORIES.map((c) => h("button", { onclick: () => addExpense(c) }, c)))),
    h("div", { class: "card" }, h("h2", {}, "Meal"),
      h("div", { class: "row" }, h("div", { class: "grow" }, kcal), h("div", { class: "grow" }, prot),
        h("button", { class: "primary", onclick: () => {
          const k = parseFloat(kcal.value);
          if (!(k > 0)) { toast("Enter the calories first."); kcal.focus(); return; }
          addRow("meals", { kcal: k, protein: Math.max(0, parseFloat(prot.value) || 0) }, `Added ${Math.round(k)} kcal`);
        } }, "Add")),
      lastMeal && h("div", { class: "row", style: "margin-top:8px" },
        h("button", { onclick: () => addRow("meals", { kcal: lastMeal.kcal, protein: lastMeal.protein }, `Repeated ${Math.round(lastMeal.kcal)} kcal`) },
          `Repeat last meal (${Math.round(lastMeal.kcal)} kcal)`))));
}

function reviewView() {
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
      // Local, private run counter. Nothing is sent anywhere.
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

function settingsView() {
  const done = state.reviews.length;
  return h("section", {},
    h("div", { class: "card" }, h("h2", {}, "Targets"),
      h("p", {}, `${state.profile.calories} kcal, ${state.profile.protein_g} g protein, ${state.profile.water_ml} ml water per day.`),
      h("p", { class: "muted" }, `Monthly budget ${fmtMoney(state.profile.monthly_budget)}, fixed costs ${fmtMoney(state.profile.fixed_costs)}.`),
      h("button", { onclick: async () => { state.profile = null; state.plan = null; await commit(); } }, "Change my numbers")),
    h("div", { class: "card" }, h("h2", {}, "Your history"),
      h("p", {}, `${state.expenses.length} expenses, ${state.meals.length} meals and ${state.water.length} water entries are stored. Reviews completed: ${done}.`),
      h("p", { class: "muted" }, `Entries older than ${KEEP_DAYS} days are removed automatically.`)),
    h("div", { class: "card" }, h("h2", {}, "Delete everything"),
      h("button", { onclick: async () => {
        if (!confirm("Delete all entries and targets? This cannot be undone.")) return;
        state = normalize(null); reviewState = { status: "idle" }; view = "today"; await commit("All data deleted.");
      } }, "Delete all my data")));
}

function render() {
  $app.setAttribute("aria-busy", "false");
  if (!state.profile) { $app.replaceChildren(onboardingView()); return; }
  const tab = (id, label) => h("button", { "aria-current": view === id ? "page" : null, onclick: () => { view = id; render(); } }, label);
  const views = { today: todayView, review: reviewView, settings: settingsView };
  $app.replaceChildren(h("nav", { class: "tabs", "aria-label": "Sections" }, tab("today", "Today"), tab("review", "Weekly review"), tab("settings", "Settings")), views[view]());
}

async function main() {
  await connectHost();
  try {
    state = await store.load();
    render();
  } catch (e) {
    $app.setAttribute("aria-busy", "false");
    $app.replaceChildren(h("p", { class: "error", role: "alert" }, "Could not load your data: " + (e.message || e)),
      h("button", { class: "primary", onclick: () => location.reload() }, "Try again"));
  }
}
main();
