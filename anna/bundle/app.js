// SmartAssistant Anna App v2.1: Editorial App-Shell architecture, Solar Tangerine
// + Matte Obsidian & Warm Paper Light themes, 2-stage Onboarding Studio, bilingual
// Smart Command Bar, Liquid-Fill Hydration, Dedicated Fasting Zones, and 7-day SVG Insights.

import { TOOLS, buildDailySeries, computeDailyPulse, parseQuickLog, todayIso } from "./engine.js";
import { icon } from "./icons.js";
import {
  categoryBreakdownEl,
  consistencyMatrixEl,
  exportShareCardPng,
  fastingArcSvg,
  pulseRingSvg,
  weeklyNutritionChartEl,
  weeklySpendChartEl,
} from "./charts.js";

const STORE_KEY = "smartassistant:v1";
const THEME_KEY = "smartassistant:theme";
const HANDLE = "smartassistant";
const KEEP_DAYS = 120;
const CATEGORIES = ["Food", "Eating out", "Transport", "Bills", "Health", "Fun", "Other"];
const CURRENCIES = ["USD", "EUR", "GBP", "TRY", "CAD", "AUD", "INR"];
const FASTING_PROTOCOLS = [14, 16, 18, 20];

const DEFAULT_MEAL_PRESETS = [
  { id: "preset-coffee", label: "Coffee / Tea", kcal: 40, protein: 1, custom: false },
  { id: "preset-lunch", label: "Light Lunch", kcal: 450, protein: 25, custom: false },
  { id: "preset-bowl", label: "Protein Bowl", kcal: 650, protein: 45, custom: false },
  { id: "preset-snack", label: "Greek Yogurt", kcal: 180, protein: 16, custom: false },
];

function getSavedTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(t) {
  const mode = t === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.backgroundColor = mode === "light" ? "#f4f1ea" : "#09090b";
  document.documentElement.style.colorScheme = mode;
  try { localStorage.setItem(THEME_KEY, mode); } catch {}
  return mode;
}

let currentTheme = applyTheme(getSavedTheme());

// ---------- DOM helpers ----------
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else if (v !== false && v != null) el.setAttribute(k, String(v));
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}

const $app = document.getElementById("app");
const $toast = document.getElementById("toast");
const $dialog = document.getElementById("confirm-dialog");

let toastTimer;
function hideToast() {
  clearTimeout(toastTimer);
  $toast.hidden = true;
}

function toast(msg, undo) {
  $toast.replaceChildren(h("span", {}, msg));
  if (undo) {
    let used = false;
    $toast.append(h("button", {
      type: "button",
      onclick: () => {
        if (used) return;
        used = true;
        hideToast();
        undo();
      },
    }, "Undo"));
  }
  $toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $toast.hidden = true; }, 5000);
}

$dialog.addEventListener("close", () => {
  $dialog.returnValue = "";
  if (!$dialog.open) $dialog.replaceChildren();
});

function confirmAction(title, message, action, confirmLabel = "Confirm", dangerous = false) {
  const error = h("p", { class: "error", role: "alert" });
  const cancel = h("button", {
    type: "button",
    autofocus: true,
    onclick: () => $dialog.close("cancel"),
  }, "Cancel");
  const confirmButton = h("button", {
    type: "button",
    class: dangerous ? "danger" : "primary",
    onclick: async () => {
      cancel.disabled = confirmButton.disabled = true;
      error.textContent = "";
      try {
        await action();
        $dialog.close("confirm");
      } catch (e) {
        error.textContent = e.message || "The action could not be completed.";
        cancel.disabled = confirmButton.disabled = false;
      }
    },
  }, confirmLabel);

  $dialog.replaceChildren(
    h("div", { class: "dialog-inner" },
      h("h2", { id: "confirm-title" }, title),
      h("p", { class: "muted" }, message),
      error,
      h("div", { class: "dialog-actions" }, cancel, confirmButton),
    ),
  );
  if (typeof $dialog.showModal === "function") $dialog.showModal();
  else $dialog.setAttribute("open", "");
  cancel.focus();
}

function showShareCardModal(dataUrl, filename) {
  const closeBtn = h("button", {
    type: "button",
    autofocus: true,
    onclick: () => $dialog.close("close"),
  }, "Close");
  const dlLink = h("a", {
    href: dataUrl,
    download: filename,
    class: "share-dl-link",
  }, h("button", { type: "button", class: "primary" }, icon("download", 14), "Save PNG"));

  $dialog.replaceChildren(
    h("div", { class: "dialog-inner" },
      h("h2", { id: "confirm-title" }, "Weekly Pulse Scorecard"),
      h("p", { class: "muted" }, "Ready to share — save the PNG or right-click to copy the image."),
      h("img", { src: dataUrl, alt: "Weekly Pulse Share Card", class: "share-preview-img" }),
      h("div", { class: "dialog-actions" }, dlLink, closeBtn),
    ),
  );
  if (typeof $dialog.showModal === "function") $dialog.showModal();
  else $dialog.setAttribute("open", "");
  closeBtn.focus();
}

function toggleTheme() {
  currentTheme = applyTheme(currentTheme === "dark" ? "light" : "dark");
  state.theme = currentTheme;
  if (state.profile) {
    const snapshot = structuredClone(state);
    saveQueue = saveQueue.then(() => store.save(snapshot)).catch(() => {});
  }
  render();
}

// ---------- host connection ----------
let anna = null;
async function connectHost() {
  const params = new URLSearchParams(location.search);
  const hasWid = params.has("wid");

  let mod;
  try {
    mod = await import("./anna-app-runtime.js");
  } catch {
    try {
      mod = await import("/static/anna-apps/_sdk/latest/index.js");
    } catch {
      // offline / standalone
    }
  }

  const AnnaRuntime = mod?.AnnaAppRuntime || mod?.default;

  if (!hasWid) {
    if (AnnaRuntime) {
      try {
        anna = await Promise.race([
          AnnaRuntime.connect(),
          new Promise((_, rej) => setTimeout(() => rej(new Error("handshake timed out")), 2000)),
        ]);
        window.anna = anna;
        try { await anna.window?.ready?.(); } catch {}
      } catch {
        anna = null;
      }
    } else {
      anna = null;
    }
    return;
  }

  if (sessionStorage.getItem("smartassistant:offline") === "1") {
    anna = null;
    return;
  }

  if (AnnaRuntime) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        anna = await Promise.race([
          AnnaRuntime.connect(),
          new Promise((_, rej) => setTimeout(() => rej(new Error("host handshake timed out")), 10000)),
        ]);
        window.anna = anna;
        try { await anna.window?.ready?.(); } catch {}
        return;
      } catch {
        if (attempt === 1) await new Promise((r) => setTimeout(r, 800));
      }
    }
  }

  anna = null;
  throw new Error("Could not connect to Anna. Reopen the app and check your connection.");
}

// ---------- data layer ----------
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
  async save(s) {
    prune(s);
    if (anna) await anna.storage.set({ key: STORE_KEY, value: s });
    else localStorage.setItem(STORE_KEY, JSON.stringify(s));
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
    fastingProtocol: FASTING_PROTOCOLS.includes(Number(s.fastingProtocol)) ? Number(s.fastingProtocol) : 16,
    fastingHistory: Array.isArray(s.fastingHistory) ? s.fastingHistory : [],
    presets: Array.isArray(s.presets) ? s.presets : DEFAULT_MEAL_PRESETS.map((p) => ({ ...p })),
    theme: s.theme === "light" || s.theme === "dark" ? s.theme : null,
  };
}

function prune(s) {
  const d = new Date();
  d.setDate(d.getDate() - KEEP_DAYS);
  const cutoff = d.toISOString().slice(0, 10);
  for (const k of ["expenses", "meals", "water"]) s[k] = s[k].filter((r) => r.date >= cutoff);
  s.reviews = s.reviews.slice(-26);
  s.fastingHistory = (s.fastingHistory || []).slice(-60);
}

// ---------- tools ----------
async function callTool(method, args) {
  if (anna) {
    const toolId = (window.__ANNA_TOOL_IDS__ || {})[HANDLE];
    if (!toolId) throw new Error("SmartAssistant's tool is not configured. Please reinstall the app.");
    try {
      const res = await anna.tools.invoke({ tool_id: toolId, method, args, timeoutMs: 20000 });
      let out = res && "result" in res ? res.result : res;
      if (out && out.success === false) throw new Error(out.error || "tool failed");
      if (out && out.success === true && "data" in out) out = out.data;
      return { data: out, via: "executa" };
    } catch (e) {
      if (method === "parse_quick_log") {
        return { data: TOOLS.parse_quick_log(args), via: "local-fallback" };
      }
      if (/plan_targets|weekly_review|must be|must be at/.test(String(e.message))) throw e;
      throw new Error("SmartAssistant's tool is unavailable. Check that its Executa is running on your Anna Agent, then try again.");
    }
  }
  return { data: TOOLS[method](args), via: "local" };
}

// ---------- state + helpers ----------
let state = normalize(null);
let view = new URLSearchParams(location.search).get("view") || "today";
if (view === "review") view = "insights";
if (!["today", "fasting", "insights", "settings"].includes(view)) view = "today";

let onboardingStep = 0;
let logTab = "expense";
let reviewState = { status: "idle" };
let timelineFilter = "all";
let editingTargets = false;
let quickText = "";
let aiBusy = false;
let saveQueue = Promise.resolve();
let stateRevision = 0;

