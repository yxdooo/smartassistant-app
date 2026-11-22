"""SmartAssistant Executa: deterministic money, nutrition and quick-log calculations.

Speaks JSON-RPC 2.0 over stdio. Uses only the standard library so it can be
frozen into a single binary for linux-x86_64 for Anna Cloud Agent.

Tools:
    ping            smoke test
    plan_targets    daily safe spend, calorie, macro and water targets
    weekly_review   7-day review of spending and nutrition with daily_series and actions
    parse_quick_log bilingual (EN/TR) deterministic natural-language quick-log parser

The same rules are implemented in anna/bundle/engine.js so the app also works
when the Executa is not reachable. tests/parity.json keeps both in sync.
"""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from datetime import date, timedelta
from calendar import monthrange

VERSION = "0.1.8"
MIN_LOGGED_DAYS = 3

ACTIVITY = {
    "sedentary": 1.2,
    "light": 1.375,
    "moderate": 1.55,
    "active": 1.725,
}
PROTEIN_PER_KG = {"lose": 2.0, "maintain": 1.6, "gain": 1.8}
KCAL_ADJUST = {"lose": -500, "maintain": 0, "gain": 300}
KCAL_FLOOR = {"female": 1200, "male": 1500}

_FOLD_MAP = str.maketrans({
    "İ": "i", "I": "i", "ı": "i",
    "Ş": "s", "ş": "s",
    "Ğ": "g", "ğ": "g",
    "Ü": "u", "ü": "u",
    "Ö": "o", "ö": "o",
    "Ç": "c", "ç": "c",
    "\u0307": "",
})

_FOOD_LEXICON = [
    ("chicken bowl", "Chicken Bowl", 620, 46),
    ("tavuk pilav", "Chicken & Rice", 620, 46),
    ("protein shake", "Protein Shake", 180, 30),
    ("whey", "Protein Shake", 160, 28),
    ("caesar salad", "Caesar Salad", 420, 34),
    ("tavuk salata", "Chicken Salad", 420, 34),
    ("iced latte", "Iced Latte", 140, 6),
    ("cappuccino", "Cappuccino", 120, 6),
    ("latte", "Latte", 140, 6),
    ("americano", "Americano", 15, 0),
    ("espresso", "Espresso", 10, 0),
    ("coffee", "Coffee", 30, 1),
    ("kahve", "Coffee", 30, 1),
    ("hamburger", "Burger", 680, 34),
    ("burger", "Burger", 680, 34),
    ("pizza", "Pizza", 720, 28),
    ("shawarma", "Wrap / Doner", 640, 38),
    ("doner", "Doner", 640, 38),
    ("durum", "Wrap / Durum", 620, 36),
    ("kebab", "Kebab", 660, 42),
    ("avocado toast", "Avocado Toast", 360, 12),
    ("sandwich", "Sandwich", 440, 22),
    ("tost", "Toast", 390, 18),
    ("wrap", "Wrap", 480, 26),
    ("omelette", "Omelette", 320, 22),
    ("menemen", "Menemen", 310, 18),
    ("yumurta", "Eggs", 240, 18),
    ("eggs", "Eggs", 240, 18),
    ("oatmeal", "Oatmeal", 340, 14),
    ("oats", "Oats", 340, 14),
    ("yulaf", "Oats", 340, 14),
    ("yogurt", "Yogurt", 180, 16),
    ("makarna", "Pasta", 560, 18),
    ("pasta", "Pasta", 560, 18),
    ("somon", "Salmon", 520, 42),
    ("salmon", "Salmon", 520, 42),
    ("steak", "Steak", 560, 48),
    ("kofte", "Meatballs", 520, 36),
    ("sushi", "Sushi", 480, 22),
    ("salata", "Salad", 280, 10),
    ("salad", "Salad", 280, 10),
    ("corba", "Soup", 210, 9),
    ("soup", "Soup", 210, 9),
    ("banana", "Banana", 105, 1),
    ("muz", "Banana", 105, 1),
    ("apple", "Apple", 95, 0),
    ("elma", "Apple", 95, 0),
    ("tea", "Tea", 15, 0),
    ("cay", "Tea", 15, 0),
]

