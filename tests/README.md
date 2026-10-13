# Local browser checks

From the repository root, install the declared test dependency and browser once:

```sh
npm ci
npx playwright install chromium
```

Run `npm test` for the full suite or `npm run test:ui` for the browser checks. The browser test starts a read-only static server on a free `127.0.0.1` port and closes it afterward. POST requests return HTTP 405, so the local enquiry endpoint is never invoked. No separately running preview is needed.

The test uses the bundled Playwright Chromium browser. Set `PLAYWRIGHT_BROWSERS_PATH` if your environment requires a custom browser cache location. Set `UI_EVIDENCE` to a writable JSON path to retain individual layout-shift entries.
