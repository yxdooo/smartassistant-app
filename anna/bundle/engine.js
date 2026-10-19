// Offline mirror of anna/executas/smartassistant/smartassistant_plugin.py.
// Used when the bundled Executa cannot be reached (standalone preview, mock
// harness). tests/parity.json is checked against both implementations.

export const MIN_LOGGED_DAYS = 3;
const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
const PROTEIN_PER_KG = { lose: 2.0, maintain: 1.6, gain: 1.8 };
const KCAL_ADJUST = { lose: -500, maintain: 0, gain: 300 };
const KCAL_FLOOR = { female: 1200, male: 1500 };

// Python's round() is half-to-even; match it so both engines agree.
function pyRound(x) {
  const f = Math.floor(x);
  const d = x - f;
  if (d < 0.5) return f;
  if (d > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}
const round = (n, step = 1) => pyRound(n / step) * step;
const money = (n) => Math.round((n + 1e-9) * 100) / 100;
const round3 = (n) => Math.round(n * 1000) / 1000;
const fmt = (n) => Number(n).toFixed(2);

function num(value, name, min, max) {
  const n = typeof value === "number" ? value : value === null || value === "" || value === undefined ? NaN : Number(value);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number`);
  if (min !== undefined && n < min) throw new Error(`${name} must be at least ${min}`);
  if (max !== undefined && n > max) throw new Error(`${name} must be at most ${max}`);
  return n;
}

function parseDay(value, name) {
  const s = String(value ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`${name} must be a date like 2026-01-31`);
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw new Error(`${name} must be a date like 2026-01-31`);
  }
  return dt;
}
const iso = (dt) => dt.toISOString().slice(0, 10);
const addDays = (dt, n) => new Date(dt.getTime() + n * 86400000);
const daysInMonth = (dt) => new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function todayIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function planTargets(a) {
  const weight = num(a.weight_kg, "weight_kg", 30, 300);
  const height = num(a.height_cm, "height_cm", 120, 230);
  const age = num(a.age, "age", 14, 100);
  const sex = a.sex ?? "female";
  if (!(sex in KCAL_FLOOR)) throw new Error("sex must be 'female' or 'male'");
  const activity = a.activity ?? "light";
  if (!(activity in ACTIVITY)) throw new Error("activity must be one of " + Object.keys(ACTIVITY).join(", "));
  const goal = a.goal ?? "maintain";
  if (!(goal in KCAL_ADJUST)) throw new Error("goal must be one of " + Object.keys(KCAL_ADJUST).join(", "));
  const budget = num(a.monthly_budget, "monthly_budget", 0);
  const fixed = num(a.fixed_costs ?? 0, "fixed_costs", 0);
  const spent = num(a.spent_so_far ?? 0, "spent_so_far", 0);
  const today = parseDay(a.today || todayIso(), "today");

  const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === "male" ? 5 : -161);
  const tdee = bmr * ACTIVITY[activity];
  const kcal = Math.max(KCAL_FLOOR[sex], tdee + KCAL_ADJUST[goal]);
  const protein = weight * PROTEIN_PER_KG[goal];
  const fat = (kcal * 0.25) / 9;
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);

  const dim = daysInMonth(today);
  const daysLeft = dim - today.getUTCDate() + 1;
  const free = budget - fixed;
  const remaining = free - spent;
  return {
    calories: round(kcal, 10),
    protein_g: round(protein),
    fat_g: round(fat),
    carbs_g: round(carbs),
    water_ml: round(weight * 35, 50),
    bmr: round(bmr),
    maintenance_calories: round(tdee, 10),
    safe_daily_spend: money(Math.max(0, remaining) / daysLeft),
    spendable_this_month: money(free),
    remaining_this_month: money(remaining),
    days_left_in_month: daysLeft,
    over_budget: remaining < 0,
  };
}

function cleanRows(rows, kind, fields) {
  return (rows || []).map((row, i) => {
    if (row === null || typeof row !== "object" || Array.isArray(row)) throw new Error(`${kind}[${i}] must be an object`);
    const item = { date: iso(parseDay(row.date, `${kind}[${i}].date`)) };
    for (const f of fields) item[f] = num(row[f] ?? 0, `${kind}[${i}].${f}`, 0);
    if (kind === "expenses") item.category = String(row.category || "Other").slice(0, 40);
    return item;
  });
}

function sumBy(rows, valueKey, keyFn = (r) => r.date) {
  const m = new Map();
  for (const r of rows) m.set(keyFn(r), (m.get(keyFn(r)) || 0) + r[valueKey]);
  return m;
}
const sum = (it) => [...it].reduce((a, b) => a + b, 0);

export function weeklyReview(a) {
  const profile = a.profile || {};
  const endDt = parseDay(a.week_end || todayIso(), "week_end");
  const startDt = addDays(endDt, -6);
  const start = iso(startDt);
  const end = iso(endDt);
  const budget = num(profile.monthly_budget ?? 0, "profile.monthly_budget", 0);
  const fixed = num(profile.fixed_costs ?? 0, "profile.fixed_costs", 0);
  const kcalTarget = num(profile.calories ?? 0, "profile.calories", 0);
  const proteinTarget = num(profile.protein_g ?? 0, "profile.protein_g", 0);
  const waterTarget = num(profile.water_ml ?? 0, "profile.water_ml", 0);

  const inWeek = (r) => r.date >= start && r.date <= end;
  const expenses = cleanRows(a.expenses, "expenses", ["amount"]).filter(inWeek);
  const meals = cleanRows(a.meals, "meals", ["kcal", "protein"]).filter(inWeek);
  const water = cleanRows(a.water, "water", ["ml"]).filter(inWeek);

  const logged = new Set([...expenses, ...meals, ...water].map((r) => r.date));
  if (logged.size < MIN_LOGGED_DAYS) {
    const missing = MIN_LOGGED_DAYS - logged.size;
    return {
      status: "insufficient_data",
      period: { start, end },
      days_logged: logged.size,
      message:
        `Only ${logged.size} of the last 7 days have entries. ` +
        `Log ${missing} more day${missing !== 1 ? "s" : ""} ` +
        "(an expense, a meal or a glass of water counts) and run the review again.",
    };
  }

  const dim = daysInMonth(endDt);
  const allowance = budget ? (Math.max(0, budget - fixed) * 7) / dim : 0;
  const spent = sum(expenses.map((r) => r.amount));
  const byCat = sumBy(expenses, "amount", (r) => r.category);
  const byDay = sumBy(expenses, "amount");
  const categories = [...byCat.entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1));
  const top = categories[0];
  const priciest = [...byDay.entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? 1 : -1))[0];
  const diff = spent - allowance;

  let status = "no_budget";
  if (allowance) status = diff > allowance * 0.05 ? "over" : diff >= -allowance * 0.05 ? "on_track" : "under";
  const m = {
    spent: money(spent),
    weekly_allowance: money(allowance),
    difference: money(diff),
    status,
    top_categories: categories.slice(0, 3).map(([category, amount]) => ({
      category,
      amount: money(amount),
      share: spent ? round3(amount / spent) : 0,
    })),
    priciest_day: priciest ? { date: priciest[0], amount: money(priciest[1]) } : null,
  };

  const kcalByDay = sumBy(meals, "kcal");
  const proteinByDay = sumBy(meals, "protein");
  const mealDays = kcalByDay.size;
  const avgKcal = mealDays ? sum(kcalByDay.values()) / mealDays : 0;
  const avgProtein = mealDays ? sum(proteinByDay.values()) / mealDays : 0;
  const waterByDay = sumBy(water, "ml");
  const waterHit = [...waterByDay.values()].filter((v) => waterTarget && v >= waterTarget * 0.8).length;
  const avgWater = waterByDay.size ? sum(waterByDay.values()) / waterByDay.size : 0;

  const nutrition = {
    meal_days: mealDays,
    avg_calories: round(avgKcal),
    calorie_target: round(kcalTarget),
    avg_protein_g: round(avgProtein),
    protein_target_g: round(proteinTarget),
    water_days: waterByDay.size,
    water_days_on_target: waterHit,
    avg_water_ml: round(avgWater, 50),
    water_target_ml: round(waterTarget),
  };

  const actions = [];
  if (status === "over") {
    let line = `You spent ${fmt(m.spent)} against a weekly allowance of ${fmt(m.weekly_allowance)}, which is ${fmt(Math.abs(m.difference))} over.`;
    if (top) {
      const cut = Math.min(top[1], Math.abs(diff));
      line += ` ${top[0]} was the biggest category at ${fmt(top[1])}. Trimming it by ${fmt(cut)} next week puts you back on pace.`;
    }
    actions.push(line);
  } else if (status === "under") {
    actions.push(
      `You finished ${fmt(Math.abs(m.difference))} under your weekly allowance. Move that amount to savings now so it does not get spent later in the month.`
    );
  } else if (status === "on_track") {
    actions.push(`Spending is within 5% of your ${fmt(m.weekly_allowance)} weekly allowance. Keep the same pace.`);
  } else {
    actions.push("Set a monthly budget to compare weekly spending against an allowance.");
  }
  if (priciest && spent && priciest[1] > spent * 0.4) {
    const day = WEEKDAYS[parseDay(priciest[0], "d").getUTCDay()];
    actions.push(
      `${Math.round((priciest[1] / spent) * 100)}% of the week's spending landed on ${day}. Check if that purchase could have been planned or split.`
    );
  }

  const plural = mealDays !== 1 ? "s" : "";
  if (mealDays && kcalTarget) {
    const gap = avgKcal - kcalTarget;
    if (Math.abs(gap) > kcalTarget * 0.1) {
      actions.push(
        `On the ${mealDays} day${plural} you logged meals, you averaged ${round(avgKcal)} kcal, ${Math.abs(round(gap))} ${gap > 0 ? "above" : "below"} your ${round(kcalTarget)} kcal target.`
      );
    } else {
      actions.push(`Calories averaged ${round(avgKcal)} kcal, within 10% of your ${round(kcalTarget)} kcal target.`);
    }
  } else if (!mealDays) {
    actions.push("No meals were logged this week, so there is no calorie or protein comparison yet.");
  }
  if (mealDays && proteinTarget && avgProtein < proteinTarget * 0.85) {
    actions.push(
      `Protein averaged ${round(avgProtein)} g against a ${round(proteinTarget)} g target. Adding about ${round(proteinTarget - avgProtein)} g per day closes the gap.`
    );
  }
  if (waterTarget && waterByDay.size && waterHit < waterByDay.size) {
    actions.push(`You reached 80% of your ${round(waterTarget)} ml water goal on ${waterHit} of ${waterByDay.size} logged days.`);
  }

  const parts = [];
  if (allowance) parts.push(`${fmt(Math.abs(m.difference))} ${diff > 0 ? "over" : "under"} budget`);
  if (mealDays && kcalTarget) parts.push(`${round(avgKcal)} kcal/day vs ${round(kcalTarget)} target`);
  const [, sm, sd] = start.split("-").map(Number);
  const headline = `Week of ${MONTHS[sm - 1]} ${String(sd).padStart(2, "0")}: ${parts.join(", ") || `${fmt(m.spent)} spent`}`;

  return { status: "ok", period: { start, end }, days_logged: logged.size, headline, money: m, nutrition, actions };
}

export const TOOLS = { plan_targets: planTargets, weekly_review: weeklyReview };