_CATEGORY_RULES = [
    ("Eating out", [
        "eating out", "coffee", "kahve", "latte", "cappuccino", "espresso", "americano",
        "starbucks", "cafe", "kafe", "lunch", "dinner", "breakfast", "ogle", "aksam",
        "kahvalti", "restaurant", "restoran", "burger", "hamburger", "pizza", "sushi",
        "doner", "durum", "kebab", "shawarma", "tavuk", "yemek", "chipotle", "taco",
        "sandwich", "tost", "wrap", "salad", "salata", "soup", "corba", "dessert", "tatli",
        "tea", "cay", "meal", "snack", "bowl",
    ]),
    ("Food", [
        "grocer", "market", "supermarket", "migros", "bim", "a101", "food", "fruit",
        "meyve", "sebze", "eggs", "yumurta", "milk", "sut", "bread", "ekmek", "whey",
        "oats", "yulaf", "yogurt", "banana", "muz", "apple", "elma", "salmon", "somon",
        "steak", "kofte", "pasta", "makarna",
    ]),
    ("Transport", [
        "uber", "taxi", "taksi", "metro", "bus", "otobus", "train", "tren", "tram",
        "fuel", "benzin", "mazot", "parking", "otopark", "flight", "ucak", "ticket",
        "bilet", "transit", "transport", "gas",
    ]),
    ("Bills", [
        "rent", "kira", "bill", "fatura", "electric", "elektrik", "internet", "wifi",
        "phone", "telefon", "dogalgaz", "subscription", "abonelik", "netflix", "spotify",
        "icloud",
    ]),
    ("Health", [
        "gym", "spor", "pharmacy", "eczane", "doctor", "doktor", "medicine", "ilac",
        "vitamin", "clinic", "dentist", "health", "hospital", "hastane",
    ]),
    ("Fun", [
        "movie", "cinema", "sinema", "game", "oyun", "steam", "bar", "pub", "club",
        "concert", "konser", "party", "fun", "book", "kitap", "hobby",
    ]),
]


def _fold(text: str) -> str:
    return text.translate(_FOLD_MAP).lower()


def _parse_float_token(raw: str) -> float:
    return float(raw.replace(",", "."))


def _num(value, name, minimum=None, maximum=None):
    try:
        n = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be a number")
    if n != n or n in (float("inf"), float("-inf")):
        raise ValueError(f"{name} must be a finite number")
    if minimum is not None and n < minimum:
        raise ValueError(f"{name} must be at least {minimum}")
    if maximum is not None and n > maximum:
        raise ValueError(f"{name} must be at most {maximum}")
    return n


def _day(value, name):
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        raise ValueError(f"{name} must be a date like 2026-01-31")


def _round(n, step=1):
    return int(round(n / step) * step)


def _money(n):
    return round(n + 1e-9, 2)


def _has_keyword(folded: str, keyword: str) -> bool:
    pattern = r"(?<![a-z0-9])" + re.escape(keyword) + r"(?![a-z0-9])"
    return re.search(pattern, folded) is not None


def _detect_category(folded: str) -> str:
    for category, keywords in _CATEGORY_RULES:
        for kw in keywords:
            if _has_keyword(folded, kw):
                return category
    return "Other"


