// Backup: the whole collection as one JSON file, and back again.
// Covers go inside the file as text (base64), so one file holds everything.
import { getAllBooks, saveBook, deleteBook, getSetting, setSetting } from "./db.js";
import { makeBook } from "./books.js";

const FORMAT = 1;
const REMIND_AFTER_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

// ---- Making a backup file ----

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  const [head, data] = dataUrl.split(",");
  const type = head.match(/^data:([^;]+)/)?.[1] ?? "image/jpeg";
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type });
}

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Returns a File ready to share or download.
export async function createBackupFile() {
  const books = await getAllBooks();
  const out = [];
  for (const book of books) {
    out.push({ ...book, cover: book.cover instanceof Blob ? await blobToDataUrl(book.cover) : book.cover ?? null });
  }
  const json = JSON.stringify({
    app: "Boekenhoekje",
    format: FORMAT,
    exportedAt: new Date().toISOString(),
    count: out.length,
    books: out,
  });
  return new File([json], `boekenhoekje-backup-${todayStamp()}.json`, { type: "application/json" });
}

// Hands the file to the iPhone share sheet ("Bewaar in Bestanden", AirDrop, mail…),
// or downloads it where sharing isn't possible. Returns false if the user cancelled.
export async function deliverBackupFile(file) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Boekenhoekje backup" });
      return true;
    } catch (err) {
      if (err?.name === "AbortError") return false; // closed the share sheet
      // anything else: fall through to a normal download
    }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

export async function markBackupDone() {
  await setSetting("lastBackupAt", new Date().toISOString());
  await setSetting("changedSinceBackup", false);
  await setSetting("snoozeBackupUntil", null);
}

// ---- Reading a backup file ----

// Checks the file and returns { books, exportedAt } or throws a friendly message.
export async function readBackupFile(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("Dit bestand kan ik niet lezen. Kies een Boekenhoekje-backup (.json).");
  }
  if (data?.app !== "Boekenhoekje" || !Array.isArray(data.books)) {
    throw new Error("Dit is geen Boekenhoekje-backup.");
  }
  if (data.format > FORMAT) {
    throw new Error("Deze backup komt uit een nieuwere versie van de app. Werk de app eerst bij.");
  }
  const books = data.books
    .filter((b) => b && typeof b.title === "string" && b.title.trim())
    .map((b) => {
      const cover = typeof b.cover === "string" && b.cover.startsWith("data:") ? dataUrlToBlob(b.cover)
        : typeof b.cover === "string" && b.cover.startsWith("https://") ? b.cover
        : null;
      const book = makeBook({ ...b, cover }, { id: b.id, createdAt: b.createdAt });
      book.updatedAt = b.updatedAt ?? book.updatedAt; // keep the original "last changed" time
      return book;
    });
  return { books, exportedAt: data.exportedAt ?? null };
}

// mode "merge": add books that are missing; for books in both, keep the newest version.
// mode "replace": the collection becomes exactly the backup.
export async function restoreBackup(books, mode) {
  const current = await getAllBooks();
  const byId = new Map(current.map((b) => [b.id, b]));
  let added = 0, updated = 0, removed = 0;

  if (mode === "replace") {
    const keep = new Set(books.map((b) => b.id));
    for (const b of current) if (!keep.has(b.id)) { await deleteBook(b.id); removed++; }
  }
  for (const book of books) {
    const existing = byId.get(book.id);
    if (!existing) { await saveBook(book); added++; continue; }
    if (mode === "replace" || (book.updatedAt ?? "") > (existing.updatedAt ?? "")) {
      await saveBook(book);
      updated++;
    }
  }
  return { added, updated, removed };
}

// ---- Reminder ----

// Called whenever a book is added, changed or deleted.
export async function noteChange() {
  if (!(await getSetting("changedSinceBackup", false))) {
    await setSetting("changedSinceBackup", true);
    await setSetting("firstChangeSinceBackupAt", new Date().toISOString());
  }
}

// Remind when the last backup is more than 14 days old and something changed since.
// Never made a backup? Then count from the first change.
export async function backupStatus() {
  const lastBackupAt = await getSetting("lastBackupAt", null);
  let changed = await getSetting("changedSinceBackup", false);
  // books added before this reminder existed: count from the oldest one
  if (!lastBackupAt && !changed) {
    const oldest = (await getAllBooks()).map((b) => b.createdAt).sort()[0];
    if (oldest) {
      await setSetting("changedSinceBackup", true);
      await setSetting("firstChangeSinceBackupAt", oldest);
      changed = true;
    }
  }
  const since = lastBackupAt ?? (await getSetting("firstChangeSinceBackupAt", null));
  const snoozeUntil = await getSetting("snoozeBackupUntil", null);
  const now = Date.now();
  const due =
    changed &&
    since != null &&
    now - new Date(since).getTime() > REMIND_AFTER_DAYS * DAY &&
    !(snoozeUntil && now < new Date(snoozeUntil).getTime());
  return { lastBackupAt, changed, due };
}

// Small rose dot on the Backup tab while a backup is due.
export async function updateBackupDot() {
  const { due } = await backupStatus();
  document.querySelector('.tab[data-route="backup"]')?.classList.toggle("has-dot", due);
}

export const snoozeReminder = (days = 3) =>
  setSetting("snoozeBackupUntil", new Date(Date.now() + days * DAY).toISOString());
