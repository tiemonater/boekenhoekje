// Backup: export and import the collection (working from step 7).
import { icon } from "../icons.js";
import { screenHeader, toast } from "../ui.js";

export function render(root) {
  root.innerHTML = `
    ${screenHeader({ eyebrow: "Veilig bewaard", title: "Backup", eyebrowIcon: "bookmark" })}

    <div class="card">
      <div class="row">
        ${icon("clock")}
        <div>
          <div class="row-title">Laatste backup</div>
          <div class="row-text">Nog nooit gemaakt</div>
        </div>
      </div>
      <div class="row">
        ${icon("sparkle")}
        <div class="row-text">Je boeken staan alleen op deze telefoon. Maak af en toe een backup, dan raak je nooit iets kwijt.</div>
      </div>
    </div>

    <div class="options section-gap">
      <button class="option" data-action="export">
        <span class="option-icon">${icon("download", "icon-lg")}</span>
        <span>
          <span class="option-title">Backup maken</span><br>
          <span class="option-text">Bewaar je collectie als bestand</span>
        </span>
      </button>
      <button class="option" data-action="import">
        <span class="option-icon">${icon("upload", "icon-lg")}</span>
        <span>
          <span class="option-title">Backup terugzetten</span><br>
          <span class="option-text">Laad een eerder gemaakt bestand</span>
        </span>
      </button>
    </div>
  `;

  root.querySelectorAll(".option").forEach((btn) =>
    btn.addEventListener("click", () => toast("Komt in een volgende stap ✨"))
  );
}