def plan_targets(args: dict) -> dict:
    weight = _num(args.get("weight_kg"), "weight_kg", 30, 300)
    height = _num(args.get("height_cm"), "height_cm", 120, 230)
    age = _num(args.get("age"), "age", 14, 100)
    sex = args.get("sex", "female")
    if sex not in KCAL_FLOOR:
        raise ValueError("sex must be 'female' or 'male'")
    activity = args.get("activity", "light")
    if activity not in ACTIVITY:
        raise ValueError("activity must be one of " + ", ".join(ACTIVITY))
    goal = args.get("goal", "maintain")
    if goal not in KCAL_ADJUST:
        raise ValueError("goal must be one of " + ", ".join(KCAL_ADJUST))
    budget = _num(args.get("monthly_budget"), "monthly_budget", 0)
    fixed = _num(args.get("fixed_costs", 0), "fixed_costs", 0)
    spent = _num(args.get("spent_so_far", 0), "spent_so_far", 0)
    today = _day(args.get("today") or date.today().isoformat(), "today")

    bmr = 10 * weight + 6.25 * height - 5 * age + (5 if sex == "male" else -161)
    tdee = bmr * ACTIVITY[activity]
    kcal = max(KCAL_FLOOR[sex], tdee + KCAL_ADJUST[goal])
    protein = weight * PROTEIN_PER_KG[goal]
    fat = kcal * 0.25 / 9
    carbs = max(0.0, (kcal - protein * 4 - fat * 9) / 4)

    days_in_month = monthrange(today.year, today.month)[1]
    days_left = days_in_month - today.day + 1
    free_money = budget - fixed
    remaining = free_money - spent
    safe_daily = max(0.0, remaining) / days_left

    return {
        "calories": _round(kcal, 10),
        "protein_g": _round(protein),
        "fat_g": _round(fat),
        "carbs_g": _round(carbs),
        "water_ml": _round(weight * 35, 50),
        "bmr": _round(bmr),
        "maintenance_calories": _round(tdee, 10),
        "safe_daily_spend": _money(safe_daily),
        "spendable_this_month": _money(free_money),
        "remaining_this_month": _money(remaining),
        "days_left_in_month": days_left,
        "over_budget": remaining < 0,
    }


def _clean_rows(rows, kind, fields):
    out = []
    for i, row in enumerate(rows or []):
        if not isinstance(row, dict):
            raise ValueError(f"{kind}[{i}] must be an object")
        item = {"date": _day(row.get("date"), f"{kind}[{i}].date")}
        for f in fields:
            item[f] = _num(row.get(f, 0), f"{kind}[{i}].{f}", 0)
        if kind == "expenses":
            item["category"] = str(row.get("category") or "Other")[:40]
        out.append(item)
    return out


def _build_daily_series(start: date, expenses, meals, water):
    exp_by_day = defaultdict(float)
    kcal_by_day = defaultdict(float)
    prot_by_day = defaultdict(float)
    water_by_day = defaultdict(float)
    for r in expenses:
        exp_by_day[r["date"]] += r["amount"]
    for r in meals:
        kcal_by_day[r["date"]] += r["kcal"]
        prot_by_day[r["date"]] += r["protein"]
    for r in water:
        water_by_day[r["date"]] += r["ml"]

    series = []
    for offset in range(7):
        d = start + timedelta(days=offset)
        series.append({
            "date": d.isoformat(),
            "spent": _money(exp_by_day[d]),
            "kcal": _round(kcal_by_day[d]),
            "protein": _money(prot_by_day[d]),
            "water_ml": _round(water_by_day[d]),
        })
    return series


