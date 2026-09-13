(function () {
  "use strict";

  var storeApi = window.JobSearchStore;
  var jobsApi = window.JobSearchJobs;
  var toastEl = document.getElementById("toast");
  var parkDialog = document.getElementById("park-dialog");
  var parkMessage = document.getElementById("park-message");
  var toastTimer = null;
  var pendingStart = null;

  function showToast(message, kind) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.className = "toast" + (kind === "warn" ? " warn" : "");
    toastEl.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.hidden = true;
    }, 4500);
  }

  var store = storeApi.createStore(window.localStorage, {
    onWarning: function (message) {
      showToast(message, "warn");
    },
    onQuotaError: function (message) {
      showToast(message, "warn");
    }
  });

  var today = jobsApi.localDateKey();
  var state = store.load();
  state = jobsApi.ensureDay(state, today);
  store.save(state);
  var historyOpen = false;

  function persist(next, options) {
    state = next;
    store.save(state);
    render(options || {});
  }

  function statusLabel(status) {
    if (status === "running") return "Running";
    if (status === "done") return "Done";
    return "Idle";
  }

  function renderCard(jobId) {
    var card = document.querySelector('[data-job-id="' + jobId + '"]');
    if (!card) return;
    var job = jobsApi.getJob(state, today, jobId);
    if (!job) return;
    var pill = card.querySelector(".status-pill");
    if (pill) {
      pill.setAttribute("data-status", job.status);
      pill.textContent = statusLabel(job.status);
    }
    var locked = job.status === "done";
    var checks = card.querySelectorAll("[data-check]");
    for (var i = 0; i < checks.length; i += 1) {
      var index = Number(checks[i].getAttribute("data-check"));
      checks[i].checked = !!job.checklist[index];
      checks[i].disabled = locked;
    }
    var notes = card.querySelector("[data-notes]");
    if (notes && document.activeElement !== notes) {
      notes.value = job.notes || "";
    }
    if (notes) notes.disabled = locked;
    var metrics = card.querySelectorAll("[data-metric]");
    for (var m = 0; m < metrics.length; m += 1) {
      var key = metrics[m].getAttribute("data-metric");
      if (document.activeElement !== metrics[m]) {
        var value = job.metrics && job.metrics[key];
        metrics[m].value = value == null ? "" : value;
      }
      metrics[m].disabled = locked;
    }
    var startBtn = card.querySelector('[data-action="start"]');
    var completeBtn = card.querySelector('[data-action="complete"]');
    var reopenBtn = card.querySelector('[data-action="reopen"]');
    if (startBtn) startBtn.hidden = job.status !== "idle";
    if (completeBtn) completeBtn.hidden = job.status !== "running";
    if (reopenBtn) reopenBtn.hidden = job.status !== "done";
  }

  function formatTime(iso) {
    if (!iso) return "";
    var date = new Date(iso);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function formatTimeRange(startedAt, completedAt) {
    var start = formatTime(startedAt);
    var end = formatTime(completedAt);
    if (start && end) return start + " – " + end;
    return end || start || "";
  }

  function formatMetrics(jobId, metrics) {
    var def = jobsApi.JOB_DEFS[jobId];
    if (!def || !def.metricFields.length) return "";
    var parts = [];
    for (var i = 0; i < def.metricFields.length; i += 1) {
      var field = def.metricFields[i];
      var value = metrics && metrics[field.key];
      if (value == null || value === "") parts.push(field.label + ": —");
      else parts.push(field.label + ": " + value);
    }
    return parts.join(" · ");
  }

  function sortReportsNewest(a, b) {
    var aTime = Date.parse(a.updatedAt || a.completedAt || "") || 0;
    var bTime = Date.parse(b.updatedAt || b.completedAt || "") || 0;
    return bTime - aTime;
  }

  function buildReportCard(report) {
    var article = document.createElement("article");
    article.className = "report-card";
    var title = document.createElement("h3");
    title.textContent = report.title;
    article.appendChild(title);
    var meta = document.createElement("p");
    meta.className = "report-meta";
    var summary = report.checklistSummary || { checked: 0, total: 0 };
    var range = formatTimeRange(report.startedAt, report.completedAt);
    var bits = [];
    if (range) bits.push(range);
    bits.push(summary.checked + "/" + summary.total + " checklist");
    meta.textContent = bits.join(" · ");
    article.appendChild(meta);
    if (report.notes) {
      var notes = document.createElement("p");
      notes.className = "report-notes";
      notes.textContent = report.notes;
      article.appendChild(notes);
    }
    var metricText = formatMetrics(report.jobId, report.metrics);
    if (metricText) {
      var metricsLine = document.createElement("p");
      metricsLine.className = "report-metrics";
      metricsLine.textContent = metricText;
      article.appendChild(metricsLine);
    }
    return article;
  }

  function renderReports() {
    var todayList = document.getElementById("today-reports");
    var todayEmpty = document.getElementById("today-empty");
    var historyToggle = document.getElementById("history-toggle");
    var historyBlock = document.getElementById("history-block");
    var historyReports = document.getElementById("history-reports");
    if (!todayList) return;

    var reports = state.reports || [];
    var todayItems = reports.filter(function (report) {
      return report.date === today;
    }).sort(sortReportsNewest);
    var prior = reports.filter(function (report) {
      return report.date !== today;
    });

    todayList.textContent = "";
    for (var i = 0; i < todayItems.length; i += 1) {
      todayList.appendChild(buildReportCard(todayItems[i]));
    }
    if (todayEmpty) todayEmpty.hidden = todayItems.length > 0;

    if (historyToggle) historyToggle.hidden = prior.length === 0;
    if (!prior.length) {
      if (historyBlock) historyBlock.hidden = true;
      if (historyReports) historyReports.textContent = "";
      return;
    }
    if (historyToggle) {
      historyToggle.textContent = historyOpen ? "Hide history" : "Show history";
    }
    if (historyBlock) historyBlock.hidden = !historyOpen;
    if (!historyReports) return;
    historyReports.textContent = "";
    if (!historyOpen) return;

    var grouped = {};
    for (var p = 0; p < prior.length; p += 1) {
      var dateKey = prior[p].date;
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(prior[p]);
    }
    var dateKeys = Object.keys(grouped).sort().reverse();
    for (var d = 0; d < dateKeys.length; d += 1) {
      var heading = document.createElement("div");
      heading.className = "history-date";
      heading.textContent = dateKeys[d];
      historyReports.appendChild(heading);
      var group = grouped[dateKeys[d]].sort(sortReportsNewest);
      for (var r = 0; r < group.length; r += 1) {
        historyReports.appendChild(buildReportCard(group[r]));
      }
    }
  }

  function render(options) {
    options = options || {};
    if (!options.skipCards) {
      for (var i = 0; i < jobsApi.JOB_IDS.length; i += 1) {
        renderCard(jobsApi.JOB_IDS[i]);
      }
    }
    renderReports();
    renderAppsToday();
    renderCloseRollup();
  }

  function renderAppsToday() {
    var el = document.getElementById("apps-today");
    if (el) el.textContent = String(jobsApi.applicationsToday(state, today));
  }

  function renderCloseRollup() {
    var list = document.querySelector("[data-rollup-list]");
    if (!list) return;
    var rollup = jobsApi.closeRollup(state, today);
    list.textContent = "";
    for (var i = 0; i < rollup.items.length; i += 1) {
      var item = rollup.items[i];
      var li = document.createElement("li");
      var name = document.createElement("span");
      name.textContent = item.title;
      var mark = document.createElement("span");
      mark.className = item.done ? "is-done" : "is-pending";
      mark.textContent = item.done ? "Done" : "Not yet";
      li.appendChild(name);
      li.appendChild(mark);
      list.appendChild(li);
    }
  }

  function hideParkDialog() {
    pendingStart = null;
    if (parkDialog) parkDialog.hidden = true;
  }

  function showParkDialog(conflictId, nextId, action) {
    var conflictTitle = jobsApi.JOB_DEFS[conflictId].title;
    var nextTitle = jobsApi.JOB_DEFS[nextId].title;
    parkMessage.textContent =
      '"' +
      conflictTitle +
      '" is still running. Park it (keep checks, notes, and metrics) and ' +
      (action === "reopen" ? "reopen" : "start") +
      ' "' +
      nextTitle +
      '"?';
    parkDialog.hidden = false;
  }

  function requestExclusive(jobId, action) {
    var now = new Date();
    var result =
      action === "reopen"
        ? jobsApi.reopenJob(state, today, jobId, now)
        : jobsApi.startJob(state, today, jobId, now);
    if (result.ok) {
      persist(result.state);
      return;
    }
    if (result.conflict) {
      pendingStart = { jobId: jobId, action: action, conflict: result.conflict };
      showParkDialog(result.conflict, jobId, action);
      return;
    }
    if (result.error === "done") {
      showToast("Reopen this job before starting it again.", "warn");
    }
  }

  function confirmParkAndContinue() {
    if (!pendingStart) return;
    var jobId = pendingStart.jobId;
    var action = pendingStart.action;
    var conflict = pendingStart.conflict;
    hideParkDialog();
    var next = jobsApi.parkJob(state, today, conflict);
    var result =
      action === "reopen"
        ? jobsApi.reopenJob(next, today, jobId, new Date())
        : jobsApi.startJob(next, today, jobId, new Date());
    if (result.ok) persist(result.state);
  }

  function onCardClick(event) {
    var card = event.target.closest("[data-job-id]");
    if (!card) return;
    var jobId = card.getAttribute("data-job-id");
    var actionBtn = event.target.closest("[data-action]");
    if (!actionBtn) return;
    var action = actionBtn.getAttribute("data-action");
    if (action === "start") requestExclusive(jobId, "start");
    if (action === "reopen") requestExclusive(jobId, "reopen");
    if (action === "complete") {
      var result = jobsApi.completeJob(state, today, jobId, new Date());
      if (result.ok) persist(result.state);
      else showToast("Start the job before completing it.", "warn");
    }
  }

  function onCardChange(event) {
    var card = event.target.closest("[data-job-id]");
    if (!card) return;
    var jobId = card.getAttribute("data-job-id");
    if (event.target.matches("[data-check]")) {
      var index = Number(event.target.getAttribute("data-check"));
      persist(jobsApi.setChecklistItem(state, today, jobId, index, event.target.checked));
    }
    if (event.target.matches("[data-metric]")) {
      persist(
        jobsApi.setMetric(
          state,
          today,
          jobId,
          event.target.getAttribute("data-metric"),
          event.target.value
        ),
        { skipCards: document.activeElement === event.target }
      );
    }
  }

  function onCardInput(event) {
    var card = event.target.closest("[data-job-id]");
    if (!card) return;
    var jobId = card.getAttribute("data-job-id");
    if (event.target.matches("[data-notes]")) {
      persist(jobsApi.setNotes(state, today, jobId, event.target.value), {
        skipCards: true
      });
    }
    if (event.target.matches("[data-metric]")) {
      persist(
        jobsApi.setMetric(
          state,
          today,
          jobId,
          event.target.getAttribute("data-metric"),
          event.target.value
        ),
        { skipCards: true }
      );
    }
  }

  var grid = document.getElementById("job-grid");
  if (grid) {
    grid.addEventListener("click", onCardClick);
    grid.addEventListener("change", onCardChange);
    grid.addEventListener("input", onCardInput);
  }

  var parkCancel = document.getElementById("park-cancel");
  var parkConfirm = document.getElementById("park-confirm");
  if (parkCancel) parkCancel.addEventListener("click", hideParkDialog);
  if (parkConfirm) parkConfirm.addEventListener("click", confirmParkAndContinue);
  if (parkDialog) {
    parkDialog.addEventListener("click", function (event) {
      if (event.target === parkDialog) hideParkDialog();
    });
  }

  var historyToggle = document.getElementById("history-toggle");
  if (historyToggle) {
    historyToggle.addEventListener("click", function () {
      historyOpen = !historyOpen;
      renderReports();
    });
  }

  function exportJson() {
    var blob = new Blob([store.exportState()], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "job-search-routine-" + today + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 0);
  }

  var exportBtn = document.getElementById("export-json");
  var importBtn = document.getElementById("import-json");
  var importFile = document.getElementById("import-file");
  if (exportBtn) exportBtn.addEventListener("click", exportJson);
  if (importBtn && importFile) {
    importBtn.addEventListener("click", function () {
      importFile.click();
    });
    importFile.addEventListener("change", function () {
      var file = importFile.files && importFile.files[0];
      importFile.value = "";
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var result = store.importState(String(reader.result || ""));
        if (!result.ok) {
          showToast(result.error || "Invalid import file.", "warn");
          return;
        }
        state = jobsApi.ensureDay(result.state, today);
        store.save(state);
        render();
        showToast("Imported routine data.");
      };
      reader.readAsText(file);
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && parkDialog && !parkDialog.hidden) {
      hideParkDialog();
    }
  });

  window.addEventListener("storage", function (event) {
    if (event.key !== storeApi.STORAGE_KEY) return;
    state = store.load();
    state = jobsApi.ensureDay(state, today);
    render();
  });

  function syncCalendarDay() {
    var nextDate = jobsApi.localDateKey();
    if (nextDate === today) return false;
    today = nextDate;
    state = jobsApi.ensureDay(state, today);
    store.save(state);
    return true;
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && syncCalendarDay()) render();
  });
  window.addEventListener("focus", function () {
    if (syncCalendarDay()) render();
  });

  render();
})();