const uid = () => Math.random().toString(36).slice(2, 10);
const sumWhere = (rows, key, day) => rows.filter((r) => r.date === day).reduce((a, r) => a + (+r[key] || 0), 0);
const fmtMoney = (n) => {
  const cur = state.profile?.currency || "USD";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(n); }
  catch { return n.toFixed(2); }
};
const pct = (a, b) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);

function dateOffsetIso(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function calculateStreak() {
  const daysWithLogs = new Set();
  for (const r of state.expenses) daysWithLogs.add(r.date);
  for (const r of state.meals) daysWithLogs.add(r.date);
  for (const r of state.water) daysWithLogs.add(r.date);

  let streak = 0;
  const curr = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const getIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (!daysWithLogs.has(getIso(curr))) curr.setDate(curr.getDate() - 1);
  while (daysWithLogs.has(getIso(curr))) {
    streak++;
    curr.setDate(curr.getDate() - 1);
  }
  return streak;
}

async function commit(msg, undo) {
  const revision = ++stateRevision;
  hideToast();
  const snapshot = structuredClone(state);
  const save = saveQueue.then(() => store.save(snapshot));
  saveQueue = save.catch(() => {});
  try {
    await save;
    if (msg && revision === stateRevision) toast(msg, undo);
    render();
    return true;
  } catch (e) {
    if (revision === stateRevision) {
      try { state = await store.load(); } catch { /* retain view */ }
    }
    toast("Could not save: " + (e.message || "storage error"));
    render();
    return false;
  }
}

function addRow(kind, row, label) {
  const item = { id: uid(), date: todayIso(), ts: Date.now(), ...row };
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

// ---------- sample data for instant local preview ----------
async function loadSampleWeek() {
  const existingPlan = TOOLS.plan_targets({
    weight_kg: 74, height_cm: 178, age: 23, sex: "male",
    activity: "moderate", goal: "maintain",
    monthly_budget: 1800, fixed_costs: 650, spent_so_far: 0, today: todayIso(),
  });
  state = normalize({
    v: 1,
    profile: {
      currency: "USD",
      monthly_budget: 1800,
      fixed_costs: 650,
      calories: existingPlan.calories,
      protein_g: existingPlan.protein_g,
      fat_g: existingPlan.fat_g,
      carbs_g: existingPlan.carbs_g,
      water_ml: existingPlan.water_ml,
      inputs: { weight_kg: 74, height_cm: 178, age: 23, sex: "male", activity: "moderate", goal: "maintain" },
    },
    plan: existingPlan,
    fastingProtocol: 16,
    fasting: { started_at: new Date(Date.now() - 12.6 * 3600 * 1000).toISOString(), target_hours: 16 },
    fastingHistory: [
      { id: uid(), started_at: dateOffsetIso(3), ended_at: dateOffsetIso(2), hours: 16.2, target_hours: 16 },
      { id: uid(), started_at: dateOffsetIso(1), ended_at: dateOffsetIso(0), hours: 16.5, target_hours: 16 },
    ],
    expenses: [
      { id: uid(), date: dateOffsetIso(6), amount: 24.5, category: "Food", note: "Grocery essentials" },
      { id: uid(), date: dateOffsetIso(5), amount: 14.0, category: "Eating out", note: "Chicken bowl" },
      { id: uid(), date: dateOffsetIso(4), amount: 8.5, category: "Transport", note: "Metro pass" },
      { id: uid(), date: dateOffsetIso(3), amount: 42.0, category: "Eating out", note: "Dinner with friends" },
      { id: uid(), date: dateOffsetIso(2), amount: 19.0, category: "Food", note: "Fresh produce" },
      { id: uid(), date: dateOffsetIso(1), amount: 11.2, category: "Fun", note: "Coffee & book" },
      { id: uid(), date: todayIso(), amount: 13.5, category: "Eating out", note: "Lunch bowl" },
    ],
    meals: [
      { id: uid(), date: dateOffsetIso(6), kcal: 2450, protein: 118, label: "Daily Meals" },
      { id: uid(), date: dateOffsetIso(5), kcal: 2380, protein: 124, label: "Daily Meals" },
      { id: uid(), date: dateOffsetIso(4), kcal: 2520, protein: 115, label: "Daily Meals" },
      { id: uid(), date: dateOffsetIso(3), kcal: 2790, protein: 108, label: "Daily Meals" },
      { id: uid(), date: dateOffsetIso(2), kcal: 2340, protein: 128, label: "Daily Meals" },
      { id: uid(), date: dateOffsetIso(1), kcal: 2410, protein: 122, label: "Daily Meals" },
      { id: uid(), date: todayIso(), kcal: 1420, protein: 86, label: "Protein Bowl & Shake" },
    ],
    water: [
      { id: uid(), date: dateOffsetIso(6), ml: 2250 },
      { id: uid(), date: dateOffsetIso(5), ml: 2500 },
      { id: uid(), date: dateOffsetIso(4), ml: 2000 },
      { id: uid(), date: dateOffsetIso(3), ml: 1500 },
      { id: uid(), date: dateOffsetIso(2), ml: 2500 },
      { id: uid(), date: dateOffsetIso(1), ml: 2250 },
      { id: uid(), date: todayIso(), ml: 1750 },
    ],
    reviews: [],
    presets: DEFAULT_MEAL_PRESETS.map((p) => ({ ...p })),
  });
  reviewState = { status: "idle" };
  editingTargets = false;
  onboardingStep = 0;
  view = "today";
  await commit("Loaded 7-day sample data!");
}

// ---------- numeric input helper ----------
function field(label, attrs) {
  if (attrs.type === "number") {
    const isDecimal = attrs.step === "any";
    const pattern = isDecimal ? /[^0-9.]/ : /[^0-9]/;
    const prevBefore = attrs.onbeforeinput;
    attrs.onbeforeinput = (e) => {
      if (prevBefore) prevBefore(e);
      if (e.defaultPrevented || !e.data) return;
      if (pattern.test(e.data)) e.preventDefault();
    };
    const prevPaste = attrs.onpaste;
    attrs.onpaste = (e) => {
      if (prevPaste) prevPaste(e);
      if (e.defaultPrevented) return;
      const text = e.clipboardData?.getData("text") || "";
      if (pattern.test(text)) e.preventDefault();
    };
  }
  return h("label", {}, label, h("input", attrs));
}

// ---------- Onboarding Stages ----------
function profileForm(isEditing = false, liveBoxTarget = null) {
  const p = state.profile;
  const inp = p?.inputs || {};
  const err = h("p", { class: "error", role: "alert" });
  const liveBox = liveBoxTarget || h("div", { class: "preview-tiles", style: "margin-block: 0.6rem 1rem;" });

  const form = h("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      err.textContent = "";
      try {
        const day = todayIso();
        const monthSpent = state.expenses
          .filter((r) => r.date.startsWith(day.slice(0, 7)))
          .reduce((a, r) => a + r.amount, 0);
        const args = {
          weight_kg: f.weight, height_cm: f.height, age: f.age, sex: f.sex, activity: f.activity, goal: f.goal,
          monthly_budget: f.budget, fixed_costs: f.fixed || 0, spent_so_far: monthSpent, today: day,
        };
        const { data } = await callTool("plan_targets", args);
        state.profile = {
          currency: f.currency, monthly_budget: +f.budget, fixed_costs: +(f.fixed || 0),
          calories: data.calories, protein_g: data.protein_g, water_ml: data.water_ml,
          fat_g: data.fat_g || Math.round((data.calories * 0.25) / 9),
          carbs_g: data.carbs_g || Math.max(0, Math.round((data.calories - data.protein_g * 4 - data.calories * 0.25) / 4)),
          inputs: { weight_kg: +f.weight, height_cm: +f.height, age: +f.age, sex: f.sex, activity: f.activity, goal: f.goal },
        };
        state.plan = data;
        editingTargets = false;
        onboardingStep = 0;
        if (!await commit(isEditing ? "Targets updated." : null)) throw new Error("Could not save your numbers.");
      } catch (ex) {
        err.textContent = ex.message;
        btn.disabled = false;
      }
    },
  });

  const updatePreview = () => {
    const f = Object.fromEntries(new FormData(form));
    try {
      const preview = TOOLS.plan_targets({
        weight_kg: f.weight, height_cm: f.height, age: f.age, sex: f.sex,
        activity: f.activity, goal: f.goal, monthly_budget: f.budget, fixed_costs: f.fixed || 0,
        spent_so_far: 0, today: todayIso(),
      });
      liveBox.replaceChildren(
        h("div", { class: "preview-tile" }, h("b", { class: "tnum" }, `${f.currency} ${preview.safe_daily_spend.toFixed(2)}`), h("span", {}, "Safe daily spend")),
        h("div", { class: "preview-tile" }, h("b", { class: "tnum" }, `${preview.calories} kcal`), h("span", {}, "Daily calorie target")),
        h("div", { class: "preview-tile" }, h("b", { class: "tnum" }, `${preview.protein_g} g`), h("span", {}, "Daily protein")),
        h("div", { class: "preview-tile" }, h("b", { class: "tnum" }, `${preview.water_ml} ml`), h("span", {}, "Hydration target")),
      );
    } catch {
      liveBox.replaceChildren(
        h("div", { class: "preview-tile", style: "grid-column: 1 / -1;" },
          h("b", {}, "Live preview"),
          h("span", {}, "Enter your budget and body metrics to preview daily targets.")),
      );
    }
  };
  form.addEventListener("input", updatePreview);

  const curSel = () => CURRENCIES.map((c) => h("option", { value: c, selected: (p?.currency || "USD") === c }, c));

  form.append(
    h("div", { class: "grid-2" },
      field("Monthly budget", { name: "budget", type: "number", min: 0, step: "any", inputmode: "decimal", required: true, value: p?.monthly_budget ?? "" }),
      field("Fixed costs (rent, bills)", { name: "fixed", type: "number", min: 0, step: "any", inputmode: "decimal", placeholder: "0", value: p?.fixed_costs ?? "" })),
    h("label", {}, "Currency", h("select", { name: "currency" }, curSel())),
    h("div", { class: "grid-3" },
      field("Weight (kg)", { name: "weight", type: "number", min: 30, max: 300, step: "any", inputmode: "decimal", required: true, value: inp.weight_kg ?? "" }),
      field("Height (cm)", { name: "height", type: "number", min: 120, max: 230, step: "any", inputmode: "decimal", required: true, value: inp.height_cm ?? "" }),
      field("Age", { name: "age", type: "number", min: 14, max: 100, inputmode: "numeric", required: true, value: inp.age ?? "" })),
    h("div", { class: "grid-3" },
      h("label", {}, "Sex", h("select", { name: "sex" },
        h("option", { value: "female", selected: (inp.sex || "female") === "female" }, "Female"),
        h("option", { value: "male", selected: inp.sex === "male" }, "Male"))),
      h("label", {}, "Activity", h("select", { name: "activity" },
        h("option", { value: "sedentary", selected: inp.activity === "sedentary" }, "Sedentary"),
        h("option", { value: "light", selected: (inp.activity || "light") === "light" }, "Light"),
        h("option", { value: "moderate", selected: inp.activity === "moderate" }, "Moderate"),
        h("option", { value: "active", selected: inp.activity === "active" }, "Active"))),
      h("label", {}, "Goal", h("select", { name: "goal" },
        h("option", { value: "lose", selected: inp.goal === "lose" }, "Lose weight"),
        h("option", { value: "maintain", selected: (inp.goal || "maintain") === "maintain" }, "Maintain"),
        h("option", { value: "gain", selected: inp.goal === "gain" }, "Gain muscle")))),
    ...(!liveBoxTarget ? [liveBox] : []),
    err,
    h("div", { class: "row", style: "margin-block-start: 0.75rem;" },
      h("button", { class: "pill-cta", type: "submit" },
        isEditing ? "Save updated targets" : "Show my daily numbers",
        h("span", { class: "cta-arrow" }, icon("arrowRight", 14))),
      isEditing && h("button", { type: "button", class: "ghost", onclick: () => { editingTargets = false; render(); } }, "Cancel")),
  );
  updatePreview();
  return form;
}

