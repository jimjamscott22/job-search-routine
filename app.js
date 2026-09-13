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

  function render(options) {
    options = options || {};
    if (!options.skipCards) {
      for (var i = 0; i < jobsApi.JOB_IDS.length; i += 1) {
        renderCard(jobsApi.JOB_IDS[i]);
      }
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
    if (event.target.matches('[data-metric][type="text"]')) {
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

  render();
})();