def weekly_review(args: dict) -> dict:
    profile = args.get("profile") or {}
    end = _day(args.get("week_end") or date.today().isoformat(), "week_end")
    start = end - timedelta(days=6)
    budget = _num(profile.get("monthly_budget", 0), "profile.monthly_budget", 0)
    fixed = _num(profile.get("fixed_costs", 0), "profile.fixed_costs", 0)
    kcal_target = _num(profile.get("calories", 0), "profile.calories", 0)
    protein_target = _num(profile.get("protein_g", 0), "profile.protein_g", 0)
    water_target = _num(profile.get("water_ml", 0), "profile.water_ml", 0)

    expenses = _clean_rows(args.get("expenses"), "expenses", ["amount"])
    meals = _clean_rows(args.get("meals"), "meals", ["kcal", "protein"])
    water = _clean_rows(args.get("water"), "water", ["ml"])

    def in_week(r):
        return start <= r["date"] <= end

    expenses = [r for r in expenses if in_week(r)]
    meals = [r for r in meals if in_week(r)]
    water = [r for r in water if in_week(r)]
    daily_series = _build_daily_series(start, expenses, meals, water)

    logged_days = {r["date"] for r in expenses + meals + water}
    if len(logged_days) < MIN_LOGGED_DAYS:
        missing = MIN_LOGGED_DAYS - len(logged_days)
        return {
            "status": "insufficient_data",
            "period": {"start": start.isoformat(), "end": end.isoformat()},
            "days_logged": len(logged_days),
            "daily_series": daily_series,
            "message": (
                f"Only {len(logged_days)} of the last 7 days have entries. "
                f"Log {missing} more day{'s' if missing != 1 else ''} "
                "(an expense, a meal or a glass of water counts) and run the review again."
            ),
        }

    days_in_month = monthrange(end.year, end.month)[1]
    weekly_allowance = max(0.0, budget - fixed) * 7 / days_in_month if budget else 0.0
    spent = sum(r["amount"] for r in expenses)
    by_cat = defaultdict(float)
    by_day = defaultdict(float)
    for r in expenses:
        by_cat[r["category"]] += r["amount"]
        by_day[r["date"]] += r["amount"]
    categories = sorted(by_cat.items(), key=lambda kv: (-kv[1], kv[0]))
    top = categories[0] if categories else None
    priciest = max(by_day.items(), key=lambda kv: (kv[1], kv[0])) if by_day else None
    diff = spent - weekly_allowance

    money = {
        "spent": _money(spent),
        "weekly_allowance": _money(weekly_allowance),
        "difference": _money(diff),
        "status": ("over" if diff > weekly_allowance * 0.05 else "on_track" if diff >= -weekly_allowance * 0.05 else "under") if weekly_allowance else "no_budget",
        "top_categories": [
            {"category": c, "amount": _money(a), "share": round(a / spent, 3) if spent else 0}
            for c, a in categories[:3]
        ],
        "priciest_day": (
            {"date": priciest[0].isoformat(), "amount": _money(priciest[1])} if priciest else None
        ),
    }

    kcal_by_day = defaultdict(float)
    protein_by_day = defaultdict(float)
    for r in meals:
        kcal_by_day[r["date"]] += r["kcal"]
        protein_by_day[r["date"]] += r["protein"]
    meal_days = len(kcal_by_day)
    avg_kcal = sum(kcal_by_day.values()) / meal_days if meal_days else 0.0
    avg_protein = sum(protein_by_day.values()) / meal_days if meal_days else 0.0
    water_by_day = defaultdict(float)
    for r in water:
        water_by_day[r["date"]] += r["ml"]
    water_hit = sum(1 for v in water_by_day.values() if water_target and v >= water_target * 0.8)
    avg_water = sum(water_by_day.values()) / len(water_by_day) if water_by_day else 0.0

    nutrition = {
        "meal_days": meal_days,
        "avg_calories": _round(avg_kcal),
        "calorie_target": _round(kcal_target),
        "avg_protein_g": _round(avg_protein),
        "protein_target_g": _round(protein_target),
        "water_days": len(water_by_day),
        "water_days_on_target": water_hit,
        "avg_water_ml": _round(avg_water, 50),
        "water_target_ml": _round(water_target),
    }

    actions = []
    if money["status"] == "over":
        line = (
            f"You spent {money['spent']:.2f} against a weekly allowance of "
            f"{money['weekly_allowance']:.2f}, which is {abs(money['difference']):.2f} over."
        )
        if top:
            cut = min(top[1], abs(diff))
            line += (
                f" {top[0]} was the biggest category at {top[1]:.2f}. "
                f"Trimming it by {cut:.2f} next week puts you back on pace."
            )
        actions.append(line)
    elif money["status"] == "under":
        actions.append(
            f"You finished {abs(money['difference']):.2f} under your weekly allowance. "
            "Move that amount to savings now so it does not get spent later in the month."
        )
    elif money["status"] == "on_track":
        actions.append(
            f"Spending is within 5% of your {money['weekly_allowance']:.2f} weekly allowance. Keep the same pace."
        )
    else:
        actions.append("Set a monthly budget to compare weekly spending against an allowance.")
    if priciest and spent and priciest[1] > spent * 0.4:
        actions.append(
            f"{priciest[1] / spent:.0%} of the week's spending landed on {priciest[0].strftime('%A')}. "
            "Check if that purchase could have been planned or split."
        )

    if meal_days and kcal_target:
        gap = avg_kcal - kcal_target
        if abs(gap) > kcal_target * 0.1:
            direction = "above" if gap > 0 else "below"
            actions.append(
                f"On the {meal_days} day{'s' if meal_days != 1 else ''} you logged meals, you averaged "
                f"{_round(avg_kcal)} kcal, {abs(_round(gap))} {direction} your {_round(kcal_target)} kcal target."
            )
        else:
            actions.append(
                f"Calories averaged {_round(avg_kcal)} kcal, within 10% of your {_round(kcal_target)} kcal target."
            )
    elif not meal_days:
        actions.append("No meals were logged this week, so there is no calorie or protein comparison yet.")
    if meal_days and protein_target and avg_protein < protein_target * 0.85:
        actions.append(
            f"Protein averaged {_round(avg_protein)} g against a {_round(protein_target)} g target. "
            f"Adding about {_round(protein_target - avg_protein)} g per day closes the gap."
        )
    if water_target and water_by_day:
        if water_hit < len(water_by_day):
            actions.append(
                f"You reached 80% of your {_round(water_target)} ml water goal on {water_hit} of "
                f"{len(water_by_day)} logged days."
            )

    headline_parts = []
    if weekly_allowance:
        headline_parts.append(
            f"{abs(money['difference']):.2f} {'over' if diff > 0 else 'under'} budget"
        )
    if meal_days and kcal_target:
        headline_parts.append(f"{_round(avg_kcal)} kcal/day vs {_round(kcal_target)} target")
    headline = "Week of " + start.strftime("%b %d") + ": " + (", ".join(headline_parts) or f"{money['spent']:.2f} spent")

    return {
        "status": "ok",
        "period": {"start": start.isoformat(), "end": end.isoformat()},
        "days_logged": len(logged_days),
        "headline": headline,
        "money": money,
        "nutrition": nutrition,
        "daily_series": daily_series,
        "actions": actions,
    }


