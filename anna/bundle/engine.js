// Offline mirror of anna/executas/smartassistant/smartassistant_plugin.py.
// Used when the bundled Executa cannot be reached (standalone preview, mock
// harness) and for instant zero-latency UI previews. tests/parity.json keeps
// both implementations in sync.

export const MIN_LOGGED_DAYS = 3;
const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
const PROTEIN_PER_KG = { lose: 2.0, maintain: 1.6, gain: 1.8 };
const KCAL_ADJUST = { lose: -500, maintain: 0, gain: 300 };
const KCAL_FLOOR = { female: 1200, male: 1500 };

const FOLD_MAP = {
  "İ": "i", "I": "i", "ı": "i",
  "Ş": "s", "ş": "s",
  "Ğ": "g", "ğ": "g",
  "Ü": "u", "ü": "u",
  "Ö": "o", "ö": "o",
  "Ç": "c", "ç": "c",
  "\u0307": "",
};

const FOOD_LEXICON = [
  ["chicken bowl", "Chicken Bowl", 620, 46],
  ["tavuk pilav", "Chicken & Rice", 620, 46],
  ["protein shake", "Protein Shake", 180, 30],
  ["whey", "Protein Shake", 160, 28],
  ["caesar salad", "Caesar Salad", 420, 34],
  ["tavuk salata", "Chicken Salad", 420, 34],
  ["iced latte", "Iced Latte", 140, 6],
  ["cappuccino", "Cappuccino", 120, 6],
  ["latte", "Latte", 140, 6],
  ["americano", "Americano", 15, 0],
  ["espresso", "Espresso", 10, 0],
  ["coffee", "Coffee", 30, 1],
  ["kahve", "Coffee", 30, 1],
  ["hamburger", "Burger", 680, 34],
  ["burger", "Burger", 680, 34],
  ["pizza", "Pizza", 720, 28],
  ["shawarma", "Wrap / Doner", 640, 38],
  ["doner", "Doner", 640, 38],
  ["durum", "Wrap / Durum", 620, 36],
  ["kebab", "Kebab", 660, 42],
  ["avocado toast", "Avocado Toast", 360, 12],
  ["sandwich", "Sandwich", 440, 22],
  ["tost", "Toast", 390, 18],
  ["wrap", "Wrap", 480, 26],
  ["omelette", "Omelette", 320, 22],
  ["menemen", "Menemen", 310, 18],
  ["yumurta", "Eggs", 240, 18],
  ["eggs", "Eggs", 240, 18],
  ["oatmeal", "Oatmeal", 340, 14],
  ["oats", "Oats", 340, 14],
  ["yulaf", "Oats", 340, 14],
  ["yogurt", "Yogurt", 180, 16],
  ["makarna", "Pasta", 560, 18],
  ["pasta", "Pasta", 560, 18],
  ["somon", "Salmon", 520, 42],
  ["salmon", "Salmon", 520, 42],
  ["steak", "Steak", 560, 48],
  ["kofte", "Meatballs", 520, 36],
  ["sushi", "Sushi", 480, 22],
  ["salata", "Salad", 280, 10],
  ["salad", "Salad", 280, 10],
  ["corba", "Soup", 210, 9],
  ["soup", "Soup", 210, 9],
  ["banana", "Banana", 105, 1],
  ["muz", "Banana", 105, 1],
  ["apple", "Apple", 95, 0],
  ["elma", "Apple", 95, 0],
  ["tea", "Tea", 15, 0],
  ["cay", "Tea", 15, 0],
];

const CATEGORY_RULES = [
  ["Eating out", [
    "eating out", "coffee", "kahve", "latte", "cappuccino", "espresso", "americano",
    "starbucks", "cafe", "kafe", "lunch", "dinner", "breakfast", "ogle", "aksam",
    "kahvalti", "restaurant", "restoran", "burger", "hamburger", "pizza", "sushi",
    "doner", "durum", "kebab", "shawarma", "tavuk", "yemek", "chipotle", "taco",
    "sandwich", "tost", "wrap", "salad", "salata", "soup", "corba", "dessert", "tatli",
    "tea", "cay", "meal", "snack", "bowl",
  ]],
  ["Food", [
    "grocer", "market", "supermarket", "migros", "bim", "a101", "food", "fruit",
    "meyve", "sebze", "eggs", "yumurta", "milk", "sut", "bread", "ekmek", "whey",
    "oats", "yulaf", "yogurt", "banana", "muz", "apple", "elma", "salmon", "somon",
    "steak", "kofte", "pasta", "makarna",
  ]],
  ["Transport", [
    "uber", "taxi", "taksi", "metro", "bus", "otobus", "train", "tren", "tram",
    "fuel", "benzin", "mazot", "parking", "otopark", "flight", "ucak", "ticket",
    "bilet", "transit", "transport", "gas",
  ]],
  ["Bills", [
    "rent", "kira", "bill", "fatura", "electric", "elektrik", "internet", "wifi",
    "phone", "telefon", "dogalgaz", "subscription", "abonelik", "netflix", "spotify",
    "icloud",
  ]],
  ["Health", [
    "gym", "spor", "pharmacy", "eczane", "doctor", "doktor", "medicine", "ilac",
    "vitamin", "clinic", "dentist", "health", "hospital", "hastane",
  ]],
  ["Fun", [
    "movie", "cinema", "sinema", "game", "oyun", "steam", "bar", "pub", "club",
    "concert", "konser", "party", "fun", "book", "kitap", "hobby",
  ]],
];

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

