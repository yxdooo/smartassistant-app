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
        # BMR 10*70+6.25*170-5*30-161 = 1451.5; x1.375 = 1995.8; -500 = 1495.8
        self.assertEqual(r["bmr"], 1452)
        self.assertEqual(r["calories"], 1500)
        self.assertEqual(r["protein_g"], 140)
        self.assertEqual(r["water_ml"], 2450)
        # (1500-600-200)/22 days left in March from the 10th
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
        # (2000-800)*7/31 = 270.97 allowance; 235 is 13% under
        self.assertEqual(r["money"]["status"], "under")
        self.assertEqual(r["money"]["top_categories"][0]["category"], "Eating out")
        self.assertEqual(r["nutrition"]["avg_calories"], 2333)
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
        self.assertIn("2 more days", r["message"])

    def test_old_rows_ignored(self):
        r = plugin.weekly_review(week_args(week_end="2026-04-30"))
        self.assertEqual(r["status"], "insufficient_data")

    def test_bad_row(self):
        res = plugin.invoke("weekly_review", {"profile": PROFILE, "expenses": [{"date": "nope", "amount": 1}]})
        self.assertFalse(res["success"])
        self.assertIn("expenses[0].date", res["error"])


class Protocol(unittest.TestCase):
    def test_unknown_tool(self):
        self.assertFalse(plugin.invoke("nope", {})["success"])

    def test_describe_lists_tools(self):
        names = [t["name"] for t in plugin._handle({"method": "describe"})["tools"]]
        self.assertEqual(names, ["ping", "plan_targets", "weekly_review"])

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
