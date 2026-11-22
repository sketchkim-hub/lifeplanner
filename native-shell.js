/* Capacitor Android shell.
   On GitHub Pages this file returns immediately and changes nothing.
   Inside the app it:
   - drops any service worker so the WebView cannot serve a stale shell
   - opens http(s) links (쿠팡, 유튜브 페이지, 개인정보처리방침) outside the WebView
   - hands mailto: to the email app
   - maps the Android back button onto modals, in-app tabs, then exit */
(function () {
  "use strict";

  function isNative() {
    try {
      if (window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform()) {
        return true;
      }
    } catch (e) { /* ignore */ }
    return navigator.userAgent.indexOf("LifePlannerCapacitor") !== -1;
  }

  if (!isNative()) return;

  var cap = window.Capacitor;
  var PAGES = "https://sketchkim-hub.github.io/lifeplanner/";
  var POLICY = { "privacy-policy.html": true, "delete-account.html": true };

  if ("serviceWorker" in navigator && navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (reg) { reg.unregister(); });
    }).catch(function () {});
  }

  // The injected Capacitor runtime exposes Plugins.App / Plugins.Browser.
  // registerPlugin lives on the npm core package, which this static page does not bundle.
  function plugin(name) {
    if (cap && cap.Plugins && cap.Plugins[name]) return cap.Plugins[name];
    if (cap && typeof cap.registerPlugin === "function") return cap.registerPlugin(name);
    return null;
  }
  var App = plugin("App");
  var Browser = plugin("Browser");
  if (!App || !Browser) return;
  var navStack = [(typeof ui !== "undefined" && ui.tab) ? ui.tab : "home"];
  var applyingBack = false;
  var exitArmedAt = 0;

  if (typeof renderAll === "function") {
    var origRenderAll = renderAll;
    globalThis.renderAll = function () {
      var top = navStack[navStack.length - 1];
      if (!applyingBack && typeof ui !== "undefined" && ui.tab !== top) navStack.push(ui.tab);
      applyingBack = false;
      return origRenderAll.apply(this, arguments);
    };
  }

  function fileName(url) {
    var path = url.pathname || "";
    var cut = path.split("/");
    return cut[cut.length - 1] || "";
  }

  function openExternal(url) {
    try {
      var pending = Browser.open({ url: url });
      if (pending && typeof pending.catch === "function") pending.catch(function () {});
    } catch (e) {
      window.location.href = url;
    }
  }

  document.addEventListener("click", function (e) {
    var el = e.target;
    var a = el && el.closest ? el.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#" || href.indexOf("javascript:") === 0) return;

    var url;
    try { url = new URL(href, window.location.href); }
    catch (err) { return; }

    if (url.protocol === "mailto:") {
      e.preventDefault();
      window.location.href = url.href;
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return;

    var sameOrigin = url.origin === window.location.origin;
    var name = fileName(url);
    if (sameOrigin && !POLICY[name]) {
      // Bundled files (including a future bible/ folder) stay in the WebView.
      // target=_blank would open a second window the WebView cannot show.
      if (a.target === "_blank") {
        e.preventDefault();
        window.location.href = url.href;
      }
      return;
    }

    e.preventDefault();
    openExternal(POLICY[name] ? (PAGES + name) : url.href);
  }, true);

  function leaveMemoryTest() {
    if (typeof ui === "undefined" || !ui.testCat) return false;
    ui.testCat = null;
    ui.testQueue = [];
    ui.testIdx = 0;
    ui.testFlipped = false;
    ui.testBulkMode = false;
    if (typeof renderAll === "function") renderAll();
    return true;
  }

  App.addListener("backButton", function (ev) {
    if (typeof passageViewer !== "undefined" && passageViewer && typeof closePassageViewer === "function") {
      closePassageViewer();
      return;
    }
    var modal = document.getElementById("modalBackdrop");
    if (modal && modal.classList.contains("open") && typeof requestCloseModal === "function") {
      requestCloseModal();
      return;
    }
    var path = window.location.pathname || "";
    var onAppDoc = path === "/" || path === "" || /\/index\.html$/.test(path);
    if (!onAppDoc && ev && ev.canGoBack) {
      window.history.back();
      return;
    }
    if (leaveMemoryTest()) return;
    if (navStack.length > 1) {
      navStack.pop();
      applyingBack = true;
      if (typeof ui !== "undefined") ui.tab = navStack[navStack.length - 1];
      if (typeof renderAll === "function") renderAll();
      window.scrollTo(0, 0);
      return;
    }
    var now = Date.now();
    if (now - exitArmedAt < 2000) {
      App.exitApp();
      return;
    }
    exitArmedAt = now;
    if (typeof showToast === "function") showToast("한 번 더 누르면 앱이 닫혀요");
  });
})();