function welcomeStageView() {
  return h("section", { class: "welcome-stage view-enter" },
    h("div", {},
      h("span", { class: "eyebrow eyebrow-rule" }, "Daily Runway & Habit OS"),
      h("h1", { class: "display-hero" }, "Master your daily ", h("span", { class: "accent-word" }, "runway"), " without guesswork."),
      h("p", { class: "welcome-sub" }, "Budget pace, protein and water targets, metabolic fasting, and an honest weekly coaching brief in one calm workspace."),
      h("div", { class: "row", style: "gap: 0.75rem;" },
        h("button", {
          type: "button",
          class: "pill-cta",
          onclick: () => { onboardingStep = 1; render(); },
        }, "Set up my numbers", h("span", { class: "cta-arrow" }, icon("arrowRight", 14))),
        h("button", {
          type: "button",
          class: "ghost",
          onclick: loadSampleWeek,
        }, "Load 7-day sample ", icon("arrowRight", 14))),
      h("div", { class: "welcome-pillars" },
        h("div", {},
          h("div", { class: "pillar-title" }, "Safe daily spend"),
          h("p", { class: "pillar-desc" }, "Live daily budget allowance after fixed bills.")),
        h("div", {},
          h("div", { class: "pillar-title" }, "One-line logging"),
          h("p", { class: "pillar-desc" }, "Log meals, spend & water from one prompt.")),
        h("div", {},
          h("div", { class: "pillar-title" }, "Zero guesswork"),
          h("p", { class: "pillar-desc" }, "Reviews strictly grounded in your actual logs.")))),

    h("div", { class: "hero-mockup-wrap" },
      h("div", { class: "float-callout top" }, icon("sparkles", 14), "Works offline & in Anna"),
      h("div", { class: "hero-mockup-card" },
        h("div", { class: "mock-step" },
          h("span", { class: "mock-num tnum" }, "01"),
          h("div", {},
            h("div", { class: "mock-title" }, "Safe Daily Runway"),
            h("div", { class: "mock-sub tnum" }, "$120.83 safe today · Pace on track"))),
        h("div", { class: "mock-step active" },
          h("span", { class: "mock-num tnum" }, "02"),
          h("div", {},
            h("div", { class: "mock-title" }, "Smart Quick Log"),
            h("div", { class: "mock-sub" }, '"tavuk pilav 180 tl 500ml su" · 1 click'))),
        h("div", { class: "mock-step" },
          h("span", { class: "mock-num tnum" }, "03"),
          h("div", {},
            h("div", { class: "mock-title" }, "Weekly Review Brief"),
            h("div", { class: "mock-sub" }, "Actionable next steps + PNG scorecard"))),
        h("div", { class: "mock-footer" },
          h("span", {}, "CALCULATED LOCALLY"),
          h("strong", {}, "Your data stays", h("br"), "under your control."))),
      h("div", { class: "float-callout bot" }, icon("check", 14), "Honest metrics")),
  );
}

function setupStudioView() {
  const previewGrid = h("div", { class: "preview-tiles" });
  return h("section", { class: "studio-frame view-enter" },
    h("div", { class: "studio-topbar" },
      h("button", { type: "button", class: "ghost", onclick: () => { onboardingStep = 0; render(); } }, icon("arrowLeft", 14), "Back"),
      h("span", { class: "eyebrow" }, "Takes under a minute")),
    h("div", { class: "studio-split" },
      h("div", {},
        h("span", { class: "eyebrow", style: "margin-block-end: 0.45rem;" }, "Start with your numbers"),
        h("h1", { style: "font-size: 1.75rem; margin-block-end: 0.6rem;" }, "Set up in about a minute"),
        h("p", { class: "muted" }, "Tell SmartAssistant your monthly budget and body metrics once. Everything updates live as you type and uses Mifflin-St Jeor locally."),
        previewGrid,
        h("p", { class: "muted", style: "margin-block-start: 0.9rem; font-size: 0.76rem;" }, "Estimates only, not medical advice. Data stays in your Anna storage.")),
      profileForm(false, previewGrid)));
}

// ---------- smart command bar ----------
function chipSummaryFromParsed(parsed) {
  const chips = [];
  for (const exp of parsed.expenses || []) {
    chips.push(h("span", { class: "cmd-chip money" }, icon("wallet", 13), `+${fmtMoney(exp.amount)} · ${exp.category}`));
  }
  for (const m of parsed.meals || []) {
    const estTag = m.estimated ? " (est.)" : "";
    chips.push(h("span", { class: "cmd-chip meal" }, icon("utensils", 13), `${m.label}: ${m.kcal} kcal · ${m.protein}g P${estTag}`));
  }
  for (const w of parsed.water || []) {
    chips.push(h("span", { class: "cmd-chip water" }, icon("droplet", 13), `+${w.ml} ml water`));
  }
  if (parsed.fasting) {
    chips.push(h("span", { class: "cmd-chip fast" }, icon("timer", 13),
      parsed.fasting.action === "stop" ? "End fast" : `Start ${parsed.fasting.target_hours || 16}h fast`));
  }
  return chips;
}

async function applyParsedQuickLog(parsed, viaAi = false) {
  const undoSnapshots = {
    expenseIds: [],
    mealIds: [],
    waterIds: [],
    prevFasting: state.fasting ? structuredClone(state.fasting) : null,
  };
  const day = todayIso();
  const ts = Date.now();
  const labels = [];

  for (const exp of parsed.expenses || []) {
    const id = uid();
    state.expenses.push({ id, date: day, ts, amount: exp.amount, category: exp.category, note: parsed.raw || "" });
    undoSnapshots.expenseIds.push(id);
    labels.push(fmtMoney(exp.amount));
  }
  for (const m of parsed.meals || []) {
    const id = uid();
    state.meals.push({ id, date: day, ts, kcal: m.kcal, protein: m.protein, label: m.label });
    undoSnapshots.mealIds.push(id);
    labels.push(`${m.kcal} kcal`);
  }
  for (const w of parsed.water || []) {
    const id = uid();
    state.water.push({ id, date: day, ts, ml: w.ml });
    undoSnapshots.waterIds.push(id);
    labels.push(`${w.ml} ml`);
  }
  if (parsed.fasting) {
    if (parsed.fasting.action === "stop") {
      state.fasting = null;
      labels.push("fast ended");
    } else {
      const hrs = parsed.fasting.target_hours || state.fastingProtocol || 16;
      state.fastingProtocol = hrs;
      state.fasting = { started_at: new Date().toISOString(), target_hours: hrs };
      labels.push(`${hrs}h fast`);
    }
  }

  quickText = "";
  const prefix = viaAi ? "AI logged: " : "Logged ";
  await commit(prefix + labels.join(" + "), () => {
    if (undoSnapshots.expenseIds.length) state.expenses = state.expenses.filter((r) => !undoSnapshots.expenseIds.includes(r.id));
    if (undoSnapshots.mealIds.length) state.meals = state.meals.filter((r) => !undoSnapshots.mealIds.includes(r.id));
    if (undoSnapshots.waterIds.length) state.water = state.water.filter((r) => !undoSnapshots.waterIds.includes(r.id));
    state.fasting = undoSnapshots.prevFasting;
    commit();
  });
}

