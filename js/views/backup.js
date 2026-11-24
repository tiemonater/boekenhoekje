// Backup screen: save the collection as a file, or restore one.
import { icon } from "../icons.js";
import { screenHeader, toast, confirmSheet, esc } from "../ui.js";
import { getAllBooks } from "../db.js";
import { formatDate } from "../format.js";
import {
  createBackupFile, deliverBackupFile, markBackupDone,
  readBackupFile, restoreBackup, backupStatus, noteChange, updateBackupDot,
} from "../backup.js";

const booksLabel = (n) => (n === 1 ? "1 boek" : `${n} boeken`);

function daysAgo(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days === 0 ? "vandaag" : days === 1 ? "gisteren" : `${days} dagen geleden`;
}

export async function render(root) {
  const [books, status] = await Promise.all([getAllBooks(), backupStatus()]);

  const lastText = status.lastBackupAt
    ? `${formatDate(status.lastBackupAt)} · ${daysAgo(status.lastBackupAt)}`
    : "Nog nooit gemaakt";
  const stateText = books.length === 0
    ? "Je kast is nog leeg."
    : status.changed
      ? "Er is iets veranderd sinds je laatste backup."
      : "Alles is bewaard ✨";

  root.innerHTML = `
    ${screenHeader({ eyebrow: "Veilig bewaard", title: "Backup", eyebrowIcon: "bookmark" })}

    <div class="card">
      <div class="row">
        ${icon("clock")}
        <div>
          <div class="row-title">Laatste backup</div>
          <div class="row-text">${esc(lastText)}</div>
        </div>
      </div>
      <div class="row">
        ${icon(status.changed && books.length ? "sparkle" : "check")}
        <div>
          <div class="row-title">${booksLabel(books.length)} in je kast</div>
          <div class="row-text ${status.due ? "text-rose" : ""}">${esc(stateText)}</div>
        </div>
      </div>
    </div>

    <div class="options section-gap">
      <button class="option" data-action="export" ${books.length ? "" : "disabled"}>
        <span class="option-icon">${icon("download", "icon-lg")}</span>
        <span>
          <span class="option-title">Backup maken</span><br>
          <span class="option-text export-text">Even klaarzetten…</span>
        </span>
      </button>
      <label class="option" data-action="import">
        <span class="option-icon">${icon("upload", "icon-lg")}</span>
        <span>
          <span class="option-title">Backup terugzetten</span><br>
          <span class="option-text">Kies een eerder bewaard bestand</span>
        </span>
        <input type="file" accept=".json,application/json" class="visually-hidden">
      </label>
    </div>

    <div class="card tip section-gap">
      <div class="field-label">${icon("sparkle", "icon-sm")} Zo bewaar je hem goed</div>
      <p>Na "Backup maken" kies je <b>Bewaar in Bestanden</b> en dan <b>iCloud Drive</b>.
      Zo staat je backup veilig, ook als je telefoon kwijtraakt. Je boeken staan namelijk alleen in deze app.</p>
    </div>
  `;

  // ---- Export ----
  // The file is prepared right away: the iPhone only opens the share sheet
  // if it happens straight after the tap, without waiting.
  const exportBtn = root.querySelector('[data-action="export"]');
  const exportText = root.querySelector(".export-text");
  let file = null;
  if (books.length) {
    createBackupFile().then((f) => {
      file = f;
      const kb = f.size / 1024;
      exportText.textContent = `${booksLabel(books.length)} · ${kb > 1024 ? (kb / 1024).toFixed(1) + " MB" : Math.max(1, Math.round(kb)) + " KB"}`;
    }).catch(() => { exportText.textContent = "Klaarzetten lukte niet"; });
  } else {
    exportText.textContent = "Voeg eerst een boek toe";
  }

  exportBtn.addEventListener("click", async () => {
    if (!file) return toast("Even geduld, de backup wordt klaargezet…");
    const done = await deliverBackupFile(file);
    if (!done) return; // share sheet closed without saving
    await markBackupDone();
    updateBackupDot();
    toast("Backup gemaakt ✨");
    render(root);
  });

  // ---- Import ----
  const importInput = root.querySelector('[data-action="import"] input');
  importInput.addEventListener("change", async () => {
    const chosen = importInput.files?.[0];
    importInput.value = "";
    if (!chosen) return;

    let backup;
    try {
      backup = await readBackupFile(chosen);
    } catch (err) {
      toast(err.message);
      return;
    }
    if (!backup.books.length) return toast("Er staan geen boeken in deze backup.");

    const from = backup.exportedAt ? ` van ${formatDate(backup.exportedAt)}` : "";
    const choice = await confirmSheet({
      title: "Backup terugzetten?",
      text: `In deze backup${from} staan ${booksLabel(backup.books.length)}. ` +
        `Boeken die je al hebt, blijven staan; wat mist wordt toegevoegd.`,
      confirmLabel: "Toevoegen aan mijn kast",
      altLabel: books.length ? "Hele kast vervangen" : null,
      cancelLabel: "Annuleren",
    });
    if (!choice) return;

    let mode = "merge";
    if (choice === "alt") {
      const sure = await confirmSheet({
        title: "Hele kast vervangen?",
        text: `Je kast wordt precies gelijk aan de backup. Boeken die niet in de backup staan ` +
          `(nu ${booksLabel(books.length)} in je kast) worden verwijderd. Dit kun je niet ongedaan maken.`,
        confirmLabel: "Ja, vervangen",
        cancelLabel: "Toch niet",
      });
      if (!sure) return;
      mode = "replace";
    }

    try {
      const r = await restoreBackup(backup.books, mode);
      if (r.added || r.updated || r.removed) await noteChange();
      const parts = [
        r.added && `${booksLabel(r.added)} toegevoegd`,
        r.updated && `${r.updated} bijgewerkt`,
        r.removed && `${r.removed} verwijderd`,
      ].filter(Boolean);
      toast(parts.length ? `${parts.join(", ")} ✨` : "Alles stond er al in ✨");
      render(root);
    } catch (err) {
      console.error(err);
      toast(`Terugzetten lukte niet: ${err.message || err}`);
    }
  });
}
