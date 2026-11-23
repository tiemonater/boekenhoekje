// Scan a book's barcode (or type the ISBN), look it up, then open the form pre-filled.
import { icon } from "../icons.js";
import { screenHeader, toast, confirmSheet } from "../ui.js";
import { getAllBooks } from "../db.js";
import { setDraft } from "../books.js";
import { startScanner } from "../scanner.js";
import { lookupIsbn, cleanIsbn, isValidIsbn } from "../lookup.js";
import { downloadCover } from "../image.js";

let stopCamera = null;
let busy = false;

// Called by the router when leaving this screen: switch the camera off.
export async function leave() {
  const stop = stopCamera;
  stopCamera = null;
  await stop?.();
}

export async function render(root) {
  busy = false;
  root.innerHTML = `
    ${screenHeader({ eyebrow: "Nieuw op de plank", title: "Scan de barcode", eyebrowIcon: "barcode", back: "#/toevoegen" })}

    <div class="scan-box">
      <div id="reader"></div>
      <div class="scan-message">
        ${icon("barcode", "icon-lg")}
        <p>Camera opstarten…</p>
      </div>
      <div class="scan-busy" hidden>
        <div class="spinner"></div>
        <p>Boek opzoeken…</p>
      </div>
    </div>
    <p class="scan-hint muted">Richt op de streepjescode achterop het boek (het nummer begint met 978 of 979).</p>

    <form class="card isbn-form" novalidate>
      <label class="field">
        <span class="field-label">Of typ het ISBN</span>
        <span class="isbn-row">
          <input name="isbn" type="text" inputmode="numeric" placeholder="978…" autocomplete="off">
          <button class="btn btn-primary" type="submit">Zoek</button>
        </span>
      </label>
    </form>
  `;

  const message = root.querySelector(".scan-message");
  const busyBox = root.querySelector(".scan-busy");

  async function handleIsbn(raw) {
    if (busy) return;
    const isbn = cleanIsbn(raw);
    if (!isValidIsbn(isbn)) {
      toast("Dat ISBN klopt niet helemaal");
      return;
    }
    busy = true;
    await leave(); // camera off while we look things up

    const existing = (await getAllBooks()).find((b) => cleanIsbn(b.isbn) === isbn);
    if (existing) {
      const again = await confirmSheet({
        title: "Staat al in je kast",
        text: `"${existing.title}" heb je al. Wil je hem nog een keer toevoegen (bijv. een tweede exemplaar)?`,
        confirmLabel: "Ja, nog een keer",
        cancelLabel: "Nee, bekijk het boek",
      });
      if (!again) {
        location.replace(`#/boek/${encodeURIComponent(existing.id)}`);
        return;
      }
    }

    message.hidden = true;
    busyBox.hidden = false;

    const found = await lookupIsbn(isbn);
    if (found) {
      // keep our own small copy of the cover, so it also shows offline
      const cover = found.coverUrl ? (await downloadCover(found.coverUrl)) ?? found.coverUrl : null;
      setDraft({ isbn, title: found.title, author: found.author, pages: found.pages, year: found.year, cover, fromScan: true });
      toast("Gevonden ✨");
    } else {
      setDraft({ isbn, fromScan: true });
      toast("Niet gevonden, vul hem zelf aan");
    }
    location.replace("#/toevoegen/handmatig");
  }

  root.handleIsbn = handleIsbn; // used by the camera in mounted()

  root.querySelector(".isbn-form").addEventListener("submit", (e) => {
    e.preventDefault();
    handleIsbn(e.target.elements.isbn.value);
  });

}

// Runs once the screen is on the page: now the camera can start.
export async function mounted(root) {
  const message = root.querySelector(".scan-message");
  if (!navigator.mediaDevices?.getUserMedia) {
    message.querySelector("p").textContent =
      "De camera werkt alleen als de app online staat (https). Typ het ISBN hieronder.";
    return;
  }
  try {
    const stop = await startScanner("reader", (isbn) => root.handleIsbn(isbn));
    if (!root.isConnected) return stop(); // user already left this screen
    stopCamera = stop;
    message.hidden = true;
  } catch (err) {
    console.error(err);
    const denied = /permission|notallowed/i.test(`${err?.name} ${err?.message ?? err}`);
    message.querySelector("p").textContent = denied
      ? "Geen toegang tot de camera. Sta het toe in Instellingen › Safari › Camera, of typ het ISBN hieronder."
      : "De camera kon niet starten. Typ het ISBN hieronder.";
  }
}
