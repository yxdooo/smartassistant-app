"""SmartAssistant Executa: deterministic money and nutrition calculations.

Speaks JSON-RPC 2.0 over stdio. Uses only the standard library so it can be
frozen into a single binary for linux-x86_64, darwin-arm64 and darwin-x86_64.

Tools:
    ping            smoke test
    plan_targets    daily safe spend, calorie, macro and water targets
    weekly_review   7-day review of spending and nutrition with actions

The same rules are implemented in anna/bundle/engine.js so the app also works
when the Executa is not reachable. tests/parity.json keeps both in sync.
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import date, timedelta
from calendar import monthrange

VERSION = "0.1.5"
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

    logged_days = {r["date"] for r in expenses + meals + water}
    if len(logged_days) < MIN_LOGGED_DAYS:
        missing = MIN_LOGGED_DAYS - len(logged_days)
        return {
            "status": "insufficient_data",
            "period": {"start": start.isoformat(), "end": end.isoformat()},
            "days_logged": len(logged_days),
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
        "actions": actions,
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
    "description": "Daily safe spend, nutrition targets and a weekly money and nutrition review.",
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
            "description": "Review the 7 days ending on week_end: spending vs allowance, calories, protein and water vs targets, with specific actions.",
            "parameters": [
                {"name": "profile", "type": "object", "description": "User profile with budget and nutrition targets", "required": True},
                {"name": "expenses", "type": "array", "items": {"type": "object"}, "description": "Logged expenses with amount, category, date", "required": False},
                {"name": "meals", "type": "array", "items": {"type": "object"}, "description": "Logged meals with calories, protein, date", "required": False},
                {"name": "water", "type": "array", "items": {"type": "object"}, "description": "Logged water entries with milliliters or glasses, date", "required": False},
                {"name": "week_end", "type": "string", "description": "End date of 7-day review YYYY-MM-DD", "required": False},
            ],
        },
    ],
}

TOOLS = {"plan_targets": plan_targets, "weekly_review": weekly_review}


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