async function runAiQuickEstimate(rawText, statusEl) {
  if (!anna?.llm) {
    toast("Add amount, kcal, or ml (e.g. $12 500kcal 500ml). AI estimator activates inside Anna.");
    return;
  }
  aiBusy = true;
  statusEl.hidden = false;
  statusEl.replaceChildren(h("span", { class: "cmd-chip" }, h("span", { class: "spinner" }), "Asking Anna AI…"));
  try {
    const reply = await anna.llm.complete({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text:
            "Parse this personal tracker note into strict JSON with keys: " +
            "expenses (array of {amount, category} using Food, Eating out, Transport, Bills, Health, Fun, Other), " +
            "meals (array of {label, kcal, protein}), water (array of {ml}). " +
            "Estimate kcal/protein if a food name has no macros. Return ONLY JSON.\nInput: " + rawText,
        },
      }],
      maxTokens: 200,
    });
    const txt = reply?.content?.text || "";
    const jsonMatch = txt.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON returned");
    const aiParsed = JSON.parse(jsonMatch[0]);
    const clean = {
      raw: rawText,
      expenses: (Array.isArray(aiParsed.expenses) ? aiParsed.expenses : []).filter((e) => Number(e.amount) > 0).map((e) => ({
        amount: Math.round(Number(e.amount) * 100) / 100,
        category: CATEGORIES.includes(e.category) ? e.category : "Other",
      })),
      meals: (Array.isArray(aiParsed.meals) ? aiParsed.meals : []).filter((m) => Number(m.kcal) > 0).map((m) => ({
        label: String(m.label || "AI Meal").slice(0, 40),
        kcal: Math.round(Number(m.kcal)),
        protein: Math.max(0, Math.round(Number(m.protein || 0))),
      })),
      water: (Array.isArray(aiParsed.water) ? aiParsed.water : []).filter((w) => Number(w.ml) > 0).map((w) => ({
        ml: Math.round(Number(w.ml)),
      })),
      fasting: null,
    };
    if (!clean.expenses.length && !clean.meals.length && !clean.water.length) throw new Error("Nothing recognized");
    aiBusy = false;
    await applyParsedQuickLog(clean, true);
  } catch {
    aiBusy = false;
    toast("Could not estimate automatically — try adding numbers like 450kcal or $12.");
    render();
  }
}

function smartCommandCard() {
  const previewBox = h("div", { id: "quick-preview", class: "cmd-preview" });
  const input = h("input", {
    id: "quick-cmd",
    type: "text",
    autocomplete: "off",
    value: quickText,
    "aria-label": "Smart quick log",
    placeholder: 'Log "$14 chicken bowl 500ml" or "tavuk pilav 180 tl 500ml su"',
  });

  const refreshPreview = () => {
    quickText = input.value;
    if (!quickText.trim()) {
      previewBox.replaceChildren();
      previewBox.hidden = true;
      return;
    }
    previewBox.hidden = false;
    try {
      const parsed = parseQuickLog({ text: quickText });
      const chips = chipSummaryFromParsed(parsed);
      if (chips.length) previewBox.replaceChildren(...chips);
      else previewBox.replaceChildren(h("span", { class: "cmd-chip" }, anna?.llm ? "Ready for AI estimate" : "Add amount, kcal, protein (45p) or ml"));
    } catch {
      previewBox.replaceChildren();
    }
  };
  input.addEventListener("input", refreshPreview);

  const examples = [
    "$14 chicken bowl 500ml",
    "tavuk pilav 180 tl 500ml su",
    "start 16h fast",
  ];

  const card = h("div", { class: "cmd-wrap" },
    h("form", {
      class: "cmd-form",
      onsubmit: async (e) => {
        e.preventDefault();
        if (aiBusy) return;
        const val = input.value.trim();
        if (!val) { input.focus(); return; }
        try {
          const { data } = await callTool("parse_quick_log", { text: val });
          if (data.matched) await applyParsedQuickLog(data, false);
          else await runAiQuickEstimate(val, previewBox);
        } catch (ex) {
          toast(ex.message || "Could not parse input.");
        }
      },
    },
      icon("sparkles", 16, "cmd-icon"),
      input,
      anna?.llm && h("button", {
        type: "button",
        class: "ghost",
        title: "Estimate with Anna AI",
        onclick: () => {
          const val = input.value.trim();
          if (val && !aiBusy) runAiQuickEstimate(val, previewBox);
        },
      }, "AI"),
      h("button", { class: "primary", type: "submit" }, "Log")),
    previewBox,
    h("div", { class: "cmd-hint-line" },
      h("span", {}, "Examples:"),
      examples.map((ex) => h("button", {
        type: "button",
        class: "hint-link",
        onclick: () => {
          input.value = ex;
          refreshPreview();
          input.focus();
        },
      }, ex))),
  );
  refreshPreview();
  return card;
}

// ---------- fasting metrics & live non-destructive 1s ticker ----------
function getFastingMetrics(f) {
  const targetHours = f.target_hours || 16;
  const elapsedMs = Math.max(0, Date.now() - new Date(f.started_at).getTime());
  const elapsedHours = elapsedMs / 3600000;
  const totalSec = Math.floor(elapsedMs / 1000);
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  const digits = `${hh}h ${String(mm).padStart(2, "0")}m ${String(ss).padStart(2, "0")}s`;
  const progressPct = Math.min(100, (elapsedHours / targetHours) * 100);
  const isComplete = elapsedHours >= targetHours;
  const stageIndex = elapsedHours < 4 ? 0 : elapsedHours < 12 ? 1 : elapsedHours < 16 ? 2 : 3;
  const stageNames = ["Digestion", "Post-Absorptive", "Fat Mobilization", "Deep Ketosis"];
  const stage = stageNames[stageIndex];
  return { elapsedHours, targetHours, digits, progressPct, isComplete, stage, stageIndex };
}

function tickFastingDom() {
  if (!state.fasting?.started_at || (view !== "today" && view !== "fasting")) return;
  const m = getFastingMetrics(state.fasting);
  document.querySelectorAll("[data-fasting-digits]").forEach((el) => { el.textContent = m.digits; });
  document.querySelectorAll("[data-fasting-stage]").forEach((el) => {
    el.textContent = m.isComplete ? `Goal Met · ${m.stage}` : m.stage;
    el.className = "stage-badge" + (m.isComplete ? " done" : "");
  });
  document.querySelectorAll("[data-fasting-arc]").forEach((arcEl) => {
    const circ = Number(arcEl.getAttribute("data-circumference") || 188.5);
    const visualPct = Math.max(2, Math.min(100, m.progressPct));
    arcEl.setAttribute("stroke-dashoffset", (circ * (1 - visualPct / 100)).toFixed(2));
    arcEl.setAttribute("stroke", m.isComplete ? "var(--sage)" : "var(--accent)");
  });
}

function fastingCompactStrip() {
  const f = state.fasting;
  const proto = state.fastingProtocol || 16;
  if (!f || !f.started_at) {
    return h("div", { class: "fast-strip" },
      h("div", { class: "row", style: "gap: 0.5rem;" },
        icon("timer", 16),
        h("span", { style: "font-size: 0.84rem; font-weight: 600;" }, `Fasting · ${proto}:${24 - proto} ready`)),
      h("div", { class: "row", style: "gap: 0.35rem;" },
        h("button", {
          type: "button",
          class: "ghost",
          onclick: () => { view = "fasting"; render(); },
        }, "Configure"),
        h("button", {
          type: "button",
          class: "primary",
          onclick: () => {
            state.fasting = { started_at: new Date().toISOString(), target_hours: proto };
            commit(`Started ${proto}h fast!`);
          },
        }, `Start ${proto}h Fast`)));
  }

  const m = getFastingMetrics(f);
  return h("div", { class: "fast-strip" },
    h("div", { class: "row", style: "gap: 0.65rem;" },
      icon("timer", 16),
      h("div", {},
        h("span", { class: "timer-digits-sm tnum", "data-fasting-digits": "1" }, m.digits),
        h("span", { class: "muted", style: "margin-inline-start: 0.45rem; font-size: 0.76rem;" }, `/ ${m.targetHours}h`),
        h("span", { "data-fasting-stage": "1", class: "stage-badge" + (m.isComplete ? " done" : ""), style: "margin-inline-start: 0.5rem;" },
          m.isComplete ? `Goal Met · ${m.stage}` : m.stage))),
    h("button", { type: "button", class: "ghost", onclick: () => { view = "fasting"; render(); } }, "Zones →"));
}

