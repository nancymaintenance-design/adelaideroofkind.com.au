(function () {
  "use strict";
  const node = document.getElementById("clarity-config");
  if (!node || window.melOneClarityInstalled) return;
  let config;
  try {
    config = JSON.parse(node.textContent || "{}");
  } catch {
    return;
  }
  if (!/^[a-z0-9]{5,20}$/.test(config.projectId || "")) return;
  window.melOneClarityInstalled = true;
  const key = config.storageKey || "mel-one.clarity-consent.v1";
  const chinese = document.documentElement.lang.startsWith("zh");
  const traditional = document.documentElement.lang === "zh-Hant";
  const words = chinese
    ? traditional
      ? {
          title: "由您選擇 Clarity 分析",
          body: "經您同意後，Microsoft Clarity 才會記錄遮罩後的頁面閱讀與點擊，製作熱圖和工作階段錄影。開始操作表單或可編輯欄位時即停止錄影；聯絡頁與確認頁不會錄製。",
          scope:
            "這個偏好只控制 Clarity。拒絕不影響瀏覽或使用網站。",
          deny: "關閉 Clarity",
          allow: "允許 Clarity",
          preferences: "Clarity 分析偏好",
          privacy: "私隱說明",
          signal: "您的瀏覽器要求停止追蹤，Clarity 會保持關閉。",
        }
      : {
          title: "由你选择 Clarity 分析",
          body: "经你同意后，Microsoft Clarity 才会记录遮罩后的页面阅读与点击，制作热图和会话录像。开始操作表单或可编辑字段时即停止录像；联系页与确认页不会录制。",
          scope:
            "这个偏好只控制 Clarity。拒绝不影响浏览或使用网站。",
          deny: "关闭 Clarity",
          allow: "允许 Clarity",
          preferences: "Clarity 分析偏好",
          privacy: "隐私说明",
          signal: "你的浏览器要求停止跟踪，Clarity 会保持关闭。",
        }
    : {
        title: "Your choice about Clarity",
        body: "With your permission, Microsoft Clarity records masked page reading and clicks for heatmaps and session recordings. Recording stops when you start using a form or editable field. Contact and confirmation pages are excluded.",
        scope:
          "This preference controls Clarity only. You can browse and use the website without accepting.",
        deny: "Keep Clarity off",
        allow: "Allow Clarity",
        preferences: "Clarity preferences",
        privacy: "Privacy information",
        signal: "Your browser requests no tracking. Clarity will stay off.",
      };
  let panel = document.getElementById("clarity-consent");
  if (!panel) {
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = config.stylesheetPath || "/clarity-consent.css?v=20261015-1";
    document.head.append(style);
    const preferences = document.createElement("div");
    preferences.className = "clarity-preferences";
    const preference = document.createElement("button");
    preference.type = "button";
    preference.dataset.clarityPreferences = "";
    preference.textContent = words.preferences;
    preferences.append(preference);
    document.body.append(preferences);
    panel = document.createElement("section");
    panel.id = "clarity-consent";
    panel.className =
      "clarity-consent" +
      (["carpentry", "renovations", "plumbing", "education"].includes(config.theme)
        ? ` clarity-theme-${config.theme}`
        : "");
    panel.hidden = true;
    panel.setAttribute("aria-labelledby", "clarity-consent-title");
    panel.innerHTML = `<h2 id="clarity-consent-title">${words.title}</h2><p>${words.body}</p><p>${words.scope}</p><p data-privacy-signal hidden>${words.signal}</p><div class="clarity-consent-actions"><button type="button" data-clarity-choice="denied">${words.deny}</button><button type="button" data-clarity-choice="granted">${words.allow}</button></div><a href="${config.privacyPath || (chinese ? "/zh/privacy/" : "/privacy/")}">${words.privacy}</a>`;
    document.body.append(panel);
  }
  const privacySignal =
    navigator.globalPrivacyControl === true ||
    ["1", "yes"].includes(navigator.doNotTrack || "");
  let started = false,
    everStarted = false,
    blocked = false,
    withdrawing = false,
    returnFocus = null;
  function parse(value) {
    try {
      const item = JSON.parse(value || "null");
      return item?.version === 1 &&
        ["granted", "denied"].includes(item.choice) &&
        Number.isFinite(Date.parse(item.updatedAt))
        ? item
        : null;
    } catch {
      return null;
    }
  }
  let consent = null;
  try {
    consent = parse(localStorage.getItem(key));
  } catch {
    /* Optional storage may be unavailable. */
  }
  if (consent?.choice === "granted" && consent.projectId !== config.projectId)
    consent = null;
  const sensitive =
    'form,input,textarea,select,[contenteditable="true"],[data-clarity-sensitive],#draft-panel,[data-rfq-draft],.rfq-output,.draft-output';
  function sensitiveTarget(target) {
    return target instanceof Element && !!target.closest(sensitive);
  }
  function maskSensitive() {
    document.body.setAttribute("data-clarity-mask", "true");
    document
      .querySelectorAll(sensitive)
      .forEach((element) => element.setAttribute("data-clarity-mask", "true"));
    document
      .querySelectorAll('a[href^="mailto:"],a[href^="sms:"]')
      .forEach((element) => element.setAttribute("data-clarity-mask", "true"));
  }
  function stop() {
    blocked = true;
    if (!started) return;
    started = false;
    try {
      window.clarity?.("stop");
    } catch {
      /* Stop must not interfere with an enquiry. */
    }
    document.getElementById("mel-one-clarity")?.remove();
  }
  // Register before loading the vendor, before React/target/bubble input handlers run.
  for (const type of [
    "pointerdown",
    "focusin",
    "keydown",
    "beforeinput",
    "change",
    "submit",
  ]) {
    document.addEventListener(
      type,
      (event) => {
        if (sensitiveTarget(event.target)) stop();
      },
      { capture: true },
    );
  }
  document.addEventListener(
    "click",
    (event) => {
      if (sensitiveTarget(event.target)) {
        stop();
        return;
      }
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]");
      if (!link) return;
      try {
        const destination = new URL(link.getAttribute("href"), location.href);
        if (destination.origin === `https://${config.hostname}`) stop();
      } catch {
        /* Non-navigation links do not change the view. */
      }
    },
    { capture: true },
  );
  for (const type of ["pagehide", "popstate", "hashchange"])
    window.addEventListener(type, stop);
  maskSensitive();
  const observer = new MutationObserver((records) => {
    if (records.some((record) => record.addedNodes?.length)) {
      maskSensitive();
      // Newly created enquiry/draft DOM is never recorded in this view.
      if (
        records.some((record) =>
          [...record.addedNodes].some(
            (added) =>
              added instanceof Element &&
              (added.matches(sensitive) || added.querySelector(sensitive)),
          ),
        )
      )
        stop();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  function entryAllowed() {
    if (
      location.hostname !== config.hostname ||
      location.search ||
      location.hash ||
      privacySignal ||
      blocked
    )
      return false;
    if (
      /\/(?:contact|thank-you|thankyou|staff|admin|brief|project-brief|enquiry)(?:\/|$)/i.test(
        location.pathname,
      )
    )
      return false;
    const path = location.pathname.replace(/\/+$/, "") || "/";
    if (
      Array.isArray(config.excludedPaths) &&
      config.excludedPaths.some(
        (excluded) =>
          typeof excluded === "string" &&
          (excluded.replace(/\/+$/, "") || "/") === path,
      )
    )
      return false;
    try {
      const canonical = document.querySelector('link[rel="canonical"]')?.href;
      if (!canonical) {
        if (config.siteKind !== "internal" || config.allowMissingCanonical !== true)
          return false;
      } else {
        const canonicalHosts = [
          config.hostname,
          ...(Array.isArray(config.canonicalHostnames)
            ? config.canonicalHostnames.filter((host) => typeof host === "string")
            : []),
        ];
        if (!canonicalHosts.includes(new URL(canonical).hostname)) return false;
      }
      if (document.referrer) {
        const referrer = new URL(document.referrer);
        if (
          !["http:", "https:"].includes(referrer.protocol) ||
          referrer.search ||
          referrer.hash
        )
          return false;
      }
    } catch {
      return false;
    }
    if (sensitiveTarget(document.activeElement)) return false;
    return ![
      ...document.querySelectorAll('input,textarea,[contenteditable="true"]'),
    ].some((element) => {
      const type = (element.type || "").toLowerCase();
      if (
        ["hidden", "submit", "button", "reset", "checkbox", "radio"].includes(
          type,
        )
      )
        return false;
      const publicDefault = element.getAttribute("data-clarity-public-default");
      if (publicDefault && element.value === publicDefault) return false;
      return (
        String(element.value || element.textContent || "").trim().length > 0
      );
    });
  }
  function start() {
    if (
      started ||
      consent?.choice !== "granted" ||
      consent.projectId !== config.projectId ||
      !entryAllowed()
    )
      return;
    started = true;
    everStarted = true;
    const clarity = (...args) => {
      (clarity.q ||= []).push(args);
    };
    window.clarity = clarity;
    clarity("consentv2", {
      analytics_Storage: "granted",
      ad_Storage: "denied",
    });
    clarity("set", "site_host", config.hostname);
    clarity(
      "set",
      "site_kind",
      ["business", "internal", "migration"].includes(config.siteKind)
        ? config.siteKind
        : "business",
    );
    const script = document.createElement("script");
    script.id = "mel-one-clarity";
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${config.projectId}`;
    script.referrerPolicy = "strict-origin";
    document.head.append(script);
  }
  function clearCookies() {
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.trim().split("=")[0];
      if (!/^_cl(?:ck|sk)$/.test(name)) continue;
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
      const domains = [config.hostname, ...(config.cookieDomains || [])].filter(
        (domain) =>
          domain === config.hostname || config.hostname === `www.${domain}`,
      );
      for (const domain of new Set(domains))
        document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${domain}; SameSite=Lax`;
    }
  }
  function withdraw() {
    if (withdrawing) return;
    clearCookies();
    if (everStarted) {
      withdrawing = true;
      stop();
      location.reload();
    }
  }
  function choose(choice) {
    consent = {
      version: 1,
      choice: privacySignal ? "denied" : choice,
      projectId: config.projectId,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(key, JSON.stringify(consent));
    } catch {
      /* This page's choice still applies. */
    }
    panel.hidden = true;
    returnFocus?.focus();
    returnFocus = null;
    if (consent.choice === "denied") withdraw();
    else start();
  }
  panel
    .querySelectorAll("[data-clarity-choice]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        choose(button.dataset.clarityChoice),
      ),
    );
  document.querySelectorAll("[data-clarity-preferences]").forEach((button) =>
    button.addEventListener("click", () => {
      returnFocus = button;
      panel.hidden = false;
      panel.querySelector('[data-clarity-choice="denied"]')?.focus();
    }),
  );
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") choose("denied");
  });
  const notice = panel.querySelector("[data-privacy-signal]");
  if (notice) notice.hidden = !privacySignal;
  const allow = panel.querySelector('[data-clarity-choice="granted"]');
  if (allow) allow.disabled = privacySignal;
  window.addEventListener("storage", (event) => {
    if (event.key !== key && event.key !== null) return;
    const incoming = event.key === null ? null : parse(event.newValue);
    consent =
      incoming?.choice === "granted" && incoming.projectId !== config.projectId
        ? null
        : incoming;
    if (
      everStarted &&
      (consent?.choice !== "granted" || consent.projectId !== config.projectId)
    ) {
      withdraw();
      return;
    }
    panel.hidden = consent !== null;
    start();
  });
  panel.hidden = consent !== null;
  start();
})();
