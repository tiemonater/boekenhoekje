// Barcode reading (html5-qrcode library, kept in lib/ so it works offline).
// Safari has no built-in barcode reader, so the library reads the image itself.
// Two ways: live from the camera, or from a photo the user takes.

let libPromise;

function loadLibrary() {
  if (window.__Html5QrcodeLibrary__) return Promise.resolve(window.__Html5QrcodeLibrary__);
  libPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "lib/html5-qrcode.min.js";
    script.onload = () => resolve(window.__Html5QrcodeLibrary__);
    script.onerror = () => { libPromise = null; reject(new Error("Scanner kon niet laden")); };
    document.head.append(script);
  });
  return libPromise;
}

// Only book barcodes: EAN-13 starting with 978 or 979.
function toIsbn(text) {
  const code = String(text ?? "").replace(/\D/g, "");
  return /^97[89]\d{10}$/.test(code) ? code : null;
}

function makeReader(lib, elementId) {
  const F = lib.Html5QrcodeSupportedFormats;
  return new lib.Html5Qrcode(elementId, {
    formatsToSupport: [F.EAN_13],
    verbose: false,
    experimentalFeatures: { useBarCodeDetectorIfSupported: true },
  });
}

// ---- Live camera ----
// Starts the camera inside the element with id `elementId`.
// Calls onIsbn(isbn) once a book barcode is read. Returns a stop() function.
export async function startScanner(elementId, onIsbn) {
  const lib = await loadLibrary();
  const scanner = makeReader(lib, elementId);

  let done = false;
  await scanner.start(
    { facingMode: "environment" },
    {
      fps: 10,
      // a wide box: barcodes are wide
      qrbox: (w, h) => ({ width: Math.floor(w * 0.9), height: Math.floor(Math.min(h * 0.5, w * 0.45)) }),
      aspectRatio: 1.1,
      // ask for a sharp picture; the default can be quite blurry on iPhone
      videoConstraints: {
        facingMode: "environment",
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    },
    (text) => {
      if (done) return;
      const isbn = toIsbn(text);
      if (!isbn) return; // e.g. a price sticker
      done = true;
      onIsbn(isbn);
    },
    () => {} // "nothing found in this frame" — happens many times per second
  );

  return async function stop() {
    try {
      if (scanner.isScanning) await scanner.stop();
      scanner.clear();
    } catch { /* already stopped */ }
  };
}

// ---- From a photo ----

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Foto kon niet geladen worden")); };
    img.src = url;
  });
}

// Draws (part of) the photo at a workable size. `crop` is a fraction of the photo to keep, centred.
function variant(img, maxSize, crop = 1) {
  const sw = img.naturalWidth * crop, sh = img.naturalHeight * crop;
  const sx = (img.naturalWidth - sw) / 2, sy = (img.naturalHeight - sh) / 2;
  const scale = Math.min(1, maxSize / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(new File([blob], "barcode.jpg", { type: "image/jpeg" })), "image/jpeg", 0.92)
  );
}

// Reads a book barcode from a photo. Returns the ISBN, or null if none was found.
// Tries a few versions of the photo: whole, and zoomed into the middle
// (in case the barcode is small in the picture).
export async function scanPhoto(file) {
  const lib = await loadLibrary();
  const holder = document.createElement("div");
  holder.id = "photo-reader";
  holder.hidden = true;
  document.body.append(holder);
  const reader = makeReader(lib, holder.id);

  try {
    const img = await loadImage(file);
    for (const [size, crop] of [[1600, 1], [1600, 0.6], [1200, 1], [1800, 0.4]]) {
      try {
        const isbn = toIsbn(await reader.scanFile(await variant(img, size, crop), false));
        if (isbn) return isbn;
      } catch { /* nothing found in this version, try the next */ }
    }
    return null;
  } finally {
    try { reader.clear(); } catch { /* fine */ }
    holder.remove();
  }
}