// ---------- Workspace 1: Today ----------
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
  } catch { /* unavailable */ }

  const safeDaily = safe ? safe.safe_daily_spend : 0;
  const leftToday = safe ? safeDaily - spentToday : null;
  const pulse = computeDailyPulse({
    spentToday, safeDaily, kcalToday, kcalTarget: p.calories,
    proteinToday, proteinTarget: p.protein_g, waterToday, waterTarget: p.water_ml,
  });

  const elapsedMonthDays = Math.max(1, Number(day.slice(8, 10)));
  const avgDailyMonthSpend = monthSpent / elapsedMonthDays;
  const totalMonthDays = elapsedMonthDays + ((safe?.days_left_in_month || 1) - 1);
  const projectedRemaining = (p.monthly_budget - p.fixed_costs) - avgDailyMonthSpend * totalMonthDays;
  const paceNote = safe
    ? (projectedRemaining >= 0
        ? `On pace to keep ${fmtMoney(projectedRemaining)} unspent this month`
        : `Projected ${fmtMoney(Math.abs(projectedRemaining))} over budget at current pace`)
    : "Runway unavailable";

  const targetWater = p.water_ml || 2000;
  const waterPillsCount = 8;
  const filledPills = Math.min(waterPillsCount, Math.round((waterToday / targetWater) * waterPillsCount));

  const todayExpenses = state.expenses.filter((r) => r.date === day);
  const todayMeals = state.meals.filter((r) => r.date === day);
  const todayWater = state.water.filter((r) => r.date === day);

  // Numeric guards (preserved verbatim across all inputs)
  const amount = h("input", {
    id: "amt", type: "number", min: 0, step: "any", inputmode: "decimal", "aria-label": "Expense amount", placeholder: "Amount (e.g. 12.50)",
    onbeforeinput: (e) => { if (e.data && /[^0-9.]/.test(e.data)) e.preventDefault(); },
    onpaste: (e) => { const text = e.clipboardData?.getData("text") || ""; if (/[^0-9.]/.test(text)) e.preventDefault(); },
  });
  const addExpense = (cat) => {
    const v = parseFloat(amount.value);
    if (!(v > 0)) { toast("Enter an amount first."); amount.focus(); return; }
    addRow("expenses", { amount: v, category: cat }, `Added ${fmtMoney(v)} to ${cat}`);
    amount.value = "";
  };

  const kcal = h("input", {
    type: "number", min: 0, inputmode: "numeric", "aria-label": "Calories", placeholder: "kcal",
    onbeforeinput: (e) => { if (e.data && /[^0-9]/.test(e.data)) e.preventDefault(); },
    onpaste: (e) => { const text = e.clipboardData?.getData("text") || ""; if (/[^0-9]/.test(text)) e.preventDefault(); },
  });
  const proteinEdit = /^\d*(?:\.\d*)?$/;
  const proteinFinal = /^(?:\d+(?:\.\d*)?|\.\d+)$/;
  let lastProteinValue = "";
  const prot = h("input", {
    type: "text", inputmode: "decimal", "aria-label": "Protein grams", placeholder: "protein g",
    onbeforeinput: (e) => {
      if (e.data == null) return;
      const next = prot.value.slice(0, prot.selectionStart) + e.data + prot.value.slice(prot.selectionEnd);
      if (!proteinEdit.test(next)) e.preventDefault();
    },
    onpaste: (e) => {
      const inserted = e.clipboardData?.getData("text") || "";
      const next = prot.value.slice(0, prot.selectionStart) + inserted + prot.value.slice(prot.selectionEnd);
      if (!proteinEdit.test(next)) e.preventDefault();
    },
    oninput: () => {
      if (proteinEdit.test(prot.value)) lastProteinValue = prot.value;
      else prot.value = lastProteinValue;
    },
  });
  const mealLabel = h("input", { type: "text", "aria-label": "Meal name optional", placeholder: "Label (optional, e.g. Bowl)" });
  const lastMeal = state.meals[state.meals.length - 1];

  const timeline = [];
  if (timelineFilter === "all" || timelineFilter === "expenses") todayExpenses.forEach((r, idx) => timeline.push({ kind: "expenses", sortKey: r.ts || idx, row: r }));
  if (timelineFilter === "all" || timelineFilter === "meals") todayMeals.forEach((r, idx) => timeline.push({ kind: "meals", sortKey: r.ts || idx, row: r }));
  if (timelineFilter === "all" || timelineFilter === "water") todayWater.forEach((r, idx) => timeline.push({ kind: "water", sortKey: r.ts || idx, row: r }));
  timeline.sort((a, b) => b.sortKey - a.sortKey);

  const expensePanel = h("div", {},
    h("div", { class: "row", style: "margin-block-end: 0.55rem;" }, h("div", { class: "grow" }, amount)),
    h("p", { class: "muted", style: "font-size: 0.78rem;" }, `Tap category (spent today: ${fmtMoney(spentToday)}):`),
    h("div", { class: "chips" }, CATEGORIES.map((c) => h("button", { type: "button", onclick: () => addExpense(c) }, c))));

  const mealPanel = h("div", {},
    h("div", { class: "row", style: "margin-block-end: 0.5rem;" },
      h("div", { class: "grow" }, kcal),
      h("div", { class: "grow" }, prot),
      h("button", {
        type: "button",
        class: "primary",
        onclick: () => {
          const k = parseFloat(kcal.value);
          if (!(k > 0)) { toast("Enter the calories first."); kcal.focus(); return; }
          const proteinText = prot.value.trim();
          if (!proteinFinal.test(proteinText) || !Number.isFinite(Number(proteinText))) {
            toast("Enter a valid protein amount."); prot.focus(); return;
          }
          const lbl = mealLabel.value.trim() || "Meal";
          addRow("meals", { kcal: k, protein: Number(proteinText), label: lbl }, `Added ${Math.round(k)} kcal`);
          kcal.value = "";
          prot.value = "";
          mealLabel.value = "";
        },
      }, "Add Meal")),
    h("div", { class: "row", style: "margin-block-end: 0.6rem;" },
      h("div", { class: "grow" }, mealLabel),
      h("button", {
        type: "button",
        class: "ghost",
        title: "Save current meal inputs as reusable favorite",
        onclick: () => {
          const k = parseFloat(kcal.value);
          const pVal = parseFloat(prot.value);
          const lbl = mealLabel.value.trim();
          if (!(k > 0) || !Number.isFinite(pVal) || pVal < 0 || !lbl) {
            toast("Enter meal label, calories and protein to save a favorite.");
            return;
          }
          state.presets.push({ id: uid(), label: lbl.slice(0, 32), kcal: Math.round(k), protein: Math.round(pVal), custom: true });
          commit(`Saved "${lbl}" preset`);
        },
      }, icon("star", 14), "Save favorite")),
    h("div", { class: "chips" },
      (state.presets || []).map((m) => h("div", { class: "preset-chip" },
        h("button", {
          type: "button",
          class: "preset-use",
          onclick: () => addRow("meals", { kcal: m.kcal, protein: m.protein, label: m.label }, `Added ${m.label}`),
        }, `${m.label} · ${m.kcal}`),
        m.custom && h("button", {
          type: "button",
          class: "preset-del",
          "aria-label": `Remove ${m.label}`,
          onclick: () => {
            state.presets = state.presets.filter((x) => x.id !== m.id);
            commit(`Removed ${m.label} favorite`);
          },
        }, icon("x", 13))))),
    lastMeal && h("div", { style: "margin-block-start: 0.55rem;" },
      h("button", {
        type: "button",
        class: "ghost",
        onclick: () => addRow("meals", { kcal: lastMeal.kcal, protein: lastMeal.protein, label: lastMeal.label || "Meal" }, `Repeated ${Math.round(lastMeal.kcal)} kcal`),
      }, icon("clock", 14), `Repeat last (${lastMeal.label || "Meal"} · ${Math.round(lastMeal.kcal)} kcal)`)));

  return h("section", { class: "today-grid view-enter" },
    // Left Column: Runway Hero + Quick Log + Ledger
    h("div", { class: "col-stack" },
      h("div", { class: "hero-open" },
        h("div", { class: "hero-top" },
          h("div", { style: "min-inline-size: 0;" },
            h("span", { class: "eyebrow" },
              h("span", { class: "status-dot", style: leftToday != null && leftToday < 0 ? "background: var(--rose)" : "" }),
              leftToday != null && leftToday < 0 ? "Over Today's Safe Spend" : "Safe To Spend Today"),
            h("div", { class: "runway-big tnum" + (leftToday != null && leftToday < 0 ? " over" : "") },
              safe ? fmtMoney(Math.max(0, leftToday)) : "–"),
            h("p", { class: "runway-meta tnum" },
              leftToday != null && leftToday < 0
                ? `${fmtMoney(Math.abs(leftToday))} over today's safe spend · ${fmtMoney(spentToday)} spent`
                : `${safe ? fmtMoney(Math.max(0, leftToday)) + " left to spend today · " : ""}${paceNote}`)),
          pulseRingSvg(pulse.total)),
        h("div", { class: "hero-strip" },
          h("div", { class: "strip-cell" },
            h("span", { class: "strip-lbl" }, "Calories"),
            h("span", { class: "strip-val tnum" }, `${kcalToday} / ${p.calories}`),
            h("div", { class: "thin-track" }, h("span", { class: "thin-fill", style: `width:${pct(kcalToday, p.calories)}%;background:var(--accent)` }))),
          h("div", { class: "strip-cell" },
            h("span", { class: "strip-lbl" }, "Protein"),
            h("span", { class: "strip-val tnum" }, `${proteinToday} / ${p.protein_g} g`),
            h("div", { class: "thin-track" }, h("span", { class: "thin-fill", style: `width:${pct(proteinToday, p.protein_g)}%;background:var(--lilac)` }))),
          h("div", { class: "strip-cell" },
            h("span", { class: "strip-lbl" }, "Water"),
            h("span", { class: "strip-val tnum" }, `${waterToday} / ${p.water_ml} ml`),
            h("div", { class: "thin-track" }, h("span", { class: "thin-fill", style: `width:${pct(waterToday, p.water_ml)}%;background:var(--ice)` }))))),

      smartCommandCard(),

      h("div", { class: "ledger-section" },
        h("div", { class: "card-head" },
          h("div", { class: "card-title" }, icon("trendingUp", 16), `Today's Ledger (${todayExpenses.length + todayMeals.length + todayWater.length})`),
          h("div", { class: "filter-pills" },
            [["all", "All"], ["expenses", "Spend"], ["meals", "Meals"], ["water", "Water"]].map(([k, lbl]) => h("button", {
              type: "button",
              "aria-pressed": timelineFilter === k ? "true" : "false",
              onclick: () => { timelineFilter = k; render(); },
            }, lbl)))),
        timeline.length === 0
          ? h("p", { class: "muted" }, "Nothing logged yet today.")
          : h("div", { class: "log-list" },
              timeline.map(({ kind, row }) => {
                const dotCls = kind === "expenses" ? "exp" : kind === "meals" ? "meal" : "water";
                const icoName = kind === "expenses" ? "wallet" : kind === "meals" ? "utensils" : "droplet";
                const labelText = kind === "expenses"
                  ? `${row.category}: ${fmtMoney(row.amount)}`
                  : kind === "meals"
                    ? `${row.label || "Meal"} · ${Math.round(row.kcal)} kcal · ${row.protein || 0}g protein`
                    : `Water · +${row.ml} ml`;
                return h("div", { class: "log-item" },
                  h("div", { class: "log-left" },
                    h("div", { class: `log-dot ${dotCls}` }, icon(icoName, 14)),
                    h("span", { class: "tnum" }, labelText)),
                  h("button", {
                    type: "button",
                    class: "del-btn",
                    "aria-label": `Remove ${labelText}`,
                    onclick: () => removeRow(kind, row.id, `Removed ${kind.slice(0, -1)} entry`),
                  }, icon("x", 14)));
              })))),

    // Right Column: Hydration + Compact Fasting + Segmented Manual Logger
    h("div", { class: "col-stack" },
      h("div", { class: "card water-card", style: `--water-fill: ${Math.min(1, waterToday / targetWater).toFixed(3)}` },
        h("div", { class: "water-fill-bg", "aria-hidden": "true" }),
        h("div", { class: "card-head" },
          h("div", { class: "card-title" }, icon("droplet", 16), "Hydration"),
          h("span", { class: "card-sub tnum" }, `${waterToday} / ${targetWater} ml (${pct(waterToday, targetWater)}%)`)),
        h("div", { class: "water-pills" },
          Array.from({ length: waterPillsCount }, (_, i) => h("div", { class: "water-pill" + (i < filledPills ? " filled" : "") }))),
        h("div", { class: "row" },
          h("button", { type: "button", onclick: () => addRow("water", { ml: 250 }, "Added 250 ml (Glass)") }, icon("droplet", 15), "+250 ml"),
          h("button", { type: "button", onclick: () => addRow("water", { ml: 500 }, "Added 500 ml (Bottle)") }, icon("bottle", 15), "+500 ml"),
          todayWater.length > 0 && h("button", {
            type: "button",
            class: "ghost",
            onclick: () => {
              const last = todayWater[todayWater.length - 1];
              removeRow("water", last.id, "Removed last water entry.");
            },
          }, icon("undo", 14), "Undo last water"))),

      fastingCompactStrip(),

      h("div", { class: "card" },
        h("div", { class: "card-head", style: "margin-block-end: 0.75rem;" },
          h("div", { class: "seg-tabs", role: "tablist", "aria-label": "Manual Entry" },
            h("button", {
              type: "button", role: "tab", "aria-selected": logTab === "expense" ? "true" : "false",
              onclick: () => { logTab = "expense"; render(); },
            }, "Expense"),
            h("button", {
              type: "button", role: "tab", "aria-selected": logTab === "meal" ? "true" : "false",
              onclick: () => { logTab = "meal"; render(); },
            }, "Meal & Favorites"))),
        logTab === "expense" ? expensePanel : mealPanel)),
  );
}

