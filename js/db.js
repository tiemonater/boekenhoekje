// Local database (IndexedDB) — all data stays on this phone.
// Two "drawers": books, and settings (e.g. date of last backup).

const DB_NAME = "boekenhoekje";
const DB_VERSION = 1;

let dbPromise;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("books")) {
        const books = db.createObjectStore("books", { keyPath: "id" });
        books.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// Runs one request inside a transaction and returns its result.
async function run(storeName, mode, action) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const req = action(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// ---- Covers ----
// Safari (iPhone) has a bug: an image Blob read from IndexedDB and saved again
// can come back empty. So covers are stored as raw bytes + type, and turned
// back into a Blob when read. Covers saved the old way (as Blob) still load fine.
async function toStored(book) {
  if (!(book.cover instanceof Blob)) return book;
  return { ...book, cover: { imageType: book.cover.type || "image/jpeg", imageData: await book.cover.arrayBuffer() } };
}
function fromStored(row) {
  // (careful: a Blob itself also has a "bytes" method, so check our own field names)
  const c = row?.cover;
  if (c && !(c instanceof Blob) && c.imageData instanceof ArrayBuffer) {
    return { ...row, cover: new Blob([c.imageData], { type: c.imageType }) };
  }
  return row;
}

// ---- Books ----
export const getAllBooks = async () => (await run("books", "readonly", (s) => s.getAll())).map(fromStored);
export const getBook = async (id) => fromStored(await run("books", "readonly", (s) => s.get(id)));
export async function saveBook(book) {
  const row = await toStored(book); // before the transaction: it must not wait halfway
  return run("books", "readwrite", (s) => s.put(row));
}
export const deleteBook = (id) => run("books", "readwrite", (s) => s.delete(id));

// ---- Settings ----
export async function getSetting(key, fallback = null) {
  const row = await run("settings", "readonly", (s) => s.get(key));
  return row ? row.value : fallback;
}
export const setSetting = (key, value) =>
  run("settings", "readwrite", (s) => s.put({ key, value }));

// Ask the browser to never clear our data on its own.
export function requestPersistentStorage() {
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}
