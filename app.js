/* ============================================================
   Stratagem Creator — app logic
   - Model: array of stratagem objects, persisted to localStorage.
   - Cards render from the model; inline edits sync back to it.
   ============================================================ */

(function () {
  "use strict";

  var STORAGE_KEY = "stratagem-creator/v1";
  var COLORS = ["red", "green", "blue"];
  var FIELDS = ["title", "subtitle", "lore", "when", "target", "effect"];

  var cardsEl = document.getElementById("cards");
  var emptyHint = document.getElementById("emptyHint");
  var template = document.getElementById("cardTemplate");

  /** @type {Array<Object>} in-memory model */
  var model = [];
  var idCounter = 1;

  /* ---------------- Sample / defaults ---------------- */

  function sampleStratagem() {
    return {
      id: nextId(),
      color: "green",
      cp: 1,
      title: "Shock Bombardment",
      subtitle: "Bastion Task Force — Strategic Ploy Stratagem",
      lore: "An auspex-guided hail of shock charges blinds the foe's targeting systems and skews their aim.",
      when: "Your Shooting phase or the Fight phase, just after an Adeptus Astartes Battleline unit from your army finished making its attacks.",
      target: "That Adeptus Astartes Battleline unit.",
      effect: "When an enemy unit is auspex scanned as a result of those attacks this turn, until the start of your next turn, it is suppressed. While a unit is suppressed, each time a model in that unit makes an attack, subtract 1 from the Hit roll."
    };
  }

  function blankStratagem() {
    return {
      id: nextId(),
      color: "green",
      cp: 1,
      title: "",
      subtitle: "",
      lore: "",
      when: "",
      target: "",
      effect: ""
    };
  }

  function nextId() { return "s" + idCounter++; }

  /* ---------------- Persistence ---------------- */

  var saveTimer = null;
  function save() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
      } catch (e) {
        console.warn("Could not save to localStorage:", e);
      }
    }, 200);
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    if (!raw) return null;
    try {
      var data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    } catch (e) { /* ignore */ }
    return null;
  }

  /* ---------------- Rendering ---------------- */

  function createCard(strat) {
    var frag = template.content.cloneNode(true);
    var card = frag.querySelector(".card");
    card.dataset.id = strat.id;

    applyTheme(card, strat.color);

    // Fill editable text fields
    FIELDS.forEach(function (field) {
      var el = card.querySelector('[data-field="' + field + '"]');
      if (el) el.textContent = strat[field] || "";
    });

    // CP display + control
    var cpVal = card.querySelector(".cp-val");
    var cpInput = card.querySelector(".cp-input");
    if (cpVal) cpVal.textContent = String(strat.cp);
    if (cpInput) cpInput.value = String(strat.cp);

    // Mark active swatch
    markActiveSwatch(card, strat.color);

    wireCard(card);
    return card;
  }

  function applyTheme(card, color) {
    COLORS.forEach(function (c) { card.classList.remove("theme-" + c); });
    card.classList.add("theme-" + color);
  }

  function markActiveSwatch(card, color) {
    card.querySelectorAll(".swatch").forEach(function (sw) {
      sw.classList.toggle("active", sw.dataset.color === color);
    });
  }

  function getStrat(id) {
    for (var i = 0; i < model.length; i++) if (model[i].id === id) return model[i];
    return null;
  }

  function renderAll() {
    cardsEl.innerHTML = "";
    model.forEach(function (strat) { cardsEl.appendChild(createCard(strat)); });
    updateEmptyState();
  }

  function updateEmptyState() {
    emptyHint.hidden = model.length > 0;
  }

  /* ---------------- Card event wiring ---------------- */

  function wireCard(card) {
    var id = card.dataset.id;

    // Editable text fields -> model
    card.querySelectorAll('[contenteditable][data-field]').forEach(function (el) {
      el.addEventListener("input", function () {
        var strat = getStrat(id);
        if (!strat) return;
        strat[el.dataset.field] = el.textContent;
        save();
      });
      // Paste as plain text so formatting/markup never leaks in
      el.addEventListener("paste", function (e) {
        e.preventDefault();
        var text = (e.clipboardData || window.clipboardData).getData("text/plain");
        document.execCommand("insertText", false, text);
      });
    });

    // Colour swatches
    card.querySelectorAll(".swatch").forEach(function (sw) {
      sw.addEventListener("click", function () {
        var strat = getStrat(id);
        if (!strat) return;
        strat.color = sw.dataset.color;
        applyTheme(card, strat.color);
        markActiveSwatch(card, strat.color);
        save();
      });
    });

    // CP number input
    var cpInput = card.querySelector(".cp-input");
    var cpVal = card.querySelector(".cp-val");
    if (cpInput) {
      cpInput.addEventListener("input", function () {
        var strat = getStrat(id);
        if (!strat) return;
        var n = parseInt(cpInput.value, 10);
        if (isNaN(n) || n < 0) n = 0;
        strat.cp = n;
        if (cpVal) cpVal.textContent = String(n);
        save();
      });
    }

    // Remove
    var removeBtn = card.querySelector(".btn-remove");
    if (removeBtn) {
      removeBtn.addEventListener("click", function () {
        model = model.filter(function (s) { return s.id !== id; });
        card.remove();
        updateEmptyState();
        save();
      });
    }
  }

  /* ---------------- Toolbar actions ---------------- */

  function addStratagem() {
    var strat = blankStratagem();
    model.push(strat);
    cardsEl.appendChild(createCard(strat));
    updateEmptyState();
    save();
    // Focus the title of the new card for immediate typing
    var last = cardsEl.lastElementChild;
    if (last) {
      var titleEl = last.querySelector('[data-field="title"]');
      if (titleEl) titleEl.focus();
      last.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function exportJSON() {
    var blob = new Blob([JSON.stringify(model, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "stratagems.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result));
        if (!Array.isArray(data)) throw new Error("Expected a JSON array of stratagems.");
        model = data.map(function (s) {
          return {
            id: nextId(),
            color: COLORS.indexOf(s.color) >= 0 ? s.color : "green",
            cp: typeof s.cp === "number" ? s.cp : parseInt(s.cp, 10) || 0,
            title: s.title || "",
            subtitle: s.subtitle || "",
            lore: s.lore || "",
            when: s.when || "",
            target: s.target || "",
            effect: s.effect || ""
          };
        });
        renderAll();
        save();
      } catch (e) {
        alert("Could not import file: " + e.message);
      }
    };
    reader.readAsText(file);
  }

  /* ---------------- Init ---------------- */

  function init() {
    var stored = load();
    if (stored && stored.length) {
      // Reassign fresh ids to keep the counter consistent
      model = stored.map(function (s) {
        s.id = nextId();
        if (COLORS.indexOf(s.color) < 0) s.color = "green";
        if (typeof s.cp !== "number") s.cp = parseInt(s.cp, 10) || 0;
        return s;
      });
    } else {
      model = [sampleStratagem()];
    }
    renderAll();

    document.getElementById("addBtn").addEventListener("click", addStratagem);
    document.getElementById("printBtn").addEventListener("click", function () { window.print(); });
    document.getElementById("exportBtn").addEventListener("click", exportJSON);

    var importFile = document.getElementById("importFile");
    document.getElementById("importBtn").addEventListener("click", function () { importFile.click(); });
    importFile.addEventListener("change", function () {
      if (importFile.files && importFile.files[0]) importJSON(importFile.files[0]);
      importFile.value = "";
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