// ---------- Workspace 2: Dedicated Fasting & Metabolic Studio ----------
function fastingView() {
  const f = state.fasting;
  const proto = state.fastingProtocol || 16;
  const activeMetrics = f?.started_at ? getFastingMetrics(f) : null;

  const zones = [
    { hrs: "0 – 4h", title: "Digestion & Insulin Drop", desc: "Blood glucose settles as the body finishes digesting your last meal." },
    { hrs: "4 – 12h", title: "Post-Absorptive Shift", desc: "Insulin levels fall lower and liver glycogen begins fueling energy." },
    { hrs: "12 – 16h", title: "Fat Mobilization", desc: "Lipolysis increases and fat stores steadily become primary fuel." },
    { hrs: "16h+", title: "Deep Ketosis", desc: "Sustained fat oxidation with elevated ketone production." },
  ];

  const protoSelector = h("div", { class: "proto-inline", role: "group", "aria-label": "Fasting protocol" },
    FASTING_PROTOCOLS.map((hrs) => h("button", {
      type: "button",
      "aria-pressed": (f?.target_hours || proto) === hrs ? "true" : "false",
      onclick: () => {
        state.fastingProtocol = hrs;
        if (state.fasting) state.fasting.target_hours = hrs;
        commit(`Fasting protocol set to ${hrs}:${24 - hrs}`);
      },
    }, `${hrs}:${24 - hrs}`)));

  return h("section", { class: "studio-grid view-enter" },
    h("div", { class: "card" },
      h("div", { class: "card-head" },
        h("div", { class: "card-title" }, icon("timer", 17), "Fasting Dial"),
        protoSelector),
      activeMetrics
        ? h("div", { class: "col-stack", style: "align-items: center; text-align: center; padding-block: 1rem;" },
            fastingArcSvg(activeMetrics.progressPct, activeMetrics.isComplete, true),
            h("span", { "data-fasting-stage": "1", class: "stage-badge" + (activeMetrics.isComplete ? " done" : "") },
              activeMetrics.isComplete ? `Goal Met · ${activeMetrics.stage}` : activeMetrics.stage),
            h("div", { class: "timer-digits tnum", "data-fasting-digits": "1" }, activeMetrics.digits),
            h("p", { class: "muted tnum" }, `Target ${activeMetrics.targetHours}h · Started ${new Date(f.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`),
            h("button", {
              type: "button",
              onclick: () => confirmAction("End fasting session?", "Your current fasting timer will stop and log elapsed hours.",
                async () => {
                  const elapsed = Math.round(getFastingMetrics(state.fasting).elapsedHours * 10) / 10;
                  if (elapsed >= 0.1) {
                    state.fastingHistory.push({
                      id: uid(),
                      started_at: state.fasting.started_at,
                      ended_at: new Date().toISOString(),
                      hours: elapsed,
                      target_hours: activeMetrics.targetHours,
                    });
                  }
                  state.fasting = null;
                  if (!await commit("Fast ended.")) throw new Error("Could not save the fasting change.");
                }, activeMetrics.isComplete ? "Break Fast" : "Stop Fast"),
            }, activeMetrics.isComplete ? "Break Fast" : "Stop Fast"))
        : h("div", { class: "col-stack", style: "align-items: center; text-align: center; padding-block: 1.25rem;" },
            fastingArcSvg(2, false, true),
            h("h2", {}, `${proto}:${24 - proto} Window Ready`),
            h("p", { class: "muted" }, "Start your timer right after your last meal to track metabolic zones."),
            h("button", {
              type: "button",
              class: "pill-cta",
              onclick: () => {
                state.fasting = { started_at: new Date().toISOString(), target_hours: proto };
                commit(`Started ${proto}h fast!`);
              },
            }, `Start ${proto}h Fast`, h("span", { class: "cta-arrow" }, icon("arrowRight", 14))))),

    h("div", { class: "card" },
      h("div", { class: "card-head" },
        h("div", { class: "card-title" }, icon("compass", 17), "Metabolic Zones"),
        h("span", { class: "card-sub tnum" }, `${(state.fastingHistory || []).length} completed fasts`)),
      h("div", { class: "zone-list" },
        zones.map((z, idx) => h("div", { class: "zone-item" + (activeMetrics?.stageIndex === idx ? " active" : "") },
          h("div", {},
            h("div", { style: "font-weight: 700; font-size: 0.86rem;" }, z.title),
            h("div", { style: "font-size: 0.76rem; opacity: 0.82;" }, z.desc)),
          h("span", { class: "tnum", style: "font-size: 0.74rem; font-weight: 700; white-space: nowrap;" }, z.hrs))))),
  );
}

