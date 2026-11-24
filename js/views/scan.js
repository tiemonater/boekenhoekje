// Scan a book's barcode (or type the ISBN), look it up, then open the form pre-filled.
import { icon } from "../icons.js";
import { screenHeader, toast, confirmSheet } from "../ui.js";
import { getAllBooks } from "../db.js";
import { setDraft, isOwned } from "../books.js";
import { startScanner, scanPhoto } from "../scanner.js";
import { lookupIsbn, cleanIsbn, isValidIsbn } from "../lookup.js";
import { downloadCover } from "../image.js";

let stopCamera = null;
let busy = false;
let starting = false; // camera is busy starting up

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
      <div class="scan-frame" aria-hidden="true"><span></span></div>
      <div class="scan-message">
        ${icon("barcode", "icon-lg")}
        <p>Camera opstarten…</p>
      </div>
      <div class="scan-busy" hidden>
        <div class="spinner"></div>
        <p>Boek opzoeken…</p>
      </div>
    </div>
    <p class="scan-hint muted">Richt op de streepjescode achterop het boek. Lukt het niet? Maak dan een foto.</p>

    <label class="btn btn-primary btn-block photo-scan">
      ${icon("camera")} Maak een foto van de barcode
      <input type="file" accept="image/*" capture="environment" class="visually-hidden">
    </label>

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
  const busyText = root.querySelector(".scan-busy p");
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

    const matches = (await getAllBooks()).filter((b) => cleanIsbn(b.isbn) === isbn);
    // On your wishlist? Then you're probably holding it in the shop: "Gekocht?"
    const wished = matches.find((b) => !isOwned(b));
    if (wished) {
      const choice = await confirmSheet({
        title: "Staat op je verlanglijst ♡",
        text: `"${wished.title}" staat op je verlanglijst. Heb je hem gekocht?`,
        confirmLabel: "Ja, gekocht!",
        cancelLabel: "Nee, bekijk het boek",
      });
      location.replace(`#/boek/${encodeURIComponent(wished.id)}${choice ? "/gekocht" : ""}`);
      return;
    }
    const existing = matches.find(isOwned);
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
    busyText.textContent = "Boek opzoeken…";

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

  // ---- Photo of the barcode ----
  const photoButton = root.querySelector(".photo-scan");
  const photoInput = photoButton.querySelector("input");
  // the live camera has to let go before the iPhone camera app can open
  photoButton.addEventListener("click", () => { leave(); });
  photoInput.addEventListener("change", async () => {
    const file = photoInput.files?.[0];
    photoInput.value = "";
    if (!file || busy) return;
    message.hidden = true;
    busyBox.hidden = false;
    busyText.textContent = "Barcode lezen…";
    const isbn = await scanPhoto(file).catch(() => null);
    if (isbn) return handleIsbn(isbn);
    busyBox.hidden = true;
    message.hidden = false;
    toast("Geen barcode gevonden. Probeer dichterbij en recht van voren.");
    mounted(root); // live camera back on
  });
  // came back from the camera app without a photo: switch the live camera on again
  photoInput.addEventListener("cancel", () => mounted(root));

  root.querySelector(".isbn-form").addEventListener("submit", (e) => {
    e.preventDefault();
    handleIsbn(e.target.elements.isbn.value);
  });

}

// Runs once the screen is on the page: now the camera can start.
export async function mounted(root) {
  if (stopCamera || starting || !root.isConnected) return; // already running, or screen left
  const message = root.querySelector(".scan-message");
  message.querySelector("p").textContent = "Camera opstarten…";
  if (!navigator.mediaDevices?.getUserMedia) {
    message.querySelector("p").textContent =
      "De camera werkt alleen als de app online staat (https). Typ het ISBN hieronder.";
    return;
  }
  starting = true;
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
  } finally {
    starting = false;
  }
}