def parse_quick_log(args: dict) -> dict:
    raw = str((args or {}).get("text") or "").strip()
    if len(raw) > 400:
        raise ValueError("text must be at most 400 characters")
    if not raw:
        return {
            "raw": "",
            "expenses": [],
            "meals": [],
            "water": [],
            "fasting": None,
            "matched": False,
        }

    folded = _fold(raw)
    work = folded
    expenses = []
    meals = []
    water = []
    fasting = None

    # 1. Fasting commands
    stop_fast_re = re.compile(
        r"\b(?:stop|end|break|finish)\s+(?:my\s+)?fast(?:ing)?\b|\boruc(?:u|umu)?\s+(?:bitir|durdur|boz)\b"
    )
    start_fast_re = re.compile(
        r"\b(?:start|begin)?\s*(14|16|18|20)\s*(?:h|hr|hrs|hour|hours|saat)?\s*(?::\s*\d{1,2})?\s*(?:fast(?:ing)?|oruc(?:a|u)?)\b"
        r"|\b(?:start|begin)\s+(?:a\s+)?fast(?:ing)?\b"
        r"|\boruc(?:a)?\s+(?:basla|baslat)\b"
    )
    m_stop = stop_fast_re.search(work)
    if m_stop:
        fasting = {"action": "stop"}
        work = work[:m_stop.start()] + " " + work[m_stop.end():]
    else:
        m_start = start_fast_re.search(work)
        if m_start:
            hrs = int(m_start.group(1)) if m_start.group(1) else 16
            fasting = {"action": "start", "target_hours": hrs}
            work = work[:m_start.start()] + " " + work[m_start.end():]

    # 2. Water tokens
    water_patterns = [
        (re.compile(r"\b(\d+(?:[.,]\d+)?)\s*(?:ml|milliliters?)\b"), 1.0, 10000),
        (re.compile(r"\b(\d+(?:[.,]\d+)?)\s*(?:lt|liters?|litres?|l)\b"), 1000.0, 10),
        (re.compile(r"\b(\d+(?:[.,]\d+)?)\s*(?:glass(?:es)?|bardak)\b"), 250.0, 20),
        (re.compile(r"\b(\d+(?:[.,]\d+)?)\s*(?:bottle(?:s)?|sise)\b"), 500.0, 10),
    ]
    for pat, mult, max_raw in water_patterns:
        def _take_water(match, mult=mult, max_raw=max_raw):
            val = _parse_float_token(match.group(1))
            if 0 < val <= max_raw:
                ml = _round(val * mult)
                if ml > 0:
                    water.append({"ml": ml})
            return " "
        work = pat.sub(_take_water, work)

    # 3. Calories & Protein tokens
    total_kcal = 0.0
    total_protein = 0.0
    kcal_re = re.compile(r"\b(\d+(?:[.,]\d+)?)\s*(?:kcal|cals?|calories?|kalori)\b")
    prot_re = re.compile(
        r"\b(\d+(?:[.,]\d+)?)\s*(?:(?:g|gr|grams?|gram)\s*(?:protein|prot|pro|p)|(?:protein|prot|pro)|p)\b"
    )

    def _take_kcal(match):
        nonlocal total_kcal
        val = _parse_float_token(match.group(1))
        if 0 < val <= 10000:
            total_kcal += val
        return " "

    def _take_prot(match):
        nonlocal total_protein
        val = _parse_float_token(match.group(1))
        if 0 < val <= 500:
            total_protein += val
        return " "

    work = kcal_re.sub(_take_kcal, work)
    work = prot_re.sub(_take_prot, work)

    # 4. Money / Expense tokens (consume strict currency spans)
    category = _detect_category(folded)
    money_patterns = [
        re.compile(r"([$€£₺])\s*(\d+(?:[.,]\d+)?)(?![a-z0-9])"),
        re.compile(
            r"(?<![a-z0-9])(\d+(?:[.,]\d+)?)\s*(?:₺|\$|€|£|(?:usd|eur|gbp|try|cad|aud|inr|tl|dollars?|bucks?|lira)(?![a-z0-9]))"
        ),
        re.compile(r"\b(?:spent|paid|cost|harcadim|odedim)\s+(\d+(?:[.,]\d+)?)(?![a-z0-9])"),
    ]
    for idx, pat in enumerate(money_patterns):
        def _take_money(match, idx=idx):
            raw_num = match.group(2) if idx == 0 else match.group(1)
            val = _parse_float_token(raw_num)
            if 0 < val <= 1000000:
                expenses.append({"amount": _money(val), "category": category})
            return " "
        work = pat.sub(_take_money, work)

    # 5. Meal assembly (explicit macros or deterministic local food lexicon)
    matched_food = None
    for key, title, est_kcal, est_prot in _FOOD_LEXICON:
        if _has_keyword(folded, key):
            matched_food = (title, est_kcal, est_prot)
            break

    if total_kcal > 0 or total_protein > 0:
        final_kcal = _round(total_kcal) if total_kcal > 0 else _round(total_protein * 4)
        meals.append({
            "kcal": final_kcal,
            "protein": _money(total_protein),
            "label": matched_food[0] if matched_food else "Quick Meal",
            "estimated": False,
        })
    elif matched_food is not None:
        meals.append({
            "kcal": matched_food[1],
            "protein": _money(matched_food[2]),
            "label": matched_food[0],
            "estimated": True,
        })

    matched = bool(expenses or meals or water or fasting)
    return {
        "raw": raw,
        "expenses": expenses,
        "meals": meals,
        "water": water,
        "fasting": fasting,
        "matched": matched,
    }


