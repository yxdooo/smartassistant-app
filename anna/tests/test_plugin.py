"""Tests for the Executa, and parity checks against tests/parity.json.

Run from the anna/ directory:
    python -m unittest discover -s tests -v
    python tests/make_parity.py     # regenerate parity.json after a rule change
"""

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "executas" / "smartassistant"))
import smartassistant_plugin as plugin  # noqa: E402

PROFILE = {
    "monthly_budget": 2000,
    "fixed_costs": 800,
    "calories": 2000,
    "protein_g": 120,
    "water_ml": 2500,
}


def row(day, **kw):
    return {"date": f"2026-03-{day:02d}", **kw}


def week_args(**extra):
    args = {
        "profile": PROFILE,
        "week_end": "2026-03-15",
        "expenses": [
            row(9, amount=40, category="Food"),
            row(10, amount=15, category="Transport"),
            row(12, amount=120, category="Eating out"),
            row(14, amount=60, category="Food"),
        ],
        "meals": [row(9, kcal=2300, protein=70), row(10, kcal=2100, protein=80), row(12, kcal=2600, protein=75)],
        "water": [row(9, ml=2200), row(10, ml=800), row(12, ml=2500)],
    }
    args.update(extra)
    return args


PLAN_CASES = [
    {"weight_kg": 70, "height_cm": 170, "age": 30, "sex": "female", "activity": "light", "goal": "lose",
     "monthly_budget": 1500, "fixed_costs": 600, "spent_so_far": 200, "today": "2026-03-10"},
    {"weight_kg": 85, "height_cm": 182, "age": 25, "sex": "male", "activity": "active", "goal": "gain",
     "monthly_budget": 900, "today": "2026-02-28"},
    {"weight_kg": 50, "height_cm": 160, "age": 40, "sex": "female", "activity": "sedentary", "goal": "lose",
     "monthly_budget": 500, "fixed_costs": 400, "spent_so_far": 300, "today": "2026-12-31"},
]

QUICK_LOG_CASES = [
    {"text": "$14.50 lunch 620kcal 45p + 500ml"},
    {"text": "tavuk pilav 180 tl 500ml su"},
    {"text": "$12 uber"},
    {"text": "start 18h fast"},
    {"text": "orucu bitir"},
    {"text": "2 bardak su 35g protein 12€ kahve"},
    {"text": ""},
    {"text": "hello world"},
]


def review_cases():
    under = week_args(expenses=[row(9, amount=20, category="Food"), row(11, amount=10, category="Food")])
    no_meals = week_args(meals=[])
    no_budget = week_args(profile={"calories": 2000, "protein_g": 120, "water_ml": 2500})
    over = week_args(expenses=[row(9, amount=150, category="Food"), row(11, amount=200, category="Eating out"), row(13, amount=90, category="Food")])
    thin = week_args(expenses=[row(9, amount=5)], meals=[], water=[])
    return [week_args(), over, under, no_meals, no_budget, thin]


class PlanTargets(unittest.TestCase):
    def test_known_values(self):
        r = plugin.plan_targets(PLAN_CASES[0])
        self.assertEqual(r["bmr"], 1452)
        self.assertEqual(r["calories"], 1500)
        self.assertEqual(r["protein_g"], 140)
        self.assertEqual(r["water_ml"], 2450)
        self.assertEqual(r["days_left_in_month"], 22)
        self.assertAlmostEqual(r["safe_daily_spend"], 31.82, places=2)

    def test_calorie_floor_and_overspend(self):
        r = plugin.plan_targets(PLAN_CASES[2])
        self.assertEqual(r["calories"], 1200)
        self.assertTrue(r["over_budget"])
        self.assertEqual(r["safe_daily_spend"], 0)

    def test_validation(self):
        for bad in ({}, {"weight_kg": "x", "height_cm": 170, "age": 30, "monthly_budget": 1},
                    {"weight_kg": 70, "height_cm": 170, "age": 30, "monthly_budget": -1},
                    {"weight_kg": 70, "height_cm": 170, "age": 30, "monthly_budget": 1, "sex": "x"}):
            res = plugin.invoke("plan_targets", bad)
            self.assertFalse(res["success"], bad)


