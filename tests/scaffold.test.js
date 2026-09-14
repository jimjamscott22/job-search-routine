"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

test("store stub dual-exports", () => {
  const store = require("../js/store.js");
  assert.equal(store.STORAGE_KEY, "jobSearchRoutine.v1");
  assert.equal(store.emptyState().version, 1);
});

test("jobs stub dual-exports", () => {
  const jobs = require("../js/jobs.js");
  assert.deepEqual(jobs.JOB_IDS, [
    "scan",
    "followup",
    "proof",
    "practice",
    "sweep",
    "close"
  ]);
});
