# Daily Job Search Routine

A self-contained local web app that turns a weekday job-search routine into six runnable checklist jobs with on-page status reports.

No backend, no accounts, no frameworks, and no bundler. Open the file and go.

## Open the app

Open `index.html` in a browser. `file://` must work; you do not need a local server.

```bash
# macOS
open index.html

# Linux
xdg-open index.html
```

Classic script tags load `js/store.js`, `js/jobs.js`, and `app.js`. There is no build step.

## Daily jobs

Each local calendar day, the six cards start **Idle**. Start a job to move it to **Running**, then Complete to post a report and mark it **Done**. Reopen a Done job to edit, then Complete again.

At most one job can be Running at a time. Starting another asks whether to park the current job (back to Idle, keeping checks, notes, and metrics) or cancel.

There is no Save button. Checklist ticks, notes, and metrics autosave on every change.

Job IDs:

- `scan` — Fresh Job Scan + Applications (applications)
- `followup` — Follow-Up + Networking (followUps, connections)
- `proof` — Build Visible Proof (whatImproved)
- `practice` — Interview + Certification Practice (topic, minutes)
- `sweep` — Second Job Sweep (applications)
- `close` — Close the Loop (rollup of whether jobs 1–5 are Done)

**Applications today** in Weekly Targets is `scan.applications + sweep.applications`.

A new local date starts with empty job cards. Completed reports from earlier dates stay under **History**.

## Storage

Everything lives in browser `localStorage` under one key:

`jobSearchRoutine.v1`

Shape:

```json
{
  "version": 1,
  "days": {
    "YYYY-MM-DD": {
      "jobs": {
        "scan": {
          "status": "idle",
          "startedAt": null,
          "completedAt": null,
          "checklist": [false, false, false, false],
          "notes": "",
          "metrics": { "applications": 0 }
        }
      }
    }
  },
  "reports": [
    {
      "id": "YYYY-MM-DD:scan",
      "date": "YYYY-MM-DD",
      "jobId": "scan",
      "title": "Fresh Job Scan + Applications",
      "checklistSummary": { "checked": 0, "total": 4 },
      "notes": "",
      "metrics": { "applications": 0 },
      "startedAt": null,
      "completedAt": null,
      "createdAt": "",
      "updatedAt": ""
    }
  ]
}
```

Date keys use the local `YYYY-MM-DD` calendar day. Report ids are `${date}:${jobId}` so completing the same job on the same day updates the existing report.

- Corrupt stored JSON → empty valid state and a warning toast
- Invalid import file → rejected; current data is not wiped
- Storage quota errors → warning toast; in-memory state is kept

## Export / import

Use **Export JSON** and **Import JSON** in the footer. Import replaces the stored routine when the file is valid.

Multi-tab tip: last write wins. Export a backup if you keep the app open in more than one tab.

## Tests

```bash
npm test
```

Runs Node’s built-in test runner (`node --test tests/*.test.js`). There are no runtime dependencies. `js/store.js` and `js/jobs.js` dual-export so they work as browser globals and as CommonJS modules.
