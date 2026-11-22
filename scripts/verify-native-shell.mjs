/**
 * Behaviour checks for native-shell.js.
 * Runs in Node with a tiny DOM stand-in. No device required.
 */
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(root, "native-shell.js"), "utf8");

function boot(extra) {
  const listeners = {};
  const opened = [];
  const locations = [];
  const toasts = [];
  const exits = [];
  let back = null;
  const ui = {
    tab: "home",
    testCat: null,
    testQueue: [],
    testIdx: 0,
    testFlipped: false,
    testBulkMode: false
  };
  let renders = 0;
  let viewer = null;
  let modalOpen = false;
  let closedModal = 0;
  const sandbox = {
    navigator: { userAgent: "Mozilla/5.0" },
    document: {
      addEventListener(type, fn) { listeners[type] = fn; },
      getElementById(id) {
        if (id !== "modalBackdrop") return null;
        return { classList: { contains: () => modalOpen } };
      }
    },
    URL,
    Date,
    console,
    Capacitor: undefined,
    ui,
    renderAll() { renders += 1; },
    showToast(msg) { toasts.push(msg); },
    closePassageViewer() { viewer = null; },
    requestCloseModal() { closedModal += 1; modalOpen = false; },
    get passageViewer() { return viewer; },
    set passageViewer(v) { viewer = v; },
    location: {
      origin: "https://localhost",
      pathname: "/",
      _href: "https://localhost/",
      get href() { return this._href; },
      set href(v) { locations.push(v); this._href = v; }
    },
    scrollTo() {},
    ...extra
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.location = sandbox.location;
  runInContext(source, createContext(sandbox), { filename: "native-shell.js" });
  return {
    listeners,
    opened,
    locations,
    toasts,
    exits,
    ui,
    get renders() { return renders; },
    get back() { return back; },
    set back(v) { back = v; },
    set viewer(v) { viewer = v; },
    get viewer() { return viewer; },
    set modalOpen(v) { modalOpen = v; },
    get closedModal() { return closedModal; },
    sandbox
  };
}

function nativePlugins(sink) {
  return {
    isNativePlatform: () => true,
    registerPlugin(name) {
      if (name === "Browser") {
        return { open(opts) { sink.opened.push(opts.url); return Promise.resolve(); } };
      }
      return {
        addListener(event, fn) { if (event === "backButton") sink.back = fn; },
        exitApp() { sink.exits.push(true); }
      };
    }
  };
}

function click(listeners, href, target) {
  const event = {
    target: { closest: () => ({ getAttribute: () => href, target: target || "" }) },
    preventDefault() { event.defaultPrevented = true; },
    defaultPrevented: false
  };
  listeners.click(event);
  return event;
}

// Plain browser: the shell must not install handlers.
{
  const app = boot();
  assert.equal(app.listeners.click, undefined);
}

// Native link routing.
{
  const sink = { opened: [], exits: [], back: null };
  const app = boot({
    navigator: { userAgent: "Android LifePlannerCapacitor" },
    Capacitor: nativePlugins(sink)
  });
  // boot() created its own opened array. The plugin closes over `sink`.
  // Re-bind: nativePlugins(sink) was passed, so opens go to sink.opened.
  const coupang = click(app.listeners, "https://link.coupang.com/a/example", "_blank");
  assert.equal(coupang.defaultPrevented, true);
  assert.deepEqual(sink.opened, ["https://link.coupang.com/a/example"]);

  click(app.listeners, "https://www.youtube.com/watch?v=abc", "_blank");
  assert.equal(sink.opened[1], "https://www.youtube.com/watch?v=abc");

  click(app.listeners, "privacy-policy.html", "_blank");
  assert.equal(sink.opened[2], "https://sketchkim-hub.github.io/lifeplanner/privacy-policy.html");

  click(app.listeners, "delete-account.html", "_blank");
  assert.equal(sink.opened[3], "https://sketchkim-hub.github.io/lifeplanner/delete-account.html");

  const mail = click(app.listeners, "mailto:kimsketch@naver.com");
  assert.equal(mail.defaultPrevented, true);
  assert.deepEqual(app.locations, ["mailto:kimsketch@naver.com"]);
  // mailto navigation replaces the document; the next check starts from the app URL again.
  app.sandbox.location._href = "https://localhost/";

  const bible = click(app.listeners, "bible/gen.json", "_blank");
  assert.equal(bible.defaultPrevented, true);
  assert.equal(app.locations[1], "https://localhost/bible/gen.json");
  assert.equal(sink.opened.length, 4, "bundled files stay inside the WebView");

  // Same-origin navigation without target=_blank is left to the WebView.
  const plain = click(app.listeners, "bible/gen.json", "");
  assert.equal(plain.defaultPrevented, false);
}

// Back button order: viewer, modal, memory test, previous tab, then exit.
{
  const sink = { opened: [], exits: [], back: null };
  const app = boot({
    navigator: { userAgent: "LifePlannerCapacitor" },
    Capacitor: nativePlugins(sink)
  });
  const back = sink.back;
  assert.equal(typeof back, "function");

  app.viewer = { id: 1 };
  back({});
  assert.equal(app.viewer, null);

  app.modalOpen = true;
  back({});
  assert.equal(app.closedModal, 1);

  app.ui.tab = "memory";
  app.ui.testCat = "five";
  app.sandbox.renderAll();
  const afterEnter = app.renders;
  back({});
  assert.equal(app.ui.testCat, null);
  assert.equal(app.ui.tab, "memory");
  assert.ok(app.renders > afterEnter);

  app.ui.tab = "shop";
  app.sandbox.renderAll();
  back({});
  assert.equal(app.ui.tab, "memory");

  back({});
  assert.equal(app.ui.tab, "home");
  back({});
  assert.equal(app.toasts.at(-1), "한 번 더 누르면 앱이 닫혀요");
  assert.equal(sink.exits.length, 0);
  back({});
  assert.equal(sink.exits.length, 1);
}

// The Android WebView injects Capacitor.Plugins and does not provide registerPlugin.
{
  const sink = { opened: [], exits: [], back: null };
  const plugins = {
    Browser: { open(opts) { sink.opened.push(opts.url); return Promise.resolve(); } },
    App: {
      addListener(event, fn) { if (event === "backButton") sink.back = fn; },
      exitApp() { sink.exits.push(true); }
    }
  };
  const app = boot({
    navigator: { userAgent: "Android LifePlannerCapacitor" },
    Capacitor: { isNativePlatform: () => true, Plugins: plugins }
  });
  const policy = click(app.listeners, "privacy-policy.html", "_blank");
  assert.equal(policy.defaultPrevented, true);
  assert.deepEqual(sink.opened, ["https://sketchkim-hub.github.io/lifeplanner/privacy-policy.html"]);
  assert.equal(typeof sink.back, "function");
}

console.log("verify-native-shell: ok");
