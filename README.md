# Daily Job Search Routine

A self-contained local web app that turns the daily job-search routine into runnable checklist jobs with on-page status reports.

No backend, no accounts, no build step, and no frameworks.

## Open the app

Open `index.html` in a browser. `file://` works; you do not need a local server.

```bash
# macOS
open index.html

# Linux
xdg-open index.html
```

## Tests

```bash
npm test
```

Runs Node’s built-in test runner (`node --test`). There are no runtime dependencies.

## Storage

All data lives in browser `localStorage` under a single key:

`jobSearchRoutine.v1`

Export and import JSON (footer actions) will be wired in a later slice.
