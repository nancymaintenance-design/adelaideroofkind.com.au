import { readFile, writeFile, readdir, access, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const managedBlock = /\r?\n?<!-- mel-one-clarity:start -->[\s\S]*?<!-- mel-one-clarity:end -->\r?\n?/g;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const isRedirectDocument = (html) => /<meta\b[^>]*http-equiv\s*=\s*["']refresh["'][^>]*>/i.test(html);

function hostname(value, label) {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(value)) {
    throw new Error(`${label} must be an explicit hostname without a URL, port or credentials`);
  }
  return value;
}

function privacyFile(outputDirectory, route) {
  if (typeof route !== "string" || !/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+(?:\.html|\/)?$/.test(route)) {
    throw new Error("privacyPaths must be safe absolute website paths");
  }
  const relative = route.endsWith(".html") ? route.slice(1) : path.join(route.slice(1), "index.html");
  const target = path.resolve(outputDirectory, relative);
  if (!target.startsWith(path.resolve(outputDirectory) + path.sep)) {
    throw new Error("privacyPaths cannot escape the output directory");
  }
  return target;
}

function publicConfig(input) {
  if (!input || !/^[a-z0-9]{5,20}$/.test(input.projectId || "")) throw new Error("An explicit Clarity projectId is required");
  const host = hostname(input.hostname, "hostname");
  const kind = input.siteKind || "business";
  if (!["business", "internal", "migration"].includes(kind)) throw new Error("siteKind must be business, internal or migration");
  const config = { projectId: input.projectId, hostname: host, siteKind: kind, storageKey: input.storageKey || "mel-one.clarity-consent.v1" };
  if (Array.isArray(input.cookieDomains)) config.cookieDomains = input.cookieDomains.map((value) => hostname(value, "cookieDomains"));
  if (Array.isArray(input.canonicalHostnames)) config.canonicalHostnames = input.canonicalHostnames.map((value) => hostname(value, "canonicalHostnames"));
  if (Array.isArray(input.excludedPaths)) {
    if (input.excludedPaths.some((value) => typeof value !== "string" || !value.startsWith("/") || /[?#]/.test(value))) throw new Error("excludedPaths must contain website pathnames");
    config.excludedPaths = input.excludedPaths;
  }
  if (kind === "internal" && input.allowMissingCanonical === true) config.allowMissingCanonical = true;
  if (["carpentry", "renovations", "plumbing", "education"].includes(input.theme)) config.theme = input.theme;
  return config;
}

async function htmlFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(target));
    else if (entry.isFile() && /\.html$/i.test(entry.name)) files.push(target);
  }
  return files.sort();
}

function privacyPage(config, privacyPaths, language) {
  const chinese = language.startsWith("zh");
  const simplified = language === "zh-CN" || language === "zh-Hans";
  const t = (english, traditional, simple = traditional) => chinese ? simplified ? simple : traditional : english;
  const route = chinese ? privacyPaths.zh : privacyPaths.en;
  const title = t("Privacy and Clarity preferences", "私隱與 Clarity 分析偏好", "隐私与 Clarity 分析偏好");
  const intro = t("This page explains optional Microsoft Clarity analytics on this website.", "這一頁說明本站可自行選擇的 Microsoft Clarity 分析。", "这一页说明本站可自行选择的 Microsoft Clarity 分析。");
  const consent = t("Clarity stays off until you allow it. With permission, it records masked reading, scrolling and clicks for heatmaps and session recordings, and may process device, connection and first-party analytics identifiers.", "Clarity 在你允許前保持關閉。同意後，它會記錄遮罩後的閱讀、滾動與點擊，用於熱圖及工作階段錄影，並可能處理裝置、連線及第一方分析識別碼。", "Clarity 在你允许前保持关闭。同意后，它会记录遮罩后的阅读、滚动与点击，用于热图及会话录像，并可能处理设备、连接及第一方分析识别码。");
  const protection = t("Page text is masked. Contact, confirmation and staff pages, and visits containing query strings or fragments, are excluded. Recording stops when you begin using a form or editable field. Form content and unsent drafts are excluded.", "頁面文字會遮罩。聯絡、確認及員工頁，以及網址包含查詢參數或井號的瀏覽不會錄製。開始操作表單或可編輯欄位時即停止錄影，不錄製表單內容與未寄出的草稿。", "页面文字会遮罩。联系、确认及员工页，以及网址包含查询参数或井号的浏览不会录制。开始操作表单或可编辑字段时即停止录像，不录制表单内容与未发送的草稿。");
  const choice = t("Use Clarity preferences at the foot of the page to change your choice. Refusing does not affect browsing or using the website. Browser no-tracking signals keep Clarity off. This preference controls Clarity only.", "你可使用頁面底部的 Clarity 分析偏好更改選擇。拒絕不影響瀏覽或使用網站；瀏覽器的停止追蹤信號會使 Clarity 保持關閉。這個偏好只控制 Clarity。", "你可使用页面底部的 Clarity 分析偏好更改选择。拒绝不影响浏览或使用网站；浏览器的停止跟踪信号会使 Clarity 保持关闭。这个偏好只控制 Clarity。");
  return `<!doctype html>\n<html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(intro)}"><link rel="canonical" href="https://${config.hostname}${route}"><link rel="alternate" hreflang="en-AU" href="https://${config.hostname}${privacyPaths.en}"><link rel="alternate" hreflang="${simplified ? "zh-CN" : "zh-Hant"}" href="https://${config.hostname}${privacyPaths.zh}"></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(intro)}</p><h2>Microsoft Clarity</h2><p>${escapeHtml(consent)}</p><p>${escapeHtml(protection)}</p><p>${escapeHtml(choice)}</p><p><a href="https://privacy.microsoft.com/privacystatement">${t("Microsoft Privacy Statement", "Microsoft 私隱聲明", "Microsoft 隐私声明")}</a></p><p><a href="/">${t("Return to the website", "返回網站", "返回网站")}</a></p></main></body></html>\n`;
}

function injectHtmlDocument(html, config, privacyPaths, assetVersion) {
  const clean = html.replace(managedBlock, "");
  if (/\bid\s*=\s*["'](?:clarity-config|mel-one-clarity-consent)["']/i.test(clean) || /https:\/\/(?:www\.)?clarity\.ms\/tag\//i.test(clean)) {
    throw new Error("Existing unmanaged Clarity configuration: inspect it before installing a second collector");
  }
  const closingBody = [...clean.matchAll(/<\/body\s*>/gi)].at(-1);
  if (!closingBody) throw new Error("HTML output needs a closing body before Clarity can be installed");
  const language = clean.match(/<html\b[^>]*\blang\s*=\s*["']([^"']+)["']/i)?.[1] || "en";
  const runtimeConfig = { ...config, privacyPath: language.toLowerCase().startsWith("zh") ? privacyPaths.zh : privacyPaths.en, stylesheetPath: `/clarity-consent.css?v=${assetVersion.css}` };
  const json = JSON.stringify(runtimeConfig).replace(/</g, "\\u003c");
  const block = `\n<!-- mel-one-clarity:start -->\n<link rel="stylesheet" href="/clarity-consent.css?v=${assetVersion.css}">\n<script id="clarity-config" type="application/json">${json}</script>\n<script id="mel-one-clarity-consent" src="/clarity-consent.js?v=${assetVersion.js}" defer></script>\n<!-- mel-one-clarity:end -->\n`;
  return clean.slice(0, closingBody.index) + block + clean.slice(closingBody.index);
}

export function injectHtml(html, input, assetVersion = { js: "20261015-1", css: "20261015-1" }) {
  const config = publicConfig(input);
  if (!input.privacyPaths?.en || !input.privacyPaths?.zh || input.privacyPaths.en === input.privacyPaths.zh) throw new Error("Distinct privacyPaths.en and privacyPaths.zh are required");
  for (const route of Object.values(input.privacyPaths)) privacyFile(moduleDirectory, route);
  if (isRedirectDocument(html)) return html;
  return injectHtmlDocument(html, config, input.privacyPaths, assetVersion);
}

export async function injectSiteOutput({ outputDirectory = "dist", config: input, runtimeDirectory = path.join(moduleDirectory, "public") } = {}) {
  const output = path.resolve(outputDirectory);
  const config = publicConfig(input);
  const privacyPaths = input.privacyPaths;
  if (!privacyPaths?.en || !privacyPaths?.zh || privacyPaths.en === privacyPaths.zh) throw new Error("Distinct privacyPaths.en and privacyPaths.zh are required");
  const privacyTargets = { en: privacyFile(output, privacyPaths.en), zh: privacyFile(output, privacyPaths.zh) };
  const files = await htmlFiles(output);
  const runtime = {};
  for (const extension of ["js", "css"]) runtime[extension] = await readFile(path.join(runtimeDirectory, `clarity-consent.${extension}`), "utf8");
  const assetVersion = Object.fromEntries(Object.entries(runtime).map(([extension, source]) => [extension, createHash("sha256").update(source).digest("hex").slice(0, 12)]));
  const pending = [];
  const skippedRedirectPages = [];
  for (const filename of files) {
    const html = await readFile(filename, "utf8");
    if (isRedirectDocument(html)) skippedRedirectPages.push(path.relative(output, filename).split(path.sep).join("/"));
    else pending.push({ filename, content: injectHtmlDocument(html, config, privacyPaths, assetVersion) });
  }
  const generatedPrivacyPaths = [];
  for (const [locale, filename] of Object.entries(privacyTargets)) {
    try { await access(filename); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      const language = locale === "en" ? "en-AU" : ["zh-CN", "zh-Hans"].includes(input.zhLanguage) ? input.zhLanguage : "zh-Hant";
      pending.push({ filename, content: injectHtmlDocument(privacyPage(config, privacyPaths, language), config, privacyPaths, assetVersion) });
      generatedPrivacyPaths.push(privacyPaths[locale]);
    }
  }
  // Validate the full plan before any output mutation, including unmanaged collectors.
  for (const extension of ["js", "css"]) await writeFile(path.join(output, `clarity-consent.${extension}`), runtime[extension], "utf8");
  for (const { filename, content } of pending) {
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, content, "utf8");
  }
  return { outputDirectory: output, hostname: config.hostname, siteKind: config.siteKind, htmlPages: pending.length, generatedPrivacyPaths, skippedRedirectPages, assetVersion };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [outputDirectory = "dist", configPath = "clarity-site.json", runtimeDirectory = path.join(moduleDirectory, "public")] = process.argv.slice(2);
    const config = JSON.parse(await readFile(path.resolve(configPath), "utf8"));
    console.log(JSON.stringify(await injectSiteOutput({ outputDirectory, config, runtimeDirectory })));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
