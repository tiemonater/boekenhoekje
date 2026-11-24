// "Leesdoel" card on Home: progress ring, schedule, and setting the goal.
import { icon } from "./icons.js";
import { esc } from "./ui.js";
import { getGoal, setGoal, goalProgress, scheduleText, wasCelebrated, markCelebrated } from "./goals.js";

const books = (n) => (n === 1 ? "1 boek" : `${n} boeken`);

// Progress ring: rose arc over a soft track, number in the middle.
function ringSVG(p) {
  const R = 44, C = 2 * Math.PI * R;
  const filled = (p.percent / 100) * C;
  return `
    <svg class="goal-ring" viewBox="0 0 110 110" role="img" aria-label="${p.count} van ${p.goal} boeken gelezen">
      <circle cx="55" cy="55" r="${R}" class="goal-track"/>
      <circle cx="55" cy="55" r="${R}" class="goal-arc" transform="rotate(-90 55 55)"
        stroke-dasharray="${filled} ${C}" style="--from:${filled}px"/>
      <text x="55" y="54" text-anchor="middle" class="goal-count">${p.count}</text>
      <text x="55" y="72" text-anchor="middle" class="goal-of">van ${p.goal}</text>
    </svg>`;
}

export async function goalCardHTML(allBooks, year) {
  const goal = await getGoal(year);
  const p = goalProgress(allBooks, goal, year);
  const celebrate = p.reached && !(await wasCelebrated(year));
  if (celebrate) await markCelebrated(year);

  const noDateNote = p.readWithoutDate
    ? `<p class="goal-note">${books(p.readWithoutDate)} op "Gelezen" ${p.readWithoutDate === 1 ? "heeft" : "hebben"} nog geen datum en ${p.readWithoutDate === 1 ? "telt" : "tellen"} niet mee. Zet de datum erbij via Bewerken.</p>`
    : "";

  if (!goal) {
    return `
      <section class="card goal-card goal-empty section-gap">
        <div class="goal-head">
          <h2>Leesdoel ${year}</h2>
        </div>
        <p>Hoeveel boeken wil je dit jaar lezen? ${p.count ? `Je hebt er al ${books(p.count)} uitgelezen ✨` : ""}</p>
        <button type="button" class="btn btn-primary btn-small goal-edit">${icon("sparkle", "icon-sm")} Leesdoel instellen</button>
        ${noDateNote}
      </section>`;
  }

  return `
    <section class="card goal-card section-gap ${p.reached ? "reached" : ""} ${celebrate ? "celebrate" : ""}">
      <div class="goal-head">
        <h2>Leesdoel ${year}</h2>
        <button type="button" class="icon-btn goal-edit" aria-label="Leesdoel aanpassen">${icon("pen", "icon-sm")}</button>
      </div>
      <a class="goal-body" href="#/kast" data-show-read>
        ${ringSVG(p)}
        <div>
          <div class="goal-title">${p.count} van ${books(p.goal)}</div>
          <div class="goal-left">${p.reached ? "Helemaal gelukt" : `Nog ${p.left} te gaan`}</div>
          <div class="goal-schedule">${esc(scheduleText(p))}</div>
        </div>
      </a>
      ${noDateNote}
      ${celebrate ? `<div class="confetti" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => icon("sparkle", `icon-sm c${i}`)).join("")}</div>` : ""}
    </section>`;
}

// Pop-up with − and + to choose the number of books.
function goalSheet(year, current) {
  return new Promise((resolve) => {
    let value = current ?? 24;
    const wrap = document.createElement("div");
    wrap.className = "sheet-backdrop";
    wrap.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="goal-sheet-title">
        <h2 id="goal-sheet-title">Leesdoel ${year}</h2>
        <p>Hoeveel boeken wil je dit jaar lezen?</p>
        <div class="stepper">
          <button type="button" class="step" data-step="-1" aria-label="Eén minder">−</button>
          <input type="number" inputmode="numeric" min="1" max="999" value="${value}" aria-label="Aantal boeken">
          <button type="button" class="step" data-step="1" aria-label="Eén meer">+</button>
        </div>
        <p class="stepper-hint">${Math.round((value / 52) * 10) / 10} boek per week</p>
        <button class="btn btn-primary btn-block" data-answer="save">Opslaan</button>
        ${current ? `<button class="btn btn-ghost btn-block" data-answer="remove">Doel weghalen</button>` : ""}
        <button class="btn btn-ghost btn-block" data-answer="cancel">Annuleren</button>
      </div>`;
    document.body.append(wrap);
    requestAnimationFrame(() => wrap.classList.add("open"));

    const input = wrap.querySelector("input");
    const hint = wrap.querySelector(".stepper-hint");
    const nl = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 });
    const show = () => {
      input.value = value;
      const perWeek = value / 52, perMonth = value / 12;
      const [n, per] = perWeek >= 1 ? [perWeek, "week"] : [perMonth, "maand"];
      const shown = nl.format(n); // "0,8" / "2"
      hint.textContent = `Zo'n ${shown} ${shown === "1" || n < 1 ? "boek" : "boeken"} per ${per}`;
    };
    show();
    input.addEventListener("input", () => { value = Math.max(1, Math.min(999, parseInt(input.value, 10) || 1)); show(); });

    const close = (answer) => {
      wrap.classList.remove("open");
      setTimeout(() => wrap.remove(), 300);
      resolve(answer);
    };
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) return close(null);
      const step = e.target.closest("[data-step]");
      if (step) { value = Math.max(1, Math.min(999, value + Number(step.dataset.step))); show(); return; }
      const btn = e.target.closest("[data-answer]");
      if (!btn) return;
      if (btn.dataset.answer === "save") close(value);
      else if (btn.dataset.answer === "remove") close(0);
      else close(null);
    });
  });
}

// onChanged: re-draw Home after the goal changed. onShowRead: open the shelf with read books.
export function bindGoalCard(root, year, { onChanged, onShowRead }) {
  const card = root.querySelector(".goal-card");
  if (!card) return;
  card.querySelector(".goal-edit")?.addEventListener("click", async () => {
    const answer = await goalSheet(year, await getGoal(year));
    if (answer === null) return;
    await setGoal(year, answer);
    onChanged();
  });
  card.querySelector("[data-show-read]")?.addEventListener("click", onShowRead);
}
