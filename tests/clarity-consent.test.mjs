import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(
  new URL("../clarity-assets/clarity-consent.js", import.meta.url),
  "utf8",
);
const config = {
  projectId: "testabc123",
  hostname: "www.roofmaintenancesydney.com.au",
  storageKey: "mel-one.clarity-consent.v1",
};
function harness(overrides = {}) {
  const documentEvents = new Map(),
    windowEvents = new Map(),
    scripts = [],
    calls = [],
    cookieWrites = [];
  let saved = overrides.saved || null,
    reloads = 0,
    bodyMasked = false;
  const button = (choice) => ({
    dataset: { clarityChoice: choice },
    disabled: false,
    events: {},
    addEventListener(type, handler) {
      this.events[type] = handler;
    },
    focus() {},
  });
  const deny = button("denied"),
    allow = button("granted");
  const notice = { hidden: true };
  const panel = {
    hidden: true,
    addEventListener() {},
    querySelector(selector) {
      return selector.includes("granted")
        ? allow
        : selector.includes("privacy-signal")
          ? notice
          : deny;
    },
    querySelectorAll() {
      return [deny, allow];
    },
  };
  const preference = {
    addEventListener(type, handler) {
      this.handler = handler;
    },
    focus() {},
  };
  const input = {
    type: "text",
    value: overrides.value || "",
    setAttribute() {},
    getAttribute(name) {
      return name === "data-clarity-public-default"
        ? overrides.publicDefault || null
        : null;
    },
    matches() {
      return true;
    },
    closest(selector) {
      return selector.includes("form") ? this : null;
    },
  };
  const document = {
    referrer: overrides.referrer || "",
    activeElement: overrides.focused ? input : null,
    documentElement: { lang: "en-AU" },
    body: {
      setAttribute(name, value) {
        if (name === "data-clarity-mask" && value === "true") bodyMasked = true;
      },
    },
    getElementById(id) {
      return id === "clarity-consent"
        ? panel
        : id === "clarity-config"
          ? { textContent: JSON.stringify({ ...config, ...overrides.config }) }
          : null;
    },
    querySelector(selector) {
      return selector === 'link[rel="canonical"]'
        ? Object.prototype.hasOwnProperty.call(overrides,"canonical")
          ? overrides.canonical ? {href:overrides.canonical} : null
          : { href: `https://${config.hostname}/services/roof-cleaning` }
        : null;
    },
    querySelectorAll(selector) {
      return selector === "[data-clarity-preferences]"
        ? [preference]
        : selector.includes("input") && overrides.value
          ? [input]
          : [];
    },
    createElement() {
      return { remove() {}, setAttribute() {} };
    },
    head: {
      append(script) {
        script.bodyMaskedBeforeLoad = bodyMasked;
        scripts.push(script);
      },
    },
    addEventListener(type, handler, options) {
      documentEvents.set(type, { handler, options });
    },
    removeEventListener() {},
  };
  Object.defineProperty(document, "cookie", {
    get() {
      return "_clck=one; auth_session=keep; _ga=keep";
    },
    set(value) {
      cookieWrites.push(value);
    },
  });
  const location = {
    hostname: overrides.hostname || config.hostname,
    pathname: overrides.pathname || "/services/roof-cleaning",
    search: overrides.search || "",
    hash: overrides.hash || "",
    href: `https://${config.hostname}/services/roof-cleaning`,
    reload() {
      reloads++;
    },
  };
  const runtime = {
    addEventListener(type, handler) {
      windowEvents.set(type, handler);
    },
    clarity: undefined,
  };
  const localStorage = {
    getItem() {
      return saved;
    },
    setItem(key, value) {
      saved = value;
    },
  };
  class Element {}
  Object.setPrototypeOf(input, Element.prototype);
  class MutationObserver {
    constructor(handler) {
      this.handler = handler;
    }
    observe() {}
    disconnect() {}
  }
  vm.runInNewContext(source, {
    window: runtime,
    document,
    navigator: {
      doNotTrack: overrides.dnt || "",
      globalPrivacyControl: overrides.gpc || false,
    },
    location,
    localStorage,
    URL,
    Date,
    Element,
    MutationObserver,
    console,
  });
  const captureClarity = () => {
    const original = runtime.clarity;
    runtime.clarity = (...args) => {
      calls.push(args);
      original?.(...args);
    };
  };
  return {
    scripts,
    calls,
    cookieWrites,
    documentEvents,
    windowEvents,
    allow,
    deny,
    input,
    panel,
    preference,
    location,
    runtime,
    captureClarity,
    saved: () => saved,
    reloads: () => reloads,
  };
}
const grant = (projectId) =>
  JSON.stringify({
    version: 1,
    choice: "granted",
    projectId,
    updatedAt: new Date().toISOString(),
  });
