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

  function emptyState() {
    return { version: VERSION, days: {}, reports: [] };
  }

  function createStore(_storage, _hooks) {
    return {
      load: function () {
        return emptyState();
      },
      save: function () {
        return { ok: true };
      },
      exportState: function () {
        return JSON.stringify(emptyState(), null, 2);
      },
      importState: function () {
        return { ok: false, error: "Not implemented" };
      },
      getState: function () {
        return emptyState();
      }
    };
  }

  function validate(_value) {
    return { ok: false, error: "Not implemented" };
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    VERSION: VERSION,
    emptyState: emptyState,
    createStore: createStore,
    validate: validate
  };
});
