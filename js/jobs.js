(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.JobSearchJobs = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var JOB_IDS = ["scan", "followup", "proof", "practice", "sweep", "close"];
  var CLOSE_PREREQ_IDS = ["scan", "followup", "proof", "practice", "sweep"];

  var JOB_DEFS = {
    scan: {
      id: "scan",
      title: "Fresh Job Scan + Applications",
      heading: "1. Fresh Job Scan + Applications",
      time: "Morning · 60–90 min",
      checklistLength: 4,
      bullets: [
        "Search newly posted IT roles first.",
        "Target Help Desk, Desktop Support, IT Support Specialist, Computer Specialist, Junior Sysadmin, NOC Analyst, Network Technician, and Technical Support.",
        "Apply when you match roughly 60%+ of the requirements.",
        "Tailor keywords only when it clearly improves the match."
      ],
      metricFields: [
        { key: "applications", type: "number", label: "Applications" }
      ]
    },
    followup: {
      id: "followup",
      title: "Follow-Up + Networking",
      heading: "2. Follow-Up + Networking",
      time: "Late Morning · 30–45 min",
      checklistLength: 4,
      bullets: [
        "Check Indeed, email, and LinkedIn messages.",
        "Follow up on strong applications from the previous week.",
        "Connect with local IT staff, recruiters, MSP employees, and hiring managers.",
        "Keep outreach short, professional, and specific."
      ],
      metricFields: [
        { key: "followUps", type: "number", label: "Follow-ups" },
        { key: "connections", type: "number", label: "Connections" }
      ]
    },
    proof: {
      id: "proof",
      title: "Build Visible Proof",
      heading: "3. Build Visible Proof",
      time: "Early Afternoon · 1–2 hrs",
      checklistLength: 4,
      bullets: [
        "Improve one GitHub project or README.",
        "Add screenshots, network diagrams, or project documentation.",
        "Update jamielab.me with one concrete improvement.",
        "Document a real troubleshooting, Linux, networking, Docker, backup, or security task."
      ],
      metricFields: [
        { key: "whatImproved", type: "text", label: "What improved" }
      ]
    },
    practice: {
      id: "practice",
      title: "Interview + Certification Practice",
      heading: "4. Interview + Certification Practice",
      time: "Mid-Afternoon · ~60 min",
      checklistLength: 4,
      bullets: [
        "Study one practical IT topic.",
        "Practice troubleshooting questions out loud.",
        "Use home-lab stories as interview examples.",
        "Keep certification study supportive, not dominant."
      ],
      metricFields: [
        { key: "topic", type: "text", label: "Topic" },
        { key: "minutes", type: "number", label: "Minutes" }
      ]
    },
    sweep: {
      id: "sweep",
      title: "Second Job Sweep",
      heading: "5. Second Job Sweep",
      time: "Late Afternoon · 30–60 min",
      checklistLength: 3,
      bullets: [
        "Check for newly posted roles from later in the day.",
        "Submit any high-fit applications you missed earlier.",
        "Update your application tracker before stopping."
      ],
      metricFields: [
        { key: "applications", type: "number", label: "Applications" }
      ]
    },
    close: {
      id: "close",
      title: "Close the Loop",
      heading: "6. Close the Loop",
      time: "End of Day · 10 min",
      checklistLength: 5,
      bullets: [
        "Applications logged",
        "Follow-ups scheduled",
        "One portfolio/project improvement completed",
        "One interview topic practiced",
        "Tomorrow's first task identified"
      ],
      metricFields: []
    }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function localDateKey(date) {
    var d = date instanceof Date ? date : date ? new Date(date) : new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function toIso(now) {
    if (typeof now === "string") return now;
    if (now instanceof Date) return now.toISOString();
    return new Date().toISOString();
  }

  function defaultMetrics(jobId) {
    var fields = JOB_DEFS[jobId].metricFields;
    var metrics = {};
    for (var i = 0; i < fields.length; i += 1) {
      metrics[fields[i].key] = fields[i].type === "number" ? 0 : "";
    }
    return metrics;
  }

  function emptyJob(jobId) {
    var def = JOB_DEFS[jobId];
    var checklist = [];
    for (var i = 0; i < def.checklistLength; i += 1) checklist.push(false);
    return {
      status: "idle",
      startedAt: null,
      completedAt: null,
      checklist: checklist,
      notes: "",
      metrics: defaultMetrics(jobId)
    };
  }

  function normalizeChecklist(job, jobId) {
    var length = JOB_DEFS[jobId].checklistLength;
    var next = [];
    for (var i = 0; i < length; i += 1) {
      next.push(job.checklist && job.checklist[i] === true);
    }
    job.checklist = next;
  }

  function normalizeMetrics(job, jobId) {
    var defaults = defaultMetrics(jobId);
    var current = job.metrics && typeof job.metrics === "object" ? job.metrics : {};
    var keys = Object.keys(defaults);
    var metrics = {};
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (Object.prototype.hasOwnProperty.call(current, key)) {
        metrics[key] = current[key];
      } else {
        metrics[key] = defaults[key];
      }
    }
    job.metrics = metrics;
  }

  function ensureDay(state, dateKey) {
    var next = clone(state);
    if (!next.days || typeof next.days !== "object") next.days = {};
    if (!Array.isArray(next.reports)) next.reports = [];
    if (!next.days[dateKey] || typeof next.days[dateKey] !== "object") {
      next.days[dateKey] = { jobs: {} };
    }
    if (!next.days[dateKey].jobs || typeof next.days[dateKey].jobs !== "object") {
      next.days[dateKey].jobs = {};
    }
    var jobsMap = next.days[dateKey].jobs;
    for (var i = 0; i < JOB_IDS.length; i += 1) {
      var jobId = JOB_IDS[i];
      if (!jobsMap[jobId] || typeof jobsMap[jobId] !== "object") {
        jobsMap[jobId] = emptyJob(jobId);
      } else {
        normalizeChecklist(jobsMap[jobId], jobId);
        normalizeMetrics(jobsMap[jobId], jobId);
        if (typeof jobsMap[jobId].notes !== "string") jobsMap[jobId].notes = "";
        if (!jobsMap[jobId].status) jobsMap[jobId].status = "idle";
      }
    }
    return next;
  }

  function getJob(state, dateKey, jobId) {
    var day = state.days && state.days[dateKey];
    if (!day || !day.jobs) return null;
    return day.jobs[jobId] || null;
  }

  function findRunningJob(state, dateKey) {
    var day = state.days && state.days[dateKey];
    if (!day || !day.jobs) return null;
    for (var i = 0; i < JOB_IDS.length; i += 1) {
      var job = day.jobs[JOB_IDS[i]];
      if (job && job.status === "running") return JOB_IDS[i];
    }
    return null;
  }

  function unknownJob(state, jobId) {
    return {
      ok: false,
      error: "unknown-job",
      state: state
    };
  }

  function startJob(state, dateKey, jobId, now) {
    if (!JOB_DEFS[jobId]) return unknownJob(state, jobId);
    var next = ensureDay(state, dateKey);
    var job = next.days[dateKey].jobs[jobId];
    if (job.status === "running") {
      return { ok: true, state: next };
    }
    if (job.status === "done") {
      return { ok: false, error: "done", state: next };
    }
    var running = findRunningJob(next, dateKey);
    if (running && running !== jobId) {
      return { ok: false, conflict: running, state: next };
    }
    job.status = "running";
    if (!job.startedAt) job.startedAt = toIso(now);
    return { ok: true, state: next };
  }

  function parkJob(state, dateKey, jobId) {
    var next = ensureDay(state, dateKey);
    if (!JOB_DEFS[jobId]) return next;
    var job = next.days[dateKey].jobs[jobId];
    if (job.status === "running") {
      job.status = "idle";
    }
    return next;
  }

  function checklistSummary(job) {
    var checked = 0;
    for (var i = 0; i < job.checklist.length; i += 1) {
      if (job.checklist[i]) checked += 1;
    }
    return { checked: checked, total: job.checklist.length };
  }

  function upsertReport(state, dateKey, jobId, job, nowIso) {
    var id = dateKey + ":" + jobId;
    var existing = null;
    var existingIndex = -1;
    for (var i = 0; i < state.reports.length; i += 1) {
      if (state.reports[i].id === id) {
        existing = state.reports[i];
        existingIndex = i;
        break;
      }
    }
    var report = {
      id: id,
      date: dateKey,
      jobId: jobId,
      title: JOB_DEFS[jobId].title,
      checklistSummary: checklistSummary(job),
      notes: job.notes,
      metrics: clone(job.metrics),
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: existing ? existing.createdAt : nowIso,
      updatedAt: nowIso
    };
    if (existingIndex >= 0) {
      state.reports[existingIndex] = report;
    } else {
      state.reports.push(report);
    }
  }

  function completeJob(state, dateKey, jobId, now) {
    if (!JOB_DEFS[jobId]) return unknownJob(state, jobId);
    var next = ensureDay(state, dateKey);
    var job = next.days[dateKey].jobs[jobId];
    if (job.status !== "running") {
      return { ok: false, error: "not-running", state: next };
    }
    var nowIso = toIso(now);
    job.status = "done";
    job.completedAt = nowIso;
    if (!job.startedAt) job.startedAt = nowIso;
    upsertReport(next, dateKey, jobId, job, nowIso);
    return { ok: true, state: next };
  }

  function reopenJob(state, dateKey, jobId, now) {
    if (!JOB_DEFS[jobId]) return unknownJob(state, jobId);
    var next = ensureDay(state, dateKey);
    var job = next.days[dateKey].jobs[jobId];
    if (job.status !== "done") {
      return { ok: false, error: "not-done", state: next };
    }
    var running = findRunningJob(next, dateKey);
    if (running) {
      return { ok: false, conflict: running, state: next };
    }
    job.status = "running";
    job.completedAt = null;
    if (!job.startedAt) job.startedAt = toIso(now);
    return { ok: true, state: next };
  }

  function setChecklistItem(state, dateKey, jobId, index, checked) {
    var next = ensureDay(state, dateKey);
    if (!JOB_DEFS[jobId]) return next;
    var job = next.days[dateKey].jobs[jobId];
    if (index < 0 || index >= job.checklist.length) return next;
    job.checklist[index] = Boolean(checked);
    return next;
  }

  function setNotes(state, dateKey, jobId, notes) {
    var next = ensureDay(state, dateKey);
    if (!JOB_DEFS[jobId]) return next;
    next.days[dateKey].jobs[jobId].notes = notes == null ? "" : String(notes);
    return next;
  }

  function coerceMetric(field, value) {
    if (field.type === "number") {
      var num = typeof value === "number" ? value : parseFloat(value);
      if (!isFinite(num) || num < 0) return 0;
      return Math.round(num);
    }
    return value == null ? "" : String(value);
  }

  function setMetric(state, dateKey, jobId, key, value) {
    var next = ensureDay(state, dateKey);
    if (!JOB_DEFS[jobId]) return next;
    var fields = JOB_DEFS[jobId].metricFields;
    var field = null;
    for (var i = 0; i < fields.length; i += 1) {
      if (fields[i].key === key) {
        field = fields[i];
        break;
      }
    }
    if (!field) return next;
    next.days[dateKey].jobs[jobId].metrics[key] = coerceMetric(field, value);
    return next;
  }

  function asNumber(value) {
    var num = typeof value === "number" ? value : parseFloat(value);
    return isFinite(num) ? num : 0;
  }

  function applicationsToday(state, dateKey) {
    var scan = getJob(state, dateKey, "scan");
    var sweep = getJob(state, dateKey, "sweep");
    var scanApps = scan && scan.metrics ? asNumber(scan.metrics.applications) : 0;
    var sweepApps = sweep && sweep.metrics ? asNumber(sweep.metrics.applications) : 0;
    return scanApps + sweepApps;
  }

  function closeRollup(state, dateKey) {
    var items = [];
    var doneCount = 0;
    for (var i = 0; i < CLOSE_PREREQ_IDS.length; i += 1) {
      var jobId = CLOSE_PREREQ_IDS[i];
      var job = getJob(state, dateKey, jobId);
      var done = !!(job && job.status === "done");
      if (done) doneCount += 1;
      items.push({
        jobId: jobId,
        title: JOB_DEFS[jobId].title,
        done: done
      });
    }
    return {
      items: items,
      doneCount: doneCount,
      total: CLOSE_PREREQ_IDS.length,
      allDone: doneCount === CLOSE_PREREQ_IDS.length
    };
  }

  return {
    JOB_IDS: JOB_IDS,
    CLOSE_PREREQ_IDS: CLOSE_PREREQ_IDS,
    JOB_DEFS: JOB_DEFS,
    localDateKey: localDateKey,
    emptyJob: emptyJob,
    ensureDay: ensureDay,
    getJob: getJob,
    findRunningJob: findRunningJob,
    startJob: startJob,
    parkJob: parkJob,
    completeJob: completeJob,
    reopenJob: reopenJob,
    setChecklistItem: setChecklistItem,
    setNotes: setNotes,
    setMetric: setMetric,
    applicationsToday: applicationsToday,
    closeRollup: closeRollup
  };
});