// ---------- Workspace 3: Insights & Weekly Review ----------
function insightsView() {
  if (reviewState.status === "idle" && state.reviews && state.reviews.length > 0) {
    const last = state.reviews[state.reviews.length - 1];
    if (last && Array.isArray(last.actions) && last.money && last.nutrition) {
      reviewState = { status: "ok", data: last };
    }
  }

  const p = state.profile;
  const endDt = new Date();
  const startStr = dateOffsetIso(6);
  const weekExpenses = state.expenses.filter((r) => r.date >= startStr);
  const weekMeals = state.meals.filter((r) => r.date >= startStr);
  const weekWater = state.water.filter((r) => r.date >= startStr);
  const series = buildDailySeries(startStr, weekExpenses, weekMeals, weekWater);

  const catMap = new Map();
  let weekSpentTotal = 0;
  for (const r of weekExpenses) {
    weekSpentTotal += r.amount;
    catMap.set(r.category || "Other", (catMap.get(r.category || "Other") || 0) + r.amount);
  }
  const categories = [...catMap.entries()].sort((a, b) => b[1] - a[1]);

  let safeDaily = 0;
  try {
    const day = todayIso();
    const monthSpent = state.expenses.filter((r) => r.date.startsWith(day.slice(0, 7))).reduce((a, r) => a + r.amount, 0);
    safeDaily = TOOLS.plan_targets({ ...p.inputs, monthly_budget: p.monthly_budget, fixed_costs: p.fixed_costs, spent_so_far: monthSpent, today: day }).safe_daily_spend;
  } catch {}

  const r = reviewState;
  let body;
  if (r.status === "loading") body = h("p", { role: "status" }, h("span", { class: "spinner" }), "Reviewing your last 7 days…");
  else if (r.status === "error") body = h("p", { class: "error", role: "alert" }, r.message);
  else if (r.status === "insufficient_data") body = h("p", { class: "muted" }, r.data.message);
  else if (r.status === "ok") body = reviewResult(r.data, weekSpentTotal);
  else body = h("p", { class: "muted" }, "Run your deterministic weekly review to generate honest metrics, concrete next actions, and a shareable scorecard.");

  return h("section", { class: "studio-grid view-enter" },
    h("div", { class: "span-2 between", style: "padding-block: 0.2rem;" },
      h("div", {},
        h("span", { class: "eyebrow" }, "7-Day Intelligence"),
        h("h1", { style: "margin-block-start: 0.25rem;" }, "Spending & Habit Breakdown")),
      h("button", { type: "button", class: "pill-cta", disabled: r.status === "loading", onclick: runReview },
        "Review my week", h("span", { class: "cta-arrow" }, icon("arrowRight", 14)))),

    h("div", { class: "card" },
      h("div", { class: "card-head" },
        h("div", { class: "card-title" }, icon("barChart", 16), "7-Day Spending vs Pace"),
        h("span", { class: "card-sub tnum" }, `Total: ${fmtMoney(weekSpentTotal)}`)),
      weeklySpendChartEl(series, safeDaily, fmtMoney)),

    h("div", { class: "card" },
      h("div", { class: "card-head" },
        h("div", { class: "card-title" }, icon("utensils", 16), "7-Day Calories & Protein"),
        h("span", { class: "card-sub" }, "Purple dots = >=85% protein")),
      weeklyNutritionChartEl(series, p.calories, p.protein_g)),

    h("div", { class: "card" },
      h("div", { class: "card-head" },
        h("div", { class: "card-title" }, icon("wallet", 16), "Category Mix (7d)")),
      categoryBreakdownEl(categories, weekSpentTotal, fmtMoney)),

    h("div", { class: "card" },
      h("div", { class: "card-head" },
        h("div", { class: "card-title" }, icon("check", 16), "7-Day Consistency"),
        h("span", { class: "card-sub" }, `${endDt.toLocaleDateString(undefined, { month: "short", day: "numeric" })} window`)),
      consistencyMatrixEl(series, p)),

    h("div", { class: "card span-2" },
      h("div", { class: "card-head" },
        h("div", { class: "card-title" }, icon("sparkles", 16), "Weekly Coaching Brief")),
      h("div", { "aria-live": "polite" }, body)),
  );
}

function reviewResult(d, fallbackSpent) {
  const text = [d.headline, ...d.actions.map((a) => "- " + a)].join("\n");
  const m = d.money, n = d.nutrition;
  const day = todayIso();
  const spentToday = sumWhere(state.expenses, "amount", day);
  const kcalToday = sumWhere(state.meals, "kcal", day);
  const proteinToday = sumWhere(state.meals, "protein", day);
  const waterToday = sumWhere(state.water, "ml", day);
  const pulse = computeDailyPulse({
    spentToday,
    safeDaily: state.plan?.safe_daily_spend || 0,
    kcalToday,
    kcalTarget: state.profile.calories,
    proteinToday,
    proteinTarget: state.profile.protein_g,
    waterToday,
    waterTarget: state.profile.water_ml,
  });

  return h("div", {},
    h("p", { style: "font-weight: 700; font-size: 1.05rem; margin-block-end: 0.75rem;" }, d.headline),
    h("div", { class: "grid-2" },
      h("div", { class: "stat-tile" }, h("b", { class: "tnum" }, fmtMoney(m.spent)), h("span", {}, `spent of ${fmtMoney(m.weekly_allowance)} allowance`)),
      n.meal_days ? h("div", { class: "stat-tile" }, h("b", { class: "tnum" }, `${n.avg_calories} kcal`), h("span", {}, `avg on ${n.meal_days} logged days`)) : null,
      n.meal_days ? h("div", { class: "stat-tile" }, h("b", { class: "tnum" }, `${n.avg_protein_g} g`), h("span", {}, "avg protein")) : null,
      n.water_days ? h("div", { class: "stat-tile" }, h("b", { class: "tnum" }, `${n.water_days_on_target}/${n.water_days}`), h("span", {}, "days near water goal")) : null),
    m.top_categories?.length ? h("p", { class: "muted", style: "margin-block-start: 0.75rem;" },
      "Top categories: " + m.top_categories.map((c) => `${c.category} ${fmtMoney(c.amount)}`).join(", ")) : null,
    h("h2", { style: "margin-block-start: 1rem;" }, "What to do next week"),
    h("ol", { class: "action-list" },
      d.actions.map((a, idx) => h("li", { class: "action-item" },
        h("span", { class: "action-idx tnum" }, String(idx + 1).padStart(2, "0")),
        h("span", {}, a)))),
    h("div", { class: "row", style: "margin-block-start: 0.9rem;" },
      h("button", { type: "button", onclick: () => shareText(text) }, icon("check", 14), "Copy summary"),
      h("button", {
        type: "button",
        onclick: () => {
          try {
            const period = d.period || { start: dateOffsetIso(6), end: todayIso() };
            const dataUrl = exportShareCardPng({
              headline: d.headline,
              period,
              pulseScore: pulse.total,
              streak: calculateStreak(),
              spentText: fmtMoney(m.spent ?? fallbackSpent),
              allowanceText: fmtMoney(m.weekly_allowance || 0),
              avgProtein: n.avg_protein_g || 0,
              proteinTarget: state.profile.protein_g,
              waterHit: n.water_days_on_target || 0,
              waterDays: n.water_days || 0,
              topAction: d.actions?.[0] || "",
            });
            showShareCardModal(dataUrl, `smartassistant-pulse-${period.end}.png`);
            toast("Share card downloaded (PNG).");
          } catch (ex) {
            toast("Could not render share card: " + (ex.message || ex));
          }
        },
      }, icon("share", 14), "Download Share Card"),
      anna?.llm ? h("button", { type: "button", onclick: () => plainSummary(d) }, icon("sparkles", 14), "Ask Anna Coach") : null),
    h("p", { id: "note", class: "muted", style: "margin-block-start: 0.55rem;", "aria-live": "polite" }));
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
      state.reviews.push({
        at: new Date().toISOString(),
        period: data.period,
        week_end: data.period?.end || todayIso(),
        days_logged: data.days_logged,
        headline: data.headline,
        money: data.money,
        nutrition: data.nutrition,
        actions: data.actions,
      });
      if (!await commit()) throw new Error("Could not save the review.");
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
  note.replaceChildren(h("span", { class: "spinner" }), " Writing coaching note…");
  try {
    const reply = await anna.llm.complete({
      messages: [{ role: "user", content: { type: "text", text:
        "Rewrite this weekly money and nutrition review as three short motivating sentences for the person who logged it. " +
        "Use only the numbers given. Do not invent advice outside the list.\n\n" + JSON.stringify({ headline: d.headline, actions: d.actions }) } }],
      maxTokens: 220,
    });
    note.textContent = reply?.content?.text || "No text came back.";
  } catch (e) {
    note.textContent = "The note could not be written (" + (e.code || e.message || "error") + "). The review above is complete.";
  }
}

// ---------- Backup export / import / validation ----------
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
      validateBackup(parsed);
      state = normalize(parsed);
      reviewState = { status: "idle" };
      if (!await commit("Backup restored successfully!")) throw new Error("Could not save the backup.");
    } catch {
      toast("The backup could not be restored.");
    }
  };
  reader.readAsText(file);
}

function validateBackup(s) {
  const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const finite = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  const fail = () => { throw new Error("Invalid SmartAssistant backup."); };
  if (!object(s) || s.v !== 1) fail();
  for (const [kind, fields] of Object.entries({ expenses: ["amount"], meals: ["kcal", "protein"], water: ["ml"] })) {
    if (!Array.isArray(s[kind])) fail();
    const ids = new Set();
    for (const row of s[kind]) {
      if (!object(row) || typeof row.id !== "string" || !row.id || ids.has(row.id)
          || typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)
          || !Number.isFinite(Date.parse(row.date)) || new Date(row.date).toISOString().slice(0, 10) !== row.date
          || fields.some((key) => !finite(row[key]))) fail();
      if (kind === "expenses" && typeof row.category !== "string") fail();
      ids.add(row.id);
    }
  }
  if (!Array.isArray(s.reviews) || s.reviews.some((r) => !object(r))) fail();
  if (s.presets !== undefined) {
    if (!Array.isArray(s.presets)) fail();
    for (const pr of s.presets) {
      if (!object(pr) || typeof pr.id !== "string" || typeof pr.label !== "string" || !finite(pr.kcal) || !finite(pr.protein)) fail();
    }
  }
  if (s.fastingHistory !== undefined && (!Array.isArray(s.fastingHistory) || s.fastingHistory.some((f) => !object(f)))) fail();
  if (s.theme !== undefined && s.theme !== null && s.theme !== "dark" && s.theme !== "light") fail();
  if (s.profile !== null) {
    if (!object(s.profile) || !CURRENCIES.includes(s.profile.currency)
        || ["monthly_budget", "fixed_costs", "calories", "protein_g", "water_ml"].some((k) => !finite(s.profile[k]))) fail();
    TOOLS.plan_targets({ ...s.profile.inputs, monthly_budget: s.profile.monthly_budget, fixed_costs: s.profile.fixed_costs });
  }
  if (s.plan !== null && !object(s.plan)) fail();
}

