"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const jobs = require("../js/jobs.js");

const DATE = "2026-09-13";
const NEXT_DATE = "2026-09-14";
const T1 = "2026-09-13T14:00:00.000Z";
const T2 = "2026-09-13T15:10:00.000Z";
const T3 = "2026-09-13T16:40:00.000Z";

function fresh() {
  return { version: 1, days: {}, reports: [] };
}

function dayJobs(state, date) {
  return state.days[date].jobs;
}

describe("localDateKey", () => {
  test("formats a local calendar date as YYYY-MM-DD", () => {
    assert.equal(jobs.localDateKey(new Date(2026, 8, 13, 22, 15, 0)), "2026-09-13");
  });
});

describe("ensureDay", () => {
  test("creates six idle jobs with the right checklist lengths", () => {
    const state = jobs.ensureDay(fresh(), DATE);
    const ids = jobs.JOB_IDS;
    assert.deepEqual(Object.keys(dayJobs(state, DATE)).sort(), ids.slice().sort());
    assert.equal(dayJobs(state, DATE).scan.checklist.length, 4);
    assert.equal(dayJobs(state, DATE).followup.checklist.length, 4);
    assert.equal(dayJobs(state, DATE).proof.checklist.length, 4);
    assert.equal(dayJobs(state, DATE).practice.checklist.length, 4);
    assert.equal(dayJobs(state, DATE).sweep.checklist.length, 3);
    assert.equal(dayJobs(state, DATE).close.checklist.length, 5);
    ids.forEach((id) => {
      assert.equal(dayJobs(state, DATE)[id].status, "idle");
      assert.equal(dayJobs(state, DATE)[id].notes, "");
    });
    assert.deepEqual(dayJobs(state, DATE).scan.metrics, { applications: 0 });
    assert.deepEqual(dayJobs(state, DATE).followup.metrics, {
      followUps: 0,
      connections: 0
    });
    assert.deepEqual(dayJobs(state, DATE).proof.metrics, { whatImproved: "" });
    assert.deepEqual(dayJobs(state, DATE).practice.metrics, { topic: "", minutes: 0 });
    assert.deepEqual(dayJobs(state, DATE).sweep.metrics, { applications: 0 });
    assert.deepEqual(dayJobs(state, DATE).close.metrics, {});
  });

  test("does not copy job progress onto a new local date", () => {
    let state = jobs.ensureDay(fresh(), DATE);
    state = jobs.setChecklistItem(state, DATE, "scan", 0, true);
    state = jobs.ensureDay(state, NEXT_DATE);
    assert.equal(dayJobs(state, DATE).scan.checklist[0], true);
    assert.equal(dayJobs(state, NEXT_DATE).scan.checklist[0], false);
    assert.equal(dayJobs(state, NEXT_DATE).scan.status, "idle");
  });
});

describe("start, park, exclusive running", () => {
  test("startJob moves idle to running and stamps startedAt", () => {
    const started = jobs.startJob(jobs.ensureDay(fresh(), DATE), DATE, "scan", T1);
    assert.equal(started.ok, true);
    assert.equal(dayJobs(started.state, DATE).scan.status, "running");
    assert.equal(dayJobs(started.state, DATE).scan.startedAt, T1);
  });

  test("starting another job while one is running reports a conflict", () => {
    const running = jobs.startJob(jobs.ensureDay(fresh(), DATE), DATE, "scan", T1);
    const blocked = jobs.startJob(running.state, DATE, "followup", T2);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.conflict, "scan");
    assert.equal(dayJobs(blocked.state, DATE).followup.status, "idle");
    assert.equal(dayJobs(blocked.state, DATE).scan.status, "running");
  });

  test("parkJob returns a running job to idle and keeps in-progress data", () => {
    let state = jobs.ensureDay(fresh(), DATE);
    state = jobs.startJob(state, DATE, "scan", T1).state;
    state = jobs.setChecklistItem(state, DATE, "scan", 1, true);
    state = jobs.setNotes(state, DATE, "scan", "two roles queued");
    state = jobs.setMetric(state, DATE, "scan", "applications", 2);
    state = jobs.parkJob(state, DATE, "scan");
    const scan = dayJobs(state, DATE).scan;
    assert.equal(scan.status, "idle");
    assert.equal(scan.startedAt, T1);
    assert.equal(scan.checklist[1], true);
    assert.equal(scan.notes, "two roles queued");
    assert.equal(scan.metrics.applications, 2);
  });

  test("park then start another job leaves only one running", () => {
    let state = jobs.startJob(jobs.ensureDay(fresh(), DATE), DATE, "scan", T1).state;
    state = jobs.parkJob(state, DATE, "scan");
    const started = jobs.startJob(state, DATE, "proof", T2);
    assert.equal(started.ok, true);
    assert.equal(jobs.findRunningJob(started.state, DATE), "proof");
  });
});