function fold(text) {
  return String(text).replace(/[İIıŞşĞğÜüÖöÇç\u0307]/g, (c) => FOLD_MAP[c] || c).toLowerCase();
}

function parseFloatToken(raw) {
  return parseFloat(String(raw).replace(",", "."));
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasKeyword(folded, keyword) {
  return new RegExp(`(?<![a-z0-9])${escapeRe(keyword)}(?![a-z0-9])`).test(folded);
}

function detectCategory(folded) {
  for (const [cat, keywords] of CATEGORY_RULES) {
    for (const kw of keywords) {
      if (hasKeyword(folded, kw)) return cat;
    }
  }
  return "Other";
}

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

export function buildDailySeries(startDt, expenses, meals, water) {
  const dt = typeof startDt === "string" ? parseDay(startDt, "start") : startDt;
  const expByDay = sumBy(expenses, "amount");
  const kcalByDay = sumBy(meals, "kcal");
  const protByDay = sumBy(meals, "protein");
  const waterByDay = sumBy(water, "ml");
  const series = [];
  for (let offset = 0; offset < 7; offset++) {
    const d = iso(addDays(dt, offset));
    series.push({
      date: d,
      spent: money(expByDay.get(d) || 0),
      kcal: round(kcalByDay.get(d) || 0),
      protein: money(protByDay.get(d) || 0),
      water_ml: round(waterByDay.get(d) || 0),
    });
  }
  return series;
}

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
  const daily_series = buildDailySeries(startDt, expenses, meals, water);

  const logged = new Set([...expenses, ...meals, ...water].map((r) => r.date));
  if (logged.size < MIN_LOGGED_DAYS) {
    const missing = MIN_LOGGED_DAYS - logged.size;
    return {
      status: "insufficient_data",
      period: { start, end },
      days_logged: logged.size,
      daily_series,
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

  return { status: "ok", period: { start, end }, days_logged: logged.size, headline, money: m, nutrition, daily_series, actions };
}

export function parseQuickLog(a = {}) {
  const raw = String((a || {}).text ?? "").trim();
  if (raw.length > 400) throw new Error("text must be at most 400 characters");
  if (!raw) {
    return { raw: "", expenses: [], meals: [], water: [], fasting: null, matched: false };
  }

  const folded = fold(raw);
  let work = folded;
  const expenses = [];
  const meals = [];
  const water = [];
  let fasting = null;

  // 1. Fasting commands
  const stopFastRe = /\b(?:stop|end|break|finish)\s+(?:my\s+)?fast(?:ing)?\b|\boruc(?:u|umu)?\s+(?:bitir|durdur|boz)\b/;
  const startFastRe = /\b(?:start|begin)?\s*(14|16|18|20)\s*(?:h|hr|hrs|hour|hours|saat)?\s*(?::\s*\d{1,2})?\s*(?:fast(?:ing)?|oruc(?:a|u)?)\b|\b(?:start|begin)\s+(?:a\s+)?fast(?:ing)?\b|\boruc(?:a)?\s+(?:basla|baslat)\b/;
  const mStop = stopFastRe.exec(work);
  if (mStop) {
    fasting = { action: "stop" };
    work = work.slice(0, mStop.index) + " " + work.slice(mStop.index + mStop[0].length);
  } else {
    const mStart = startFastRe.exec(work);
    if (mStart) {
      const hrs = mStart[1] ? Number(mStart[1]) : 16;
      fasting = { action: "start", target_hours: hrs };
      work = work.slice(0, mStart.index) + " " + work.slice(mStart.index + mStart[0].length);
    }
  }

  // 2. Water tokens
  const waterPatterns = [
    [/\b(\d+(?:[.,]\d+)?)\s*(?:ml|milliliters?)\b/g, 1.0, 10000],
    [/\b(\d+(?:[.,]\d+)?)\s*(?:lt|liters?|litres?|l)\b/g, 1000.0, 10],
    [/\b(\d+(?:[.,]\d+)?)\s*(?:glass(?:es)?|bardak)\b/g, 250.0, 20],
    [/\b(\d+(?:[.,]\d+)?)\s*(?:bottle(?:s)?|sise)\b/g, 500.0, 10],
  ];
  for (const [pat, mult, maxRaw] of waterPatterns) {
    work = work.replace(pat, (_, numStr) => {
      const val = parseFloatToken(numStr);
      if (val > 0 && val <= maxRaw) {
        const ml = round(val * mult);
        if (ml > 0) water.push({ ml });
      }
      return " ";
    });
  }

  // 3. Calories & Protein tokens
  let totalKcal = 0;
  let totalProtein = 0;
  work = work.replace(/\b(\d+(?:[.,]\d+)?)\s*(?:kcal|cals?|calories?|kalori)\b/g, (_, numStr) => {
    const val = parseFloatToken(numStr);
    if (val > 0 && val <= 10000) totalKcal += val;
    return " ";
  });
  work = work.replace(/\b(\d+(?:[.,]\d+)?)\s*(?:(?:g|gr|grams?|gram)\s*(?:protein|prot|pro|p)|(?:protein|prot|pro)|p)\b/g, (_, numStr) => {
    const val = parseFloatToken(numStr);
    if (val > 0 && val <= 500) totalProtein += val;
    return " ";
  });

  // 4. Money / Expense tokens (consume strict currency spans)
  const category = detectCategory(folded);
  const moneyPatterns = [
    /([$€£₺])\s*(\d+(?:[.,]\d+)?)(?![a-z0-9])/g,
    /(?<![a-z0-9])(\d+(?:[.,]\d+)?)\s*(?:₺|\$|€|£|(?:usd|eur|gbp|try|cad|aud|inr|tl|dollars?|bucks?|lira)(?![a-z0-9]))/g,
    /\b(?:spent|paid|cost|harcadim|odedim)\s+(\d+(?:[.,]\d+)?)(?![a-z0-9])/g,
  ];
  moneyPatterns.forEach((pat, idx) => {
    work = work.replace(pat, (_, g1, g2) => {
      const rawNum = idx === 0 ? g2 : g1;
      const val = parseFloatToken(rawNum);
      if (val > 0 && val <= 1000000) expenses.push({ amount: money(val), category });
      return " ";
    });
  });

  // 5. Meal assembly (explicit macros or deterministic local food lexicon)
  let matchedFood = null;
  for (const entry of FOOD_LEXICON) {
    if (hasKeyword(folded, entry[0])) {
      matchedFood = entry;
      break;
    }
  }

  if (totalKcal > 0 || totalProtein > 0) {
    const finalKcal = totalKcal > 0 ? round(totalKcal) : round(totalProtein * 4);
    meals.push({
      kcal: finalKcal,
      protein: money(totalProtein),
      label: matchedFood ? matchedFood[1] : "Quick Meal",
      estimated: false,
    });
  } else if (matchedFood) {
    meals.push({
      kcal: matchedFood[2],
      protein: money(matchedFood[3]),
      label: matchedFood[1],
      estimated: true,
    });
  }

  const matched = Boolean(expenses.length || meals.length || water.length || fasting);
  return { raw, expenses, meals, water, fasting, matched };
}

export function computeDailyPulse({ spentToday, safeDaily, kcalToday, kcalTarget, proteinToday, proteinTarget, waterToday, waterTarget }) {
  // Budget discipline (30 pts)
  let budgetScore = 30;
  if (safeDaily > 0) {
    if (spentToday <= safeDaily) budgetScore = 30;
    else budgetScore = Math.max(0, Math.round(30 * Math.max(0, 1 - (spentToday - safeDaily) / safeDaily)));
  } else if (spentToday > 0) {
    budgetScore = 0;
  }

  // Protein progress (25 pts)
  const protRatio = proteinTarget > 0 ? Math.min(1, proteinToday / proteinTarget) : 0;
  const proteinScore = Math.round(protRatio * 25);

  // Hydration progress (25 pts)
  const waterRatio = waterTarget > 0 ? Math.min(1, waterToday / waterTarget) : 0;
  const waterScore = Math.round(waterRatio * 25);

  // Calorie alignment (20 pts)
  let calorieScore = 0;
  if (kcalTarget > 0 && kcalToday > 0) {
    const ratio = kcalToday / kcalTarget;
    if (ratio <= 1.05) calorieScore = Math.round(Math.min(1, ratio) * 20);
    else calorieScore = Math.max(0, Math.round(20 * Math.max(0, 1 - (ratio - 1.05) / 0.5)));
  }

  const total = Math.max(0, Math.min(100, budgetScore + proteinScore + waterScore + calorieScore));
  return { total, budgetScore, proteinScore, waterScore, calorieScore };
}

export const TOOLS = {
  plan_targets: planTargets,
  weekly_review: weeklyReview,
  parse_quick_log: parseQuickLog,
};