test("default off; only explicit Clarity choice starts one collector", () => {
  const h = harness();
  assert.equal(h.scripts.length, 0);
  assert.equal(h.panel.hidden, false);
  h.allow.events.click();
  h.allow.events.click();
  assert.equal(h.scripts.length, 1);
  assert.equal(h.scripts[0].src, "https://www.clarity.ms/tag/testabc123");
  assert.equal(JSON.parse(h.saved()).choice, "granted");
});
test("privacy signals, wrong hosts and stale provider grants cannot start", () => {
  for (const overrides of [
    { gpc: true },
    { dnt: "1" },
    { hostname: "localhost" },
    { hostname: "preview.vercel.app" },
    { saved: grant("another-id") },
  ]) {
    const h = harness(overrides);
    if (!overrides.saved) h.allow.events.click();
    assert.equal(h.scripts.length, 0);
  }
});
test("contact, thank-you, staff, query/hash and unsafe referrer views are excluded", () => {
  for (const overrides of [
    { pathname: "/zh/contact/" },
    { pathname: "/thank-you" },
    { pathname: "/project-brief/" },
    { pathname: "/staff/leads" },
    { search: "?email=private" },
    { hash: "#customer" },
    { referrer: "https://example.com/?name=private" },
    { referrer: "not-a-url" },
  ]) {
    const h = harness({ saved: grant(config.projectId), ...overrides });
    assert.equal(h.scripts.length, 0);
  }
});
test("existing customer values or focused form controls block loading", () => {
  for (const overrides of [{ value: "private customer" }, { focused: true }]) {
    const h = harness({ saved: grant(config.projectId), ...overrides });
    assert.equal(h.scripts.length, 0);
  }
});
test("sensitive interaction synchronously stops before app handlers, without reload or clearing values", () => {
  for (const type of [
    "pointerdown",
    "focusin",
    "keydown",
    "beforeinput",
    "change",
    "submit",
  ]) {
    const h = harness({ saved: grant(config.projectId) });
    h.captureClarity();
    const listener = h.documentEvents.get(type);
    assert.equal(listener.options.capture, true);
    listener.handler({ target: h.input });
    assert.equal(h.calls[0][0], "stop");
    assert.equal(h.reloads(), 0);
    h.input.value = "customer text after capture";
    h.allow.events.click();
    assert.equal(h.scripts.length, 1);
    assert.equal(h.input.value, "customer text after capture");
  }
});
test("withdrawal stops recording, deletes only Clarity cookies and reloads once", () => {
  const h = harness({ saved: grant(config.projectId) });
  h.captureClarity();
  h.deny.events.click();
  h.deny.events.click();
  assert.ok(h.calls.some((call) => call[0] === "stop"));
  assert.equal(h.reloads(), 1);
  assert.ok(h.cookieWrites.every((value) => /^_cl(?:ck|sk)=/.test(value)));
  assert.ok(h.cookieWrites.every((value) => !value.includes("Domain=.com.au")));
});
test("other-tab denial, removal or malformed consent stops and reloads without storage loops", () => {
  for (const newValue of [
    null,
    "malformed",
    JSON.stringify({
      version: 1,
      choice: "denied",
      updatedAt: new Date().toISOString(),
    }),
  ]) {
    const h = harness({ saved: grant(config.projectId) });
    h.captureClarity();
    const before = h.saved();
    h.windowEvents.get("storage")({ key: config.storageKey, newValue });
    assert.equal(h.calls[0][0], "stop");
    assert.equal(h.reloads(), 1);
    assert.equal(h.saved(), before);
  }
});
test("internal navigation stops before a client route can expose a sensitive view", () => {
  const h = harness({ saved: grant(config.projectId) });
  h.captureClarity();
  class Link {}
  const target = new Link();
  Object.setPrototypeOf(target, Object.getPrototypeOf(h.input));
  target.closest = (selector) =>
    selector === "a[href]" ? { getAttribute: () => "/contact" } : null;
  h.documentEvents.get("click").handler({ target });
  assert.equal(h.calls[0][0], "stop");
  assert.equal(h.reloads(), 0);
});
test("a masked public suburb default permits reading; changed customer values do not", () => {
  const publicValue = harness({
    saved: grant(config.projectId),
    value: "Parramatta",
    publicDefault: "Parramatta",
  });
  assert.equal(publicValue.scripts.length, 1);
  const changed = harness({
    saved: grant(config.projectId),
    value: "customer address",
    publicDefault: "Parramatta",
  });
  assert.equal(changed.scripts.length, 0);
});
test("form stop keeps the enquiry intact, then cross-tab withdrawal still clears cookies and reloads once", () => {
  const h = harness({ saved: grant(config.projectId) });
  h.captureClarity();
  h.documentEvents.get("focusin").handler({ target: h.input });
  assert.equal(h.reloads(), 0);
  h.windowEvents.get("storage")({ key: config.storageKey, newValue: null });
  assert.equal(h.reloads(), 1);
  assert.ok(h.cookieWrites.length > 0);
});
test("a visitor who initially refuses can later opt in through preferences on the same untouched view", () => {
  const h = harness();
  h.deny.events.click();
  assert.equal(h.reloads(), 0);
  assert.equal(h.scripts.length, 0);
  h.preference.handler();
  assert.equal(h.panel.hidden, false);
  h.allow.events.click();
  assert.equal(h.scripts.length, 1);
});

