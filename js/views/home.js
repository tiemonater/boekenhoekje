// Home: the value of the bookshelf is the hero of the app.
import { icon } from "../icons.js";
import { formatEuro } from "../format.js";
import { screenHeader, esc } from "../ui.js";
import { getAllBooks } from "../db.js";
import { computeStats, genreStats } from "../books.js";
import { genreCardHTML, bindGenreCard } from "../genre-chart.js";
import { showGenreOnShelf, showReadOnShelf } from "./shelf.js";
import { goalCardHTML, bindGoalCard } from "../goal-card.js";
import { backupStatus, snoozeReminder, updateBackupDot } from "../backup.js";
import { formatDate } from "../format.js";

// The total shown last time, so the counter can run from there to the new value.
// Starts at 0, so opening the app counts up from € 0,00.
let lastShownTotal = 0;

export async function render(root) {
  const books = await getAllBooks();
  const stats = computeStats(books);
  const genres = genreStats(books);
  const backup = await backupStatus();
  const year = new Date().getFullYear();
  const goalCard = stats.count > 0 ? await goalCardHTML(books, year) : "";
  const from = lastShownTotal;
  const to = stats.totalCents;
  const grew = to > from && from > 0;
  lastShownTotal = to;

  const priciestLink = stats.priciest ? `#/boek/${encodeURIComponent(stats.priciest.id)}` : null;

  root.innerHTML = `
    ${screenHeader({ eyebrow: "Mijn leeshoekje", title: "Boekenhoekje" })}

    <section class="hero ${grew ? "grew" : ""}" aria-label="Waarde van je boekenkast">
      ${icon("sparkle", "sparkle s1")}
      ${icon("sparkle", "sparkle s2")}
      ${icon("sparkle", "sparkle s3")}
      <div class="hero-label">Waarde van je boekenkast</div>
      <div class="hero-value" aria-live="polite">${formatEuro(from)}</div>
      ${grew ? `<div class="hero-delta">+ ${formatEuro(to - from)}</div>` : ""}
      <div class="hero-sub">${stats.count === 1 ? "1 boek" : `${stats.count} boeken`} op de plank</div>
    </section>

    ${backup.due ? `
      <div class="card backup-nudge section-gap" role="status">
        <span class="nudge-icon">${icon("backup")}</span>
        <div>
          <div class="nudge-title">Tijd voor een backup ✨</div>
          <p>${backup.lastBackupAt ? `Je laatste backup is van ${formatDate(backup.lastBackupAt)}.` : "Je hebt nog nooit een backup gemaakt."}
          Je boeken staan alleen op deze telefoon.</p>
          <div class="nudge-actions">
            <a class="btn btn-primary btn-small" href="#/backup">Backup maken</a>
            <button type="button" class="link-btn nudge-later">Later</button>
          </div>
        </div>
      </div>` : ""}

    ${stats.count === 0 ? `
      <div class="card home-empty section-gap">
        <p>Je kast is nog leeg. Voeg je eerste boek toe en zie de waarde groeien ✨</p>
        <a class="btn btn-primary btn-block" href="#/toevoegen">Eerste boek toevoegen</a>
      </div>` : ""}

    <section class="stats">
      <a class="stat" href="#/kast">
        ${icon("book")}
        <div class="stat-label">Aantal boeken</div>
        <div class="stat-value">${stats.count}</div>
      </a>
      <div class="stat">
        ${icon("coin")}
        <div class="stat-label">Gemiddelde prijs</div>
        <div class="stat-value">${formatEuro(stats.averageCents)}</div>
      </div>
      <${priciestLink ? `a href="${priciestLink}"` : "div"} class="stat">
        ${icon("crown")}
        <div class="stat-label">Duurste boek</div>
        <div class="stat-value">${stats.priciest ? formatEuro(stats.priciest.priceCents) : "–"}</div>
        <div class="stat-note">${stats.priciest ? esc(stats.priciest.title) : "Nog geen boeken"}</div>
      </${priciestLink ? "a" : "div"}>
      <div class="stat">
        ${icon("calendar")}
        <div class="stat-label">Uitgegeven in ${year}</div>
        <div class="stat-value">${formatEuro(stats.spentThisYearCents)}</div>
      </div>
    </section>

    ${goalCard}

    ${stats.count > 0 ? genreCardHTML(genres) : ""}
  `;

  bindGenreCard(root, genres, showGenreOnShelf);
  bindGoalCard(root, year, { onChanged: () => render(root), onShowRead: showReadOnShelf });
  root.querySelector(".nudge-later")?.addEventListener("click", async (e) => {
    await snoozeReminder(3); // ask again in 3 days
    e.target.closest(".backup-nudge").remove();
    updateBackupDot();
  });
  countUp(root.querySelector(".hero-value"), from, to);
}

// Smoothly runs the number from `from` to `to` (in cents).
function countUp(el, from, to) {
  if (from === to) return;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) { el.textContent = formatEuro(to); return; }

  const duration = Math.min(1600, 700 + Math.abs(to - from) / 20);
  const start = performance.now() + 150; // small pause while the screen fades in
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function frame(now) {
    if (!el.isConnected) return; // user already went to another screen
    const t = Math.min(1, Math.max(0, (now - start) / duration));
    el.textContent = formatEuro(Math.round(from + (to - from) * easeOut(t)));
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
