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

// ---- Books ----
export const getAllBooks = () => run("books", "readonly", (s) => s.getAll());
export const getBook = (id) => run("books", "readonly", (s) => s.get(id));
export const saveBook = (book) => run("books", "readwrite", (s) => s.put(book));
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