def _schema(props, required=()):
    return {
        "type": "object",
        "properties": props,
        "required": list(required),
        "additionalProperties": False,
    }


_ROWS = {"type": "array", "items": {"type": "object"}}

MANIFEST = {
    "name": "tool-dev-smartassistant",
    "display_name": "SmartAssistant",
    "version": VERSION,
    "description": "Daily safe spend, nutrition targets, natural-language quick-log parser and weekly money and nutrition review.",
    "tools": [
        {
            "name": "ping",
            "description": "Smoke-test method.",
            "parameters": [],
        },
        {
            "name": "plan_targets",
            "description": "Compute calorie, macro and water targets and the safe daily spend for the rest of the month.",
            "parameters": [
                {"name": "weight_kg", "type": "number", "description": "Weight in kilograms", "required": True},
                {"name": "height_cm", "type": "number", "description": "Height in centimeters", "required": True},
                {"name": "age", "type": "number", "description": "Age in years", "required": True},
                {"name": "monthly_budget", "type": "number", "description": "Monthly budget amount", "required": True},
                {"name": "sex", "type": "string", "enum": ["female", "male"], "description": "Biological sex for calorie formula (female or male)", "required": False},
                {"name": "activity", "type": "string", "enum": list(ACTIVITY), "description": "Activity level (sedentary, light, moderate, active)", "required": False},
                {"name": "goal", "type": "string", "enum": list(KCAL_ADJUST), "description": "Fitness goal (lose, maintain, gain)", "required": False},
                {"name": "fixed_costs", "type": "number", "description": "Fixed monthly expenses like rent and bills", "required": False},
                {"name": "spent_so_far", "type": "number", "description": "Amount already spent this month", "required": False},
                {"name": "today", "type": "string", "description": "Reference date YYYY-MM-DD", "required": False},
            ],
        },
        {
            "name": "weekly_review",
            "description": "Review the 7 days ending on week_end: spending vs allowance, calories, protein and water vs targets, with daily series and specific actions.",
            "parameters": [
                {"name": "profile", "type": "object", "description": "User profile with budget and nutrition targets", "required": True},
                {"name": "expenses", "type": "array", "items": {"type": "object"}, "description": "Logged expenses with amount, category, date", "required": False},
                {"name": "meals", "type": "array", "items": {"type": "object"}, "description": "Logged meals with calories, protein, date", "required": False},
                {"name": "water", "type": "array", "items": {"type": "object"}, "description": "Logged water entries with milliliters or glasses, date", "required": False},
                {"name": "week_end", "type": "string", "description": "End date of 7-day review YYYY-MM-DD", "required": False},
            ],
        },
        {
            "name": "parse_quick_log",
            "description": "Parse a single natural-language line (EN or TR) into expenses, meals, water and fasting actions.",
            "parameters": [
                {"name": "text", "type": "string", "description": "Natural-language quick log input", "required": True},
            ],
        },
    ],
}

