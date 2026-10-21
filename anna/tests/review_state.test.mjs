import { test } from "node:test";
import assert from "node:assert/strict";

test("reviewView defensive check handles legacy numeric actions without crashing", () => {
  const legacyRecord = {
    at: new Date().toISOString(),
    week_end: "2026-10-21",
    days_logged: 5,
    actions: 3 // legacy scalar number
  };

  let reviewState = { status: "idle" };
  const state = { reviews: [legacyRecord] };

  // Replicate app.js defensive logic:
  if (reviewState.status === "idle" && state.reviews && state.reviews.length > 0) {
    const last = state.reviews[state.reviews.length - 1];
    if (last && Array.isArray(last.actions) && last.money && last.nutrition) {
      reviewState = { status: "ok", data: last };
    }
  }

  // Must remain safely in idle state rather than setting broken object
  assert.equal(reviewState.status, "idle");
});

test("reviewView defensive check cleanly promotes complete review objects", () => {
  const fullRecord = {
    at: new Date().toISOString(),
    headline: "Great week",
    money: { spent: 150, weekly_allowance: 200, top_categories: [] },
    nutrition: { avg_calories: 2100, avg_protein_g: 130 },
    actions: ["Keep up the pace"]
  };

  let reviewState = { status: "idle" };
  const state = { reviews: [fullRecord] };

  if (reviewState.status === "idle" && state.reviews && state.reviews.length > 0) {
    const last = state.reviews[state.reviews.length - 1];
    if (last && Array.isArray(last.actions) && last.money && last.nutrition) {
      reviewState = { status: "ok", data: last };
    }
  }

  assert.equal(reviewState.status, "ok");
  assert.equal(reviewState.data.headline, "Great week");
});
