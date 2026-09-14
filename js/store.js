(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.JobSearchStore = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var STORAGE_KEY = "jobSearchRoutine.v1";
  var VERSION = 1;
  var JOB_IDS = {
    scan: true,
    followup: true,
    proof: true,
    practice: true,
    sweep: true,
    close: true
  };
  var STATUSES = { idle: true, running: true, done: true };
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function emptyState() {
    return { version: VERSION, days: {}, reports: [] };
  }

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function fail(error) {
    return { ok: false, error: error };
  }

  function isTimestamp(value) {
    return value === null || typeof value === "string";
  }

  function isQuotaError(err) {
    if (!err) return false;
    return (
      err.name === "QuotaExceededError" ||
      err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      err.code === 22 ||
      err.code === 1014
    );
  }

  function cloneState(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function validateJob(job, jobId) {
    if (!isPlainObject(job)) return "Job " + jobId + " must be an object";
    if (!STATUSES[job.status]) return "Job " + jobId + " has invalid status";
    if (!isTimestamp(job.startedAt)) return "Job " + jobId + " startedAt is invalid";
    if (!isTimestamp(job.completedAt)) return "Job " + jobId + " completedAt is invalid";
    if (!Array.isArray(job.checklist)) return "Job " + jobId + " checklist must be an array";
    for (var i = 0; i < job.checklist.length; i += 1) {
      if (typeof job.checklist[i] !== "boolean") {
        return "Job " + jobId + " checklist must be booleans";
      }
    }
    if (typeof job.notes !== "string") return "Job " + jobId + " notes must be a string";
    if (!isPlainObject(job.metrics)) return "Job " + jobId + " metrics must be an object";
    var metricKeys = Object.keys(job.metrics);
    for (var m = 0; m < metricKeys.length; m += 1) {
      var metricVal = job.metrics[metricKeys[m]];
      if (typeof metricVal !== "number" && typeof metricVal !== "string") {
        return "Job " + jobId + " metrics must be numbers or strings";
      }
      if (typeof metricVal === "number" && !isFinite(metricVal)) {
        return "Job " + jobId + " metrics must be finite numbers";
      }
    }
    return null;
  }

  function validateReport(report, index) {
    var label = "Report " + index;
    if (!isPlainObject(report)) return label + " must be an object";
    if (typeof report.id !== "string" || !report.id) return label + " id is required";
    if (typeof report.date !== "string" || !DATE_RE.test(report.date)) {
      return label + " date is invalid";
    }
    if (!JOB_IDS[report.jobId]) return label + " jobId is invalid";
    if (typeof report.title !== "string") return label + " title is required";
    if (!isPlainObject(report.checklistSummary)) {
      return label + " checklistSummary is required";
    }
    if (typeof report.checklistSummary.checked !== "number") {
      return label + " checklistSummary.checked is required";
    }
    if (typeof report.checklistSummary.total !== "number") {
      return label + " checklistSummary.total is required";
    }
    if (typeof report.notes !== "string") return label + " notes must be a string";
    if (!isPlainObject(report.metrics)) return label + " metrics must be an object";
    if (!isTimestamp(report.startedAt)) return label + " startedAt is invalid";
    if (!isTimestamp(report.completedAt)) return label + " completedAt is invalid";
    if (typeof report.createdAt !== "string") return label + " createdAt is required";
    if (typeof report.updatedAt !== "string") return label + " updatedAt is required";
    return null;
  }

  function validate(value) {
    if (!isPlainObject(value)) return fail("State must be an object");
    if (value.version !== VERSION) return fail("Unsupported version");
    if (!isPlainObject(value.days)) return fail("days must be an object");
    if (!Array.isArray(value.reports)) return fail("reports must be an array");

    var dates = Object.keys(value.days);
    for (var d = 0; d < dates.length; d += 1) {
      var dateKey = dates[d];
      if (!DATE_RE.test(dateKey)) return fail("Invalid date key: " + dateKey);
      var day = value.days[dateKey];
      if (!isPlainObject(day) || !isPlainObject(day.jobs)) {
        return fail("Day " + dateKey + " must have a jobs object");
      }
      var runningCount = 0;
      var jobIds = Object.keys(day.jobs);
      for (var j = 0; j < jobIds.length; j += 1) {
        var jobId = jobIds[j];
        if (!JOB_IDS[jobId]) return fail("Unknown job id: " + jobId);
        var jobError = validateJob(day.jobs[jobId], jobId);
        if (jobError) return fail(jobError);
        if (day.jobs[jobId].status === "running") runningCount += 1;
      }
      if (runningCount > 1) {
        return fail("At most one job can be running on " + dateKey);
      }
    }

    for (var r = 0; r < value.reports.length; r += 1) {
      var reportError = validateReport(value.reports[r], r);
      if (reportError) return fail(reportError);
    }

    return { ok: true, state: value };
  }

  function createStore(storage, hooks) {
    var memory = emptyState();
    hooks = hooks || {};

    function warn(message) {
      if (typeof hooks.onWarning === "function") hooks.onWarning(message);
    }

    function quota(message) {
      if (typeof hooks.onQuotaError === "function") hooks.onQuotaError(message);
    }

    function load() {
      if (!storage || typeof storage.getItem !== "function") {
        memory = emptyState();
        warn("Storage is unavailable. Starting with an empty routine.");
        return cloneState(memory);
      }
      var raw;
      try {
        raw = storage.getItem(STORAGE_KEY);
      } catch (err) {
        memory = emptyState();
        warn("Storage could not be read. Starting with an empty routine.");
        return cloneState(memory);
      }
      if (raw == null || raw === "") {
        memory = emptyState();
        return cloneState(memory);
      }
      try {
        var parsed = JSON.parse(raw);
        var result = validate(parsed);
        if (!result.ok) {
          memory = emptyState();
          warn("Saved data was corrupt or invalid. Starting with an empty routine.");
          return cloneState(memory);
        }
        memory = cloneState(result.state);
        return cloneState(memory);
      } catch (err) {
        memory = emptyState();
        warn("Saved data was unreadable. Starting with an empty routine.");
        return cloneState(memory);
      }
    }

    function save(state) {
      var result = validate(state);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      memory = cloneState(state);
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(memory));
        return { ok: true };
      } catch (err) {
        if (isQuotaError(err)) {
          quota("Could not save: browser storage is full. Changes are kept in this tab only.");
          return { ok: false, quota: true, error: err.message };
        }
        warn("Could not save routine data.");
        return { ok: false, error: err.message };
      }
    }

    function exportState() {
      return JSON.stringify(memory, null, 2);
    }

    function importState(jsonText) {
      var parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch (err) {
        return { ok: false, error: "Invalid import file." };
      }
      var result = validate(parsed);
      if (!result.ok) {
        return { ok: false, error: "Invalid import file." };
      }
      var next = cloneState(result.state);
      var saved = save(next);
      if (!saved.ok && !saved.quota) {
        return { ok: false, error: saved.error || "Could not save imported data." };
      }
      return { ok: true, state: cloneState(memory), saved: saved.ok };
    }

    function getState() {
      return cloneState(memory);
    }

    return {
      load: load,
      save: save,
      exportState: exportState,
      importState: importState,
      getState: getState
    };
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    VERSION: VERSION,
    emptyState: emptyState,
    validate: validate,
    createStore: createStore,
    cloneState: cloneState
  };
});