TOOLS = {
    "plan_targets": plan_targets,
    "weekly_review": weekly_review,
    "parse_quick_log": parse_quick_log,
}


def invoke(method: str, args: dict) -> dict:
    # Tool methods return the dispatcher envelope:
    #   {"success": True,  "data":  <payload-dict>}
    #   {"success": False, "error": "<reason>"}
    if method == "ping":
        return {"success": True, "data": {"pong": True, "version": VERSION}}
    fn = TOOLS.get(method)
    if fn is None:
        return {"success": False, "error": f"unknown method: {method}"}
    try:
        return {"success": True, "data": fn(args or {})}
    except ValueError as e:
        return {"success": False, "error": str(e)}


def _handle(req: dict):
    rpc = req.get("method")
    if rpc == "describe":
        return MANIFEST
    if rpc == "health":
        return {"status": "ready"}
    if rpc == "invoke":
        params = req.get("params") or {}
        tool = params.get("tool") or params.get("name")
        return invoke(tool, params.get("arguments", {}))
    raise ValueError(f"unknown rpc: {rpc}")


def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError as e:
            sys.stdout.write(
                json.dumps({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": str(e)}}) + "\n"
            )
            sys.stdout.flush()
            continue
        try:
            resp = {"jsonrpc": "2.0", "id": req.get("id"), "result": _handle(req)}
        except Exception as e:  # noqa: BLE001
            resp = {"jsonrpc": "2.0", "id": req.get("id"), "error": {"code": -32601, "message": str(e)}}
        sys.stdout.write(json.dumps(resp) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
