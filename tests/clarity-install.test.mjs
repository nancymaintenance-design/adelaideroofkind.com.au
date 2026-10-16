import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { injectSiteOutput, injectHtml } from "../clarity-install.mjs";

const fixtureRoot = fileURLToPath(new URL("../.cache/clarity-fixture-temp/", import.meta.url));
const runtimeDirectory = fileURLToPath(new URL("../clarity-assets/", import.meta.url));
const config = {
  projectId: "yy15u4fmm6",
  hostname: "business.example.com",
  siteKind: "business",
  privacyPaths: { en: "/en/privacy/", zh: "/privacy/" },
  canonicalHostnames: ["original.example.com"],
  excludedPaths: ["/en/consultation/"],
};
const html = (lang) => `<!doctype html><html lang="${lang}"><head><title>Protected original title</title><meta name="description" content="Original description"><link rel="canonical" href="https://original.example.com/service/"><link rel="alternate" hreflang="en-AU" href="https://original.example.com/service/"><link rel="alternate" hreflang="zh-Hant" href="https://original.example.com/zh/service/"><script type="application/ld+json">{"@type":"Service","name":"Original service"}</script></head><body><header>Original header</header><main id="main"><h1>Protected service H1</h1><p>Original helpful service content.</p><form><input name="suburb" value="private customer address"></form></main><footer>Original footer</footer></body></html>`;
async function fixture(t, initial = html("en-AU")) {
  await mkdir(fixtureRoot, { recursive: true });
  const outputDirectory = await mkdtemp(path.join(fixtureRoot, "site-"));
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));
  await writeFile(path.join(outputDirectory, "index.html"), initial);
  return { outputDirectory, config, runtimeDirectory };
}
const extractConfig = (text) => {
  const match = text.match(/<script id="clarity-config" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(match, "output must include a readable public Clarity configuration");
  return JSON.parse(match[1]);
};
const protectedRegions = (text) => [
  text.match(/<title>[\s\S]*?<\/title>/)[0],
  text.match(/<meta name="description"[^>]*>/)[0],
  ...text.matchAll(/<link rel="(?:canonical|alternate)"[^>]*>/g),
  text.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/)[0],
  text.match(/<main\b[\s\S]*?<\/main>/)[0],
].map((region) => typeof region === "string" ? region : region[0]);

test("injects working local assets and explicit public config while preserving original SEO and main content", async (t) => {
  const setup = await fixture(t);
  await injectSiteOutput(setup);
  const result = await readFile(path.join(setup.outputDirectory, "index.html"), "utf8");
  assert.deepEqual(protectedRegions(result), protectedRegions(html("en-AU")));
  assert.equal(extractConfig(result).projectId, "yy15u4fmm6");
  assert.equal(extractConfig(result).hostname, "business.example.com");
  assert.equal(extractConfig(result).privacyPath, "/en/privacy/");
  assert.ok(result.indexOf('id="clarity-config"') < result.lastIndexOf("</body>"));
  assert.match(result, /src="\/clarity-consent\.js[^\"]*"/);
  assert.match(result, /href="\/clarity-consent\.css[^\"]*"/);
  assert.equal(await readFile(path.join(setup.outputDirectory, "clarity-consent.js"), "utf8"), await readFile(path.join(runtimeDirectory, "clarity-consent.js"), "utf8"));
  assert.equal(await readFile(path.join(setup.outputDirectory, "clarity-consent.css"), "utf8"), await readFile(path.join(runtimeDirectory, "clarity-consent.css"), "utf8"));
  assert.ok(!result.includes("data-clarity-public-default"));
});

test("repeated injection is byte-idempotent and chooses privacy links from each actual page language", async (t) => {
  const setup = await fixture(t, html("zh-Hant"));
  await mkdir(path.join(setup.outputDirectory, "en"));
  await writeFile(path.join(setup.outputDirectory, "en/index.html"), html("en-AU"));
  await injectSiteOutput(setup);
  const first = await readFile(path.join(setup.outputDirectory, "index.html"), "utf8");
  await injectSiteOutput(setup);
  const second = await readFile(path.join(setup.outputDirectory, "index.html"), "utf8");
  assert.equal(second, first);
  assert.equal((second.match(/id="clarity-config"/g) || []).length, 1);
  assert.equal(extractConfig(second).privacyPath, "/privacy/");
  assert.equal(extractConfig(await readFile(path.join(setup.outputDirectory, "en/index.html"), "utf8")).privacyPath, "/en/privacy/");
});

