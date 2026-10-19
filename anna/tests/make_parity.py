"""Regenerate tests/parity.json from the Python Executa (the source of truth)."""

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import test_plugin as t  # noqa: E402

cases = [{"tool": "plan_targets", "args": a} for a in t.PLAN_CASES]
cases += [{"tool": "weekly_review", "args": a} for a in t.review_cases()]
for c in cases:
    c["expect"] = t.plugin.invoke(c["tool"], c["args"])
(HERE / "parity.json").write_text(json.dumps(cases, indent=2) + "\n", "utf-8")
print(f"wrote {len(cases)} cases")
