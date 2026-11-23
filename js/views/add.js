// Add a book: choose scanning or manual entry.
import { icon } from "../icons.js";
import { screenHeader } from "../ui.js";

export function render(root) {
  root.innerHTML = `
    ${screenHeader({ eyebrow: "Nieuw op de plank", title: "Boek toevoegen" })}

    <div class="options">
      <button class="option" data-action="scan">
        <span class="option-icon">${icon("barcode", "icon-lg")}</span>
        <span>
          <span class="option-title">Scan de barcode</span><br>
          <span class="option-text">Gegevens en cover worden vanzelf ingevuld</span>
        </span>
        ${icon("chevron", "chevron")}
      </button>

      <button class="option" data-action="manual">
        <span class="option-icon">${icon("pen", "icon-lg")}</span>
        <span>
          <span class="option-title">Zelf invullen</span><br>
          <span class="option-text">Voor boeken zonder barcode</span>
        </span>
        ${icon("chevron", "chevron")}
      </button>
    </div>
  `;

  root.querySelector('[data-action="scan"]').addEventListener("click", () => {
    location.hash = "#/toevoegen/scan";
  });
  root.querySelector('[data-action="manual"]').addEventListener("click", () => {
    location.hash = "#/toevoegen/handmatig";
  });
}