test("explicit whole-body masking is applied before the Clarity tag even when account Strict settings are pending", () => {
  const h = harness({ saved: grant(config.projectId) });
  assert.equal(h.scripts[0].bodyMaskedBeforeLoad, true);
});

test("portfolio tags contain only configured public hostname and an allowlisted site kind",()=>{
 const h=harness({saved:grant(config.projectId),config:{siteKind:"internal"}});
 assert.ok(h.runtime.clarity.q.some(args=>args[0]==="set"&&args[1]==="site_host"&&args[2]===config.hostname));
 assert.ok(h.runtime.clarity.q.some(args=>args[0]==="set"&&args[1]==="site_kind"&&args[2]==="internal"));
 const unsafe=harness({saved:grant(config.projectId),config:{siteKind:"private customer value"}});
 assert.ok(unsafe.runtime.clarity.q.some(args=>args[0]==="set"&&args[1]==="site_kind"&&args[2]==="business"));
 assert.ok(!JSON.stringify(unsafe.runtime.clarity.q).includes("private customer value"));
});
test("business views require a canonical even if the internal-tool flag is set",()=>{
 for (const extra of [{}, {allowMissingCanonical:true}, {allowMissingCanonical:true,siteKind:"business"}]) {
  const h=harness({saved:grant(config.projectId),canonical:null,config:extra});
  assert.equal(h.scripts.length,0);
 }
});
test("a verified internal tool may explicitly lack a canonical without allowing preview hosts",()=>{
 const h=harness({saved:grant(config.projectId),canonical:null,config:{allowMissingCanonical:true,siteKind:"internal"}});
 assert.equal(h.scripts.length,1);
 const preview=harness({saved:grant(config.projectId),canonical:null,hostname:"localhost",config:{allowMissingCanonical:true,siteKind:"internal"}});
 assert.equal(preview.scripts.length,0);
});
test("a hosted migration copy accepts only its explicitly configured canonical hostname",()=>{
 const primary="www.original-business.com.au";
 const accepted=harness({saved:grant(config.projectId),canonical:"https://"+primary+"/",config:{canonicalHostnames:[primary]}});
 assert.equal(accepted.scripts.length,1);
 const unexpected=harness({saved:grant(config.projectId),canonical:"https://unexpected.example/",config:{canonicalHostnames:[primary]}});
 assert.equal(unexpected.scripts.length,0);
});
test("site-specific consultation paths are excluded before loading the shared project",()=>{
 const h=harness({saved:grant(config.projectId),pathname:"/zh/consultation/",config:{excludedPaths:["/zh/consultation"]}});
 assert.equal(h.scripts.length,0);
 const reading=harness({saved:grant(config.projectId),pathname:"/services/roof-cleaning",config:{excludedPaths:["/zh/consultation"]}});
 assert.equal(reading.scripts.length,1);
});
