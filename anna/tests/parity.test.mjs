// Checks the JS engine against the Python-generated tests/parity.json.
// Run from anna/: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TOOLS } from "../bundle/engine.js";

const cases = JSON.parse(readFileSync(new URL("./parity.json", import.meta.url), "utf8"));

function run(c) {
  try {
    return { success: true, data: TOOLS[c.tool](c.args) };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

cases.forEach((c, i) => {
  test(`parity ${i} ${c.tool}`, () => {
    assert.deepEqual(run(c), c.expect);
  });
});

test("rejects bad input", () => {
  assert.equal(run({ tool: "plan_targets", args: {} }).success, false);
});
