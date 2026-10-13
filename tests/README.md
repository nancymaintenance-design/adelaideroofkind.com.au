# Local validation

Run all commands from the repository root. Install the declared JavaScript dependency and bundled Chromium browser once:

```sh
npm ci
npx playwright install chromium
```

Run the 49 JavaScript tests serially across test files:

```sh
npm test
```

Run only the UI and responsive-image browser files, also serially:

```sh
npm run test:ui
```

The browser tests start read-only static servers on free `127.0.0.1` ports and close them afterward. POST requests return HTTP 405, so the local enquiry endpoint is never invoked. No separately running preview is needed.

The responsive-image generator regression and decoded-image verification are separate Python checks. They require Python 3 with Pillow installed in that Python environment:

```sh
python tests/image-generator.test.py -v
python tools/verify-responsive-images.py
```

The verifier checks responsive images across all local HTML pages. These commands operate on local files and local loopback servers only; none sends an enquiry.

The JavaScript browser tests use the bundled Playwright Chromium browser. Set `PLAYWRIGHT_BROWSERS_PATH` if your environment requires a custom browser cache location. Set `UI_EVIDENCE` to a writable JSON path to retain individual layout-shift entries.