test("creates missing bilingual privacy pages with self canonicals without replacing an existing privacy page", async (t) => {
  const setup = await fixture(t);
  await mkdir(path.join(setup.outputDirectory, "en/privacy"), { recursive: true });
  const existing = html("en-AU").replace("Original helpful service content.", "Existing privacy details must remain.");
  await writeFile(path.join(setup.outputDirectory, "en/privacy/index.html"), existing);
  await injectSiteOutput(setup);
  const preserved = await readFile(path.join(setup.outputDirectory, "en/privacy/index.html"), "utf8");
  assert.deepEqual(protectedRegions(preserved), protectedRegions(existing));
  await assert.doesNotReject(access(path.join(setup.outputDirectory, "privacy/index.html")), "missing Chinese privacy route must be generated");
  const generated = await readFile(path.join(setup.outputDirectory, "privacy/index.html"), "utf8");
  assert.match(generated, /<html lang="zh-Hant"/);
  assert.match(generated, /<link rel="canonical" href="https:\/\/business.example.com\/privacy\/"/);
  assert.match(generated, /Microsoft Clarity/);
  assert.ok(!generated.includes("Google Analytics"));
});

test("internal tools explicitly retain missing-canonical allowance and configured path exclusions", async (t) => {
  const setup = await fixture(t, '<!doctype html><html lang="en"><head><title>Internal report</title></head><body><main><h1>Report</h1></main></body></html>');
  await injectSiteOutput({ ...setup, config: { ...config, siteKind: "internal", allowMissingCanonical: true } });
  const result = extractConfig(await readFile(path.join(setup.outputDirectory, "index.html"), "utf8"));
  assert.equal(result.siteKind, "internal");
  assert.equal(result.allowMissingCanonical, true);
  assert.deepEqual(result.excludedPaths, ["/en/consultation/"]);
});

test("rejects escaping privacy paths before altering any existing file", async (t) => {
  const setup = await fixture(t);
  await assert.rejects(injectSiteOutput({ ...setup, config: { ...config, privacyPaths: { en: "/../../outside/", zh: "/privacy/" } } }), /privacy/i);
  assert.equal(await readFile(path.join(setup.outputDirectory, "index.html"), "utf8"), html("en-AU"));
  await assert.rejects(access(path.join(setup.outputDirectory, "clarity-consent.js")));
});

test("unmanaged existing Clarity configuration blocks duplicate installation", async (t) => {
  const initial = html("en-AU").replace("</body>", '<script id="clarity-config" type="application/json">{"projectId":"other123"}</script></body>');
  const setup = await fixture(t, initial);
  await assert.rejects(injectSiteOutput(setup), /existing|already|unmanaged/i);
  assert.equal(await readFile(path.join(setup.outputDirectory, "index.html"), "utf8"), initial);
});

test("serializes only public runtime fields and escapes script-closing markup", async (t) => {
  const setup = await fixture(t);
  await injectSiteOutput({ ...setup, config: { ...config, privateNote: "should-not-be-public", theme: '</script><script>alert("x")</script>' } });
  const result = await readFile(path.join(setup.outputDirectory, "index.html"), "utf8");
  assert.ok(!result.includes("should-not-be-public"));
  assert.ok(!result.includes('<script>alert("x")</script>'));
  assert.ok(!Object.prototype.hasOwnProperty.call(extractConfig(result), "privateNote"));
});

test("pure HTML injection uses the same safeguards without writing files", () => {
  const result = injectHtml(html("zh-CN"), { ...config, siteKind: "internal", allowMissingCanonical: true, privateNote: "never-serialize" });
  assert.deepEqual(protectedRegions(result), protectedRegions(html("zh-CN")));
  assert.equal(extractConfig(result).privacyPath, "/privacy/");
  assert.equal(extractConfig(result).allowMissingCanonical, true);
  assert.ok(!result.includes("never-serialize"));
  assert.equal(injectHtml(result, config), injectHtml(html("zh-CN"), config));
});

test("transient redirect HTML stays unchanged and is reported without injecting a collector", async (t) => {
  const redirect = '<!doctype html><html><head><meta http-equiv="refresh" content="0;url=/zh/"><title>Redirecting</title></head></html>';
  const setup = await fixture(t, redirect);
  let receipt;
  await assert.doesNotReject(async () => { receipt = await injectSiteOutput(setup); });
  assert.equal(await readFile(path.join(setup.outputDirectory, "index.html"), "utf8"), redirect);
  assert.deepEqual(receipt.skippedRedirectPages, ["index.html"]);
});