// ---------- Workspace 4: Settings Studio ----------
function settingsView() {
  const done = state.reviews.length;
  const streak = calculateStreak();
  const fastCount = (state.fastingHistory || []).length;
  const fileInput = h("input", { type: "file", accept: ".json", style: "display:none;", onchange: importBackup });

  return h("section", { class: "studio-grid view-enter" },
    h("div", { class: "card span-2" },
      h("div", { class: "card-head" },
        h("div", { class: "card-title" }, icon("sliders", 16), "Daily Targets & Budget"),
        !editingTargets && h("button", { type: "button", onclick: () => { editingTargets = true; render(); } }, icon("edit", 14), "Change my numbers")),
      editingTargets
        ? profileForm(true)
        : h("div", { class: "grid-2" },
            h("div", { class: "stat-tile" }, h("b", { class: "tnum" }, `${state.profile.calories} kcal`), h("span", {}, `${state.profile.protein_g}g protein · ${state.profile.water_ml} ml water`)),
            h("div", { class: "stat-tile" }, h("b", { class: "tnum" }, fmtMoney(state.profile.monthly_budget)), h("span", {}, `Fixed costs: ${fmtMoney(state.profile.fixed_costs)}`)))),

    h("div", { class: "card" },
      h("div", { class: "card-head" },
        h("div", { class: "card-title" }, icon("flame", 16), "Consistency & Stats")),
      h("p", { class: "tnum" }, `Current Streak: ${streak} day${streak === 1 ? "" : "s"} in a row`),
      h("p", { class: "tnum" }, `${state.expenses.length} expenses, ${state.meals.length} meals and ${state.water.length} water entries stored. Reviews completed: ${done}.`),
      fastCount > 0 && h("p", { class: "tnum" }, `Completed fasts logged: ${fastCount}`),
      h("p", { class: "muted", style: "font-size: 0.78rem;" }, `Entries older than ${KEEP_DAYS} days are pruned automatically.`)),

    h("div", { class: "card" },
      h("div", { class: "card-head" },
        h("div", { class: "card-title" }, icon("sparkles", 16), "Preview & Backup")),
      h("p", { class: "muted" }, "Load sample 7-day data or export/restore a JSON backup:"),
      h("div", { class: "row" },
        h("button", {
          type: "button",
          onclick: () => {
            if (state.expenses.length || state.meals.length || state.water.length) {
              confirmAction("Load 7-day sample data?", "This replaces your current local entries with sample 7-day tracker data.", loadSampleWeek, "Load sample");
            } else {
              loadSampleWeek();
            }
          },
        }, icon("sparkles", 14), "Load 7-day sample"),
        h("button", { type: "button", onclick: exportBackup }, icon("download", 14), "Export Data (JSON)"),
        h("button", { type: "button", onclick: () => fileInput.click() }, icon("upload", 14), "Restore from Backup"),
        fileInput)),

    h("div", { class: "card span-2" },
      h("div", { class: "card-head" },
        h("div", { class: "card-title" }, icon("trash", 16), "Danger Zone")),
      h("p", { class: "muted" }, "Permanently remove your profile, targets and all logged entries from storage."),
      h("button", {
        type: "button",
        class: "danger",
        onclick: () => confirmAction("Delete all my data?",
          "This permanently deletes your targets and entries from Anna storage. This cannot be undone.", async () => {
            await saveQueue;
            const empty = normalize(null);
            await store.save(empty);
            stateRevision++;
            state = empty; reviewState = { status: "idle" }; view = "today"; onboardingStep = 0; editingTargets = false; quickText = "";
            render();
            toast("All data deleted.");
          }, "Delete data", true),
      }, icon("trash", 15), "Delete all my data")),
  );
}

// ---------- App Shell & Render ----------
function computeTodayPulseScore() {
  if (!state.profile) return 0;
  const day = todayIso();
  const spentToday = sumWhere(state.expenses, "amount", day);
  const kcalToday = sumWhere(state.meals, "kcal", day);
  const proteinToday = sumWhere(state.meals, "protein", day);
  const waterToday = sumWhere(state.water, "ml", day);
  const monthSpent = state.expenses.filter((r) => r.date.startsWith(day.slice(0, 7))).reduce((a, r) => a + r.amount, 0);
  let safeDaily = 0;
  try {
    safeDaily = TOOLS.plan_targets({ ...state.profile.inputs, monthly_budget: state.profile.monthly_budget, fixed_costs: state.profile.fixed_costs, spent_so_far: monthSpent - spentToday, today: day }).safe_daily_spend;
  } catch {}
  return computeDailyPulse({
    spentToday, safeDaily, kcalToday, kcalTarget: state.profile.calories,
    proteinToday, proteinTarget: state.profile.protein_g, waterToday, waterTarget: state.profile.water_ml,
  }).total;
}

function render() {
  $app.setAttribute("aria-busy", "false");
  const isOnboarded = Boolean(state.profile);
  const dateFmt = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const streak = calculateStreak();
  const pulseScore = computeTodayPulseScore();

  const railBtn = (id, label, icoName, active, disabled, onClick) => h("button", {
    type: "button",
    class: "rail-btn",
    title: disabled ? `${label} (complete setup first)` : label,
    "aria-label": label,
    "aria-current": active ? "page" : null,
    disabled,
    onclick: onClick,
  }, icon(icoName, 18));

  const railNavItems = isOnboarded
    ? [
        railBtn("today", "Today", "home", view === "today", false, () => { view = "today"; editingTargets = false; render(); }),
        railBtn("fasting", "Fasting", "timer", view === "fasting", false, () => { view = "fasting"; editingTargets = false; render(); }),
        railBtn("insights", "Insights", "barChart", view === "insights", false, () => { view = "insights"; editingTargets = false; render(); }),
        railBtn("settings", "Settings", "sliders", view === "settings", false, () => { view = "settings"; editingTargets = false; render(); }),
      ]
    : [
        railBtn("welcome", "Welcome", "home", onboardingStep === 0, false, () => { onboardingStep = 0; render(); }),
        railBtn("setup", "Setup Studio", "compass", onboardingStep === 1, false, () => { onboardingStep = 1; render(); }),
        railBtn("fasting", "Fasting", "timer", false, true, () => {}),
        railBtn("insights", "Insights", "barChart", false, true, () => {}),
        railBtn("settings", "Settings", "sliders", false, true, () => {}),
      ];

  const rail = h("nav", { class: "rail", "aria-label": "Main navigation" },
    h("div", { class: "rail-brand", title: "SmartAssistant" }, icon("brandMark", 18)),
    h("div", { class: "rail-nav" }, railNavItems),
    h("button", {
      type: "button",
      class: "rail-avatar",
      "aria-label": "Toggle color theme",
      title: currentTheme === "dark" ? "Switch to Warm Paper Light mode" : "Switch to Matte Dark mode",
      onclick: toggleTheme,
    }, icon(currentTheme === "dark" ? "sun" : "moon", 16)));

  const statusBar = h("header", { class: "status-bar" },
    h("div", { class: "status-left" },
      h("span", { class: "status-dot" + (anna ? "" : " local") }),
      h("span", {}, anna ? "Anna connected" : "Local preview"),
      h("span", { class: "status-sep" }, "·"),
      h("span", { class: "status-date" }, dateFmt)),
    isOnboarded
      ? h("div", { class: "status-right" },
          h("div", { class: "xp-meter tnum", title: `Streak ${streak}d · Daily Pulse ${pulseScore}/100` },
            h("span", { class: "xp-lvl" }, `${streak}D STREAK`),
            h("div", { class: "xp-track" }, h("span", { class: "xp-fill", style: `width:${pulseScore}%` })),
            h("span", {}, `${pulseScore}/100`)),
          h("button", {
            type: "button",
            class: "status-cta",
            onclick: () => {
              view = view === "today" ? "insights" : "today";
              render();
            },
          }, view === "today" ? "Insights →" : "Today →"))
      : h("div", { class: "status-right" },
          h("button", {
            type: "button",
            class: "status-cta",
            onclick: () => {
              if (onboardingStep === 0) { onboardingStep = 1; render(); }
              else loadSampleWeek();
            },
          }, onboardingStep === 0 ? "Set up →" : "Load sample →")));

  const body = isOnboarded
    ? ({ today: todayView, fasting: fastingView, insights: insightsView, settings: settingsView }[view])()
    : (onboardingStep === 0 ? welcomeStageView() : setupStudioView());

  $app.replaceChildren(
    h("div", { class: "app-shell" },
      rail,
      h("div", { class: "shell-main" }, statusBar, body)),
  );
}

async function main() {
  try {
    await connectHost();
    state = await store.load();
    if (state.theme) currentTheme = applyTheme(state.theme);
    render();
    setInterval(tickFastingDom, 1000);
  } catch (e) {
    $app.setAttribute("aria-busy", "false");
    $app.replaceChildren(
      h("div", { class: "card", style: "margin-block-start: 2rem;" },
        h("p", { class: "error", role: "alert" }, "Could not load your data: " + (e.message || e)),
        h("div", { class: "row", style: "margin-block-start: 1rem;" },
          h("button", { type: "button", class: "primary", onclick: () => location.reload() }, "Try again"),
          h("button", {
            type: "button",
            onclick: () => {
              sessionStorage.setItem("smartassistant:offline", "1");
              location.reload();
            },
          }, "Use in Offline Mode"))),
    );
  }
}

main();
