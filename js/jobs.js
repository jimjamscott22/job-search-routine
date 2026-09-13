(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.JobSearchJobs = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var JOB_IDS = ["scan", "followup", "proof", "practice", "sweep", "close"];

  function localDateKey(date) {
    var d = date ? new Date(date) : new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function ensureDay(state) {
    return state;
  }

  return {
    JOB_IDS: JOB_IDS,
    localDateKey: localDateKey,
    ensureDay: ensureDay
  };
});
