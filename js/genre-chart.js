// "Jouw genres" card on Home: bars or a ring chart, your choice.
import { icon } from "./icons.js";
import { esc } from "./ui.js";
import { formatEuro } from "./format.js";

const VIEW_KEY = "genre-view";
const RING_SLOTS = 6; // colors --genre-0 … --genre-5; the rest becomes "Overige"

export function loadView() {
  try { return localStorage.getItem(VIEW_KEY) === "ring" ? "ring" : "bars"; } catch { return "bars"; }
}
function saveView(view) {
  try { localStorage.setItem(VIEW_KEY, view); } catch { /* fine */ }
}

const booksLabel = (n) => (n === 1 ? "1 boek" : `${n} boeken`);

// ---- Bars: one rose bar per genre, length = number of books ----
function barsHTML(list) {
  const max = Math.max(...list.map((g) => g.count));
  return `
    <ul class="genre-bars">
      ${list.map((g) => `
        <li>
          <a class="genre-bar-row" href="#/kast" data-genre="${esc(g.isNone ? "zonder" : g.name)}">
            <span class="genre-name ${g.isNone ? "muted" : ""}">${esc(g.name)}</span>
            <span class="genre-figures">${booksLabel(g.count)} · ${formatEuro(g.totalCents)}</span>
            <span class="genre-track"><span class="genre-fill ${g.isNone ? "none" : ""}" style="--w:${(g.count / max) * 100}%"></span></span>
          </a>
        </li>`).join("")}
    </ul>`;
}

// ---- Ring: share of each genre, top 6 in color, the rest grouped ----
function ringSlices(list) {
  const named = list.filter((g) => !g.isNone);
  const none = list.find((g) => g.isNone);
  const top = named.slice(0, RING_SLOTS).map((g, i) => ({ ...g, color: `var(--genre-${i})`, key: g.name }));
  const rest = named.slice(RING_SLOTS);
  const slices = [...top];
  if (rest.length) {
    slices.push({
      name: `Overige (${rest.length})`, key: null, color: "var(--genre-other)", isOther: true,
      count: rest.reduce((s, g) => s + g.count, 0),
      totalCents: rest.reduce((s, g) => s + g.totalCents, 0),
    });
  }
  if (none) slices.push({ ...none, key: "zonder", color: "var(--genre-other)", textured: true });
  return slices;
}

function ringHTML(list) {
  const slices = ringSlices(list);
  const total = slices.reduce((s, g) => s + g.count, 0);
  const R = 62, C = 2 * Math.PI * R, GAP = slices.length > 1 ? 3 : 0;
  let offset = 0;

  const arcs = slices.map((s) => {
    const len = (s.count / total) * C;
    const dash = Math.max(len - GAP, 0.5);
    const arc = `<circle class="ring-slice" r="${R}" cx="80" cy="80"
      stroke="${s.textured ? "url(#ring-hatch)" : s.color}" stroke-dasharray="${dash} ${C - dash}"
      stroke-dashoffset="${-offset}"><title>${esc(s.name)}: ${booksLabel(s.count)}</title></circle>`;
    offset += len;
    return arc;
  }).join("");

  const pct = (n) => `${Math.round((n / total) * 100)}%`;
  const topGenre = slices.find((s) => !s.isOther && !s.textured);

  return `
    <div class="genre-ring">
      <svg viewBox="0 0 160 160" role="img" aria-label="Verdeling van je boeken over genres">
        <defs>
          <pattern id="ring-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--genre-other)"/>
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--c-card)" stroke-width="2"/>
          </pattern>
        </defs>
        <g transform="rotate(-90 80 80)">${arcs}</g>
        ${topGenre ? `
          <text x="80" y="76" text-anchor="middle" class="ring-center-label">favoriet</text>
          <text x="80" y="96" text-anchor="middle" class="ring-center-value">${esc(topGenre.name.length > 12 ? topGenre.name.slice(0, 11) + "…" : topGenre.name)}</text>` : ""}
      </svg>
      <ul class="ring-legend">
        ${slices.map((s) => `
          <li>
            <${s.key ? `a href="#/kast" data-genre="${esc(s.key)}"` : "div"} class="legend-row">
              <span class="swatch ${s.textured ? "hatched" : ""}" style="background:${s.color}"></span>
              <span class="genre-name ${s.textured ? "muted" : ""}">${esc(s.name)}</span>
              <span class="legend-figures">${s.count} · ${pct(s.count)}</span>
            </${s.key ? "a" : "div"}>
          </li>`).join("")}
      </ul>
    </div>`;
}

// The whole card. `onPickGenre(name)` runs when a genre is tapped.
export function genreCardHTML(stats) {
  const view = loadView();
  return `
    <section class="card genre-card section-gap" aria-labelledby="genre-title">
      <div class="genre-card-head">
        <h2 id="genre-title">Jouw genres</h2>
        <div class="segmented" role="tablist" aria-label="Weergave">
          <button type="button" role="tab" data-view="bars" aria-selected="${view === "bars"}" aria-label="Balkjes">${icon("bars", "icon-sm")}</button>
          <button type="button" role="tab" data-view="ring" aria-selected="${view === "ring"}" aria-label="Ringdiagram">${icon("ring", "icon-sm")}</button>
        </div>
      </div>
      <div class="genre-body">${view === "ring" ? ringHTML(stats.list) : barsHTML(stats.list)}</div>
      ${stats.hasMultiGenreBooks ? `<p class="genre-note">Boeken met meerdere genres tellen bij elk genre mee.</p>` : ""}
    </section>`;
}

export function bindGenreCard(root, stats, onPickGenre) {
  const card = root.querySelector(".genre-card");
  if (!card) return;
  const body = card.querySelector(".genre-body");

  card.querySelectorAll("[data-view]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      saveView(view);
      card.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-selected", b === btn));
      body.innerHTML = view === "ring" ? ringHTML(stats.list) : barsHTML(stats.list);
    })
  );

  // event delegation: works for both views, also after switching
  body.addEventListener("click", (e) => {
    const link = e.target.closest("[data-genre]");
    if (link) onPickGenre(link.dataset.genre);
  });
}
