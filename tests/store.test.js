"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  STORAGE_KEY,
  VERSION,
  emptyState,
  validate,
  createStore
} = require("../js/store.js");

function memoryStorage(initial) {
  const data = Object.assign({}, initial || {});
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
    _data: data
  };
}

function quotaStorage() {
  return {
    getItem() {
      return null;
    },
    setItem() {
      const err = new Error("The quota has been exceeded.");
      err.name = "QuotaExceededError";
      err.code = 22;
      throw err;
    },
    removeItem() {}
  };
}

function validJob(overrides) {
  return Object.assign(
    {
      status: "idle",
      startedAt: null,
      completedAt: null,
      checklist: [false, false, false, false],
      notes: "",
      metrics: { applications: 0 }
    },
    overrides || {}
  );
}

function validDayJobs() {
  return {
    scan: validJob({ metrics: { applications: 3 } }),
    followup: validJob({
      metrics: { followUps: 1, connections: 2 }
    }),
    proof: validJob({ metrics: { whatImproved: "README" } }),
    practice: validJob({ metrics: { topic: "DNS", minutes: 25 } }),
    sweep: validJob({
      checklist: [false, false, false],
      metrics: { applications: 1 }
    }),
    close: validJob({
      checklist: [false, false, false, false, false],
      metrics: {}
    })
  };
}

function validReport(overrides) {
  return Object.assign(
    {
      id: "2026-09-13:scan",
      date: "2026-09-13",
      jobId: "scan",
      title: "Fresh Job Scan + Applications",
      checklistSummary: { checked: 2, total: 4 },
      notes: "Applied to two roles",
      metrics: { applications: 2 },
      startedAt: "2026-09-13T12:00:00.000Z",
      completedAt: "2026-09-13T13:00:00.000Z",
      createdAt: "2026-09-13T13:00:00.000Z",
      updatedAt: "2026-09-13T13:00:00.000Z"
    },
    overrides || {}
  );
}

function validState(overrides) {
  return Object.assign(
    {
      version: VERSION,
      days: {
        "2026-09-13": { jobs: validDayJobs() }
      },
      reports: [validReport()]
    },
    overrides || {}
  );
}

describe("emptyState", () => {
  test("returns version 1 with empty days and reports", () => {
    const state = emptyState();
    assert.equal(state.version, 1);
    assert.deepEqual(state.days, {});
    assert.deepEqual(state.reports, []);
  });
});

describe("validate", () => {
  test("accepts empty valid state", () => {
    const result = validate(emptyState());
    assert.equal(result.ok, true);
  });

  test("accepts a fully populated state", () => {
    const result = validate(validState());
    assert.equal(result.ok, true);
  });

  test("rejects null, arrays, and non-objects", () => {
    assert.equal(validate(null).ok, false);
    assert.equal(validate([]).ok, false);
    assert.equal(validate("nope").ok, false);
  });

  test("rejects wrong version", () => {
    assert.equal(validate(validState({ version: 2 })).ok, false);
    assert.equal(validate(validState({ version: "1" })).ok, false);
  });

  test("rejects missing days or reports", () => {
    assert.equal(validate({ version: 1, reports: [] }).ok, false);
    assert.equal(validate({ version: 1, days: {} }).ok, false);
  });

  test("rejects unknown job ids and invalid status", () => {
    const state = validState();
    state.days["2026-09-13"].jobs.mystery = validJob();
    assert.equal(validate(state).ok, false);

    const badStatus = validState();
    badStatus.days["2026-09-13"].jobs.scan.status = "paused";
    assert.equal(validate(badStatus).ok, false);
  });

  test("rejects two running jobs on the same day", () => {
    const state = validState();
    state.days["2026-09-13"].jobs.scan.status = "running";
    state.days["2026-09-13"].jobs.sweep.status = "running";
    assert.equal(validate(state).ok, false);
  });

  test("rejects malformed reports", () => {
    const missingId = validState({ reports: [validReport({ id: "" })] });
    assert.equal(validate(missingId).ok, false);

    const badJob = validState({ reports: [validReport({ jobId: "nope" })] });
    assert.equal(validate(badJob).ok, false);

    const badSummary = validState({
      reports: [validReport({ checklistSummary: { checked: 1 } })]
    });
    assert.equal(validate(badSummary).ok, false);
  });
});

describe("createStore", () => {
  test("load of missing key returns empty state without warning", () => {
    const warnings = [];
    const store = createStore(memoryStorage(), {
      onWarning: (msg) => warnings.push(msg)
    });
    const state = store.load();
    assert.deepEqual(state, emptyState());
    assert.equal(warnings.length, 0);
  });

  test("load of corrupt JSON returns empty state and warns", () => {
    const warnings = [];
    const storage = memoryStorage({ [STORAGE_KEY]: "{not-json" });
    const store = createStore(storage, {
      onWarning: (msg) => warnings.push(msg)
    });
    const state = store.load();
    assert.deepEqual(state, emptyState());
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /unreadable|corrupt|invalid/i);
  });

  test("load of invalid shape returns empty state and warns", () => {
    const warnings = [];
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, days: [] })
    });
    const store = createStore(storage, {
      onWarning: (msg) => warnings.push(msg)
    });
    assert.deepEqual(store.load(), emptyState());
    assert.equal(warnings.length, 1);
  });

  test("save then load round-trips a valid state", () => {
    const storage = memoryStorage();
    const store = createStore(storage);
    const original = validState();
    const saved = store.save(original);
    assert.equal(saved.ok, true);
    const loaded = store.load();
    assert.deepEqual(loaded, original);
    assert.ok(storage._data[STORAGE_KEY]);
  });

  test("exportState returns pretty JSON of current memory", () => {
    const store = createStore(memoryStorage());
    const original = validState();
    store.save(original);
    const exported = store.exportState();
    assert.deepEqual(JSON.parse(exported), original);
    assert.match(exported, /\n/);
  });

  test("importState accepts valid JSON and replaces memory", () => {
    const store = createStore(memoryStorage());
    store.save(emptyState());
    const incoming = validState();
    const result = store.importState(JSON.stringify(incoming));
    assert.equal(result.ok, true);
    assert.deepEqual(store.getState(), incoming);
    assert.deepEqual(store.load(), incoming);
  });

  test("importState rejects invalid JSON without wiping current state", () => {
    const storage = memoryStorage();
    const store = createStore(storage);
    const current = validState();
    store.save(current);
    const result = store.importState("{bad");
    assert.equal(result.ok, false);
    assert.deepEqual(store.getState(), current);
    assert.deepEqual(JSON.parse(storage._data[STORAGE_KEY]), current);
  });

  test("importState rejects invalid shape without wiping", () => {
    const store = createStore(memoryStorage());
    const current = validState();
    store.save(current);
    const result = store.importState(JSON.stringify({ version: 1, days: {} }));
    assert.equal(result.ok, false);
    assert.deepEqual(store.getState(), current);
  });

  test("quota errors toast and keep in-memory state", () => {
    const quotaMessages = [];
    const store = createStore(quotaStorage(), {
      onQuotaError: (msg) => quotaMessages.push(msg)
    });
    const next = validState();
    const result = store.save(next);
    assert.equal(result.ok, false);
    assert.equal(result.quota, true);
    assert.equal(quotaMessages.length, 1);
    assert.deepEqual(store.getState(), next);
  });

  test("uses the injected Storage-like object, not a global", () => {
    const storage = memoryStorage();
    const store = createStore(storage);
    store.save(validState());
    assert.ok(Object.prototype.hasOwnProperty.call(storage._data, STORAGE_KEY));
  });
});