describe("completeJob report upsert", () => {
  test("completing upserts a report and allows zero checks", () => {
    let state = jobs.startJob(jobs.ensureDay(fresh(), DATE), DATE, "scan", T1).state;
    const done = jobs.completeJob(state, DATE, "scan", T2);
    assert.equal(done.ok, true);
    const scan = dayJobs(done.state, DATE).scan;
    assert.equal(scan.status, "done");
    assert.equal(scan.completedAt, T2);
    assert.equal(done.state.reports.length, 1);
    const report = done.state.reports[0];
    assert.equal(report.id, "2026-09-13:scan");
    assert.equal(report.date, DATE);
    assert.equal(report.jobId, "scan");
    assert.equal(report.title, "Fresh Job Scan + Applications");
    assert.deepEqual(report.checklistSummary, { checked: 0, total: 4 });
    assert.equal(report.startedAt, T1);
    assert.equal(report.completedAt, T2);
    assert.equal(report.createdAt, T2);
    assert.equal(report.updatedAt, T2);
  });

  test("completing the same date+jobId updates instead of duplicating", () => {
    let state = jobs.startJob(jobs.ensureDay(fresh(), DATE), DATE, "scan", T1).state;
    state = jobs.completeJob(state, DATE, "scan", T2).state;
    state = jobs.reopenJob(state, DATE, "scan", T2).state;
    state = jobs.setChecklistItem(state, DATE, "scan", 0, true);
    state = jobs.setNotes(state, DATE, "scan", "tailored one resume");
    state = jobs.setMetric(state, DATE, "scan", "applications", 4);
    state = jobs.completeJob(state, DATE, "scan", T3).state;
    assert.equal(state.reports.length, 1);
    const report = state.reports[0];
    assert.equal(report.id, "2026-09-13:scan");
    assert.deepEqual(report.checklistSummary, { checked: 1, total: 4 });
    assert.equal(report.notes, "tailored one resume");
    assert.equal(report.metrics.applications, 4);
    assert.equal(report.createdAt, T2);
    assert.equal(report.updatedAt, T3);
    assert.equal(report.completedAt, T3);
  });

  test("completeJob from idle is rejected", () => {
    const result = jobs.completeJob(jobs.ensureDay(fresh(), DATE), DATE, "scan", T1);
    assert.equal(result.ok, false);
    assert.equal(dayJobs(result.state, DATE).scan.status, "idle");
    assert.equal(result.state.reports.length, 0);
  });
});

describe("reopenJob", () => {
  test("moves a done job back to running so it can be completed again", () => {
    let state = jobs.startJob(jobs.ensureDay(fresh(), DATE), DATE, "scan", T1).state;
    state = jobs.completeJob(state, DATE, "scan", T2).state;
    const reopened = jobs.reopenJob(state, DATE, "scan", T3);
    assert.equal(reopened.ok, true);
    assert.equal(dayJobs(reopened.state, DATE).scan.status, "running");
    assert.equal(dayJobs(reopened.state, DATE).scan.completedAt, null);
  });

  test("reopen conflicts when another job is already running", () => {
    let state = jobs.startJob(jobs.ensureDay(fresh(), DATE), DATE, "scan", T1).state;
    state = jobs.completeJob(state, DATE, "scan", T2).state;
    state = jobs.startJob(state, DATE, "followup", T3).state;
    const reopened = jobs.reopenJob(state, DATE, "scan", T3);
    assert.equal(reopened.ok, false);
    assert.equal(reopened.conflict, "followup");
    assert.equal(dayJobs(reopened.state, DATE).scan.status, "done");
  });
});

describe("metrics and rollup", () => {
  test("applicationsToday sums scan and sweep", () => {
    let state = jobs.ensureDay(fresh(), DATE);
    state = jobs.setMetric(state, DATE, "scan", "applications", 3);
    state = jobs.setMetric(state, DATE, "sweep", "applications", 2);
    assert.equal(jobs.applicationsToday(state, DATE), 5);
  });

  test("closeRollup reports whether jobs 1-5 are done", () => {
    let state = jobs.ensureDay(fresh(), DATE);
    let rollup = jobs.closeRollup(state, DATE);
    assert.equal(rollup.allDone, false);
    assert.equal(rollup.doneCount, 0);
    assert.equal(rollup.items.length, 5);

    ["scan", "followup", "proof", "practice", "sweep"].forEach((id, index) => {
      const t = "2026-09-13T1" + index + ":00:00.000Z";
      state = jobs.startJob(state, DATE, id, t).state;
      state = jobs.completeJob(state, DATE, id, t).state;
    });
    rollup = jobs.closeRollup(state, DATE);
    assert.equal(rollup.allDone, true);
    assert.equal(rollup.doneCount, 5);
    assert.ok(rollup.items.every((item) => item.done));
  });

  test("old reports remain when a new day is created", () => {
    let state = jobs.startJob(jobs.ensureDay(fresh(), DATE), DATE, "scan", T1).state;
    state = jobs.completeJob(state, DATE, "scan", T2).state;
    state = jobs.ensureDay(state, NEXT_DATE);
    assert.equal(state.reports.length, 1);
    assert.equal(state.reports[0].date, DATE);
    assert.equal(dayJobs(state, NEXT_DATE).scan.status, "idle");
  });

  test("completed state is valid for the storage layer", () => {
    const { validate } = require("../js/store.js");
    let state = jobs.startJob(jobs.ensureDay(fresh(), DATE), DATE, "scan", T1).state;
    state = jobs.setMetric(state, DATE, "scan", "applications", 3);
    state = jobs.completeJob(state, DATE, "scan", T2).state;
    assert.equal(validate(state).ok, true);
  });
});
