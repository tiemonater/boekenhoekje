// Starts the app and switches between screens.
// Each screen lives in js/views/ and exports render(rootElement, params).
import { icon } from "./icons.js";
import { requestPersistentStorage } from "./db.js";
import { toast } from "./ui.js";
import { updateBackupDot } from "./backup.js";
import * as home from "./views/home.js";
import * as shelf from "./views/shelf.js";
import * as add from "./views/add.js";
import * as bookForm from "./views/form.js";
import * as backup from "./views/backup.js";
import * as book from "./views/book.js";
import * as scan from "./views/scan.js";

// Address (after #/) → screen.
// `tabbar`: false (or a function of params) hides the bottom bar.
// `tab`: which tab lights up, if not the route's own name.
const routes = {
  "": { view: home },
  kast: { view: shelf },
  toevoegen: { view: add },
  "toevoegen/handmatig": { view: bookForm, tabbar: false, tab: "toevoegen" },
  "toevoegen/scan": { view: scan, tabbar: false, tab: "toevoegen" },
  boek: { view: book, tabbar: book.showTabbar, tab: "kast" },
  backup: { view: backup },
};

const main = document.querySelector("#app");
let renderCount = 0;
let currentView = null;

function buildTabbar() {
  const nav = document.querySelector(".tabbar-wrap");
  nav.innerHTML = `
    <nav class="tabbar" aria-label="Hoofdmenu">
      <a class="tab" href="#/" data-route="">${icon("home")}<span>Home</span></a>
      <a class="tab" href="#/kast" data-route="kast">${icon("shelf")}<span>Kast</span></a>
      <a class="tab" href="#/backup" data-route="backup">${icon("backup")}<span>Backup</span></a>
    </nav>
    <a class="fab" href="#/toevoegen" data-route="toevoegen" aria-label="Boek toevoegen">${icon("plus")}</a>
  `;
}

// "#/toevoegen/handmatig" → route "toevoegen/handmatig".
// Unknown longer paths fall back to their first part, e.g. "#/boek/123" → "boek" with params ["123"].
function resolve() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  for (let n = parts.length; n >= 0; n--) {
    const key = parts.slice(0, n).join("/");
    if (routes[key]) return { key, route: routes[key], params: parts.slice(n) };
  }
  return { key: "", route: routes[""], params: [] };
}

async function show() {
  const myTurn = ++renderCount;
  const { key, route, params } = resolve();

  // Let the previous screen clean up (e.g. switch the camera off)
  await currentView?.leave?.();
  currentView = route.view;

  const container = document.createElement("div");
  container.className = "view";
  try {
    await route.view.render(container, params);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="card empty"><h2>Oeps</h2><p>Er ging iets mis bij het laden.</p></div>`;
  }
  if (myTurn !== renderCount) return; // a newer screen was requested meanwhile

  main.replaceChildren(container);
  window.scrollTo(0, 0);
  // Some screens need to be on the page before they can start (e.g. the camera)
  route.view.mounted?.(container, params);
  updateBackupDot();

  const tabbar = typeof route.tabbar === "function" ? route.tabbar(params) : route.tabbar !== false;
  document.body.classList.toggle("no-tabbar", !tabbar);
  const section = route.tab ?? key;
  document.querySelectorAll("[data-route]").forEach((el) => {
    el.classList.toggle("active", el.dataset.route === section);
  });
}

// Show unexpected errors on screen, so problems on the iPhone are visible.
window.addEventListener("error", (e) => toast(`Foutje: ${e.message}`));
window.addEventListener("unhandledrejection", (e) => toast(`Foutje: ${e.reason?.message || e.reason}`));

buildTabbar();
requestPersistentStorage();

// Keep a copy of the app on the phone so it also opens without internet (see sw.js).
// Only possible on https (or localhost), so not on the Wi-Fi test address.
if ("serviceWorker" in navigator && isSecureContext) {
  navigator.serviceWorker.register("sw.js").catch((err) => console.warn("Offline copy not available", err));
}
window.addEventListener("hashchange", show);
show().then(() => window.hideSplash?.()); // first screen is ready: fade the start-up screen out