class WeeklyReview(unittest.TestCase):
    def test_under_budget_review(self):
        r = plugin.weekly_review(week_args())
        self.assertEqual(r["status"], "ok")
        self.assertEqual(r["money"]["spent"], 235)
        self.assertEqual(r["money"]["status"], "under")
        self.assertEqual(r["money"]["top_categories"][0]["category"], "Eating out")
        self.assertEqual(r["nutrition"]["avg_calories"], 2333)
        self.assertEqual(len(r["daily_series"]), 7)
        self.assertEqual(r["daily_series"][0]["date"], "2026-03-09")
        self.assertEqual(r["daily_series"][0]["spent"], 40.0)
        self.assertTrue(any("protein" in a.lower() for a in r["actions"]))
        self.assertTrue(all(isinstance(a, str) and a for a in r["actions"]))

    def test_over_budget_names_biggest_category(self):
        r = plugin.weekly_review(week_args(expenses=[row(9, amount=150, category="Food"), row(11, amount=200, category="Eating out"), row(13, amount=90, category="Food")]))
        self.assertEqual(r["money"]["status"], "over")
        self.assertIn("Food was the biggest category at 240.00", r["actions"][0])
        self.assertIn("Trimming it by 169.03", r["actions"][0])

    def test_insufficient_data(self):
        r = plugin.weekly_review(week_args(expenses=[row(9, amount=5)], meals=[], water=[]))
        self.assertEqual(r["status"], "insufficient_data")
        self.assertEqual(r["days_logged"], 1)
        self.assertEqual(len(r["daily_series"]), 7)
        self.assertIn("2 more days", r["message"])

    def test_old_rows_ignored(self):
        r = plugin.weekly_review(week_args(week_end="2026-04-30"))
        self.assertEqual(r["status"], "insufficient_data")

    def test_bad_row(self):
        res = plugin.invoke("weekly_review", {"profile": PROFILE, "expenses": [{"date": "nope", "amount": 1}]})
        self.assertFalse(res["success"])
        self.assertIn("expenses[0].date", res["error"])


class ParseQuickLog(unittest.TestCase):
    def test_en_multi_log(self):
        r = plugin.parse_quick_log({"text": "$14.50 lunch 620kcal 45p + 500ml"})
        self.assertTrue(r["matched"])
        self.assertEqual(r["expenses"], [{"amount": 14.5, "category": "Eating out"}])
        self.assertEqual(r["meals"], [{"kcal": 620, "protein": 45.0, "label": "Quick Meal", "estimated": False}])
        self.assertEqual(r["water"], [{"ml": 500}])

    def test_tr_food_lexicon(self):
        r = plugin.parse_quick_log({"text": "tavuk pilav 180 tl 500ml su"})
        self.assertTrue(r["matched"])
        self.assertEqual(r["expenses"][0]["amount"], 180.0)
        self.assertEqual(r["expenses"][0]["category"], "Eating out")
        self.assertEqual(r["meals"][0]["label"], "Chicken & Rice")
        self.assertTrue(r["meals"][0]["estimated"])
        self.assertEqual(r["water"], [{"ml": 500}])

    def test_fasting_commands(self):
        self.assertEqual(plugin.parse_quick_log({"text": "start 18h fast"})["fasting"], {"action": "start", "target_hours": 18})
        self.assertEqual(plugin.parse_quick_log({"text": "orucu bitir"})["fasting"], {"action": "stop"})

    def test_rejects_oversized_input(self):
        res = plugin.invoke("parse_quick_log", {"text": "x" * 401})
        self.assertFalse(res["success"])


class Protocol(unittest.TestCase):
    def test_unknown_tool(self):
        self.assertFalse(plugin.invoke("nope", {})["success"])

    def test_describe_lists_tools(self):
        tools = plugin._handle({"method": "describe"})["tools"]
        names = [t["name"] for t in tools]
        self.assertEqual(names, ["ping", "plan_targets", "weekly_review", "parse_quick_log"])
        for t in tools:
            self.assertIsInstance(t["parameters"], list)

    def test_invoke_envelope(self):
        r = plugin._handle({"method": "invoke", "params": {"tool": "ping", "arguments": {}}})
        self.assertTrue(r["success"])


class Parity(unittest.TestCase):
    def test_parity_file_current(self):
        path = ROOT / "tests" / "parity.json"
        cases = json.loads(path.read_text("utf-8"))
        self.assertGreater(len(cases), 0)
        for case in cases:
            got = plugin.invoke(case["tool"], case["args"])
            self.assertEqual(got, case["expect"], case["tool"])


if __name__ == "__main__":
    unittest.main()
