/* ============================================================
   Stratagem Creator — app logic
   - Model: array of stratagem objects, persisted to localStorage.
   - Cards render from the model; inline edits sync back to it.
   ============================================================ */

(function () {
  "use strict";

  var STORAGE_KEY = "stratagem-creator/v1";
  var META_KEY = "stratagem-creator/meta/v1";
  var COLORS = ["red", "green", "blue"];
  var FIELDS = ["title", "subtitle", "lore", "when", "target", "effect"];
  // Fields whose text may carry <b>...</b> emphasis (rendered as HTML).
  var RICH_FIELDS = ["when", "target", "effect"];
  var DEFAULT_IMAGE = "aquila.png";

  var cardsEl = document.getElementById("cards");
  var emptyHint = document.getElementById("emptyHint");
  var template = document.getElementById("cardTemplate");

  /** @type {Array<Object>} in-memory model */
  var model = [];
  /** @type {{detachment:string, image:string, version:string}} sheet header meta */
  var meta = { detachment: "", image: "", version: "" };
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

  var metaSaveTimer = null;
  function saveMeta() {
    if (metaSaveTimer) clearTimeout(metaSaveTimer);
    metaSaveTimer = setTimeout(function () {
      try {
        localStorage.setItem(META_KEY, JSON.stringify(meta));
      } catch (e) {
        console.warn("Could not save header to localStorage:", e);
      }
    }, 200);
  }

  function loadMeta() {
    var raw = null;
    try { raw = localStorage.getItem(META_KEY); } catch (e) { /* ignore */ }
    if (!raw) return;
    try {
      var data = JSON.parse(raw);
      if (data && typeof data === "object") {
        meta.detachment = typeof data.detachment === "string" ? data.detachment : "";
        meta.image = typeof data.image === "string" ? data.image : "";
        meta.version = typeof data.version === "string" ? data.version : "";
      }
    } catch (e) { /* ignore */ }
  }

  /* ---------------- Rendering ---------------- */

  /* ---------------- Rich text (bold) helpers ----------------
     Stored form is plain text that may contain <b>...</b> tags. Only <b> is
     ever rendered; everything else is escaped, so field content stays safe. */

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Stored string -> safe HTML: escape all, then re-enable only <b>/</b>.
  function boldToHtml(s) {
    return escapeHtml(s || "")
      .replace(/&lt;b&gt;/g, "<b>")
      .replace(/&lt;\/b&gt;/g, "</b>");
  }

  function setField(el, s) { el.innerHTML = boldToHtml(s); }

  // Edited contenteditable -> stored string: keep <b>, drop other markup.
  function readField(el) {
    var html = el.innerHTML
      .replace(/<\s*(strong|b)(\s[^>]*)?>/gi, "<b>")
      .replace(/<\s*\/\s*(strong|b)\s*>/gi, "</b>")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<(?!\/?b\b)[^>]*>/gi, "");           // strip all non-<b> tags
    return html
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
      .replace(/&amp;/g, "&");
  }

  function createCard(strat) {
    var frag = template.content.cloneNode(true);
    var card = frag.querySelector(".card");
    card.dataset.id = strat.id;

    applyTheme(card, strat.color);

    // Fill editable text fields
    FIELDS.forEach(function (field) {
      var el = card.querySelector('[data-field="' + field + '"]');
      if (!el) return;
      if (RICH_FIELDS.indexOf(field) >= 0) setField(el, strat[field]);
      else el.textContent = strat[field] || "";
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

  /* ---------------- Detachment header ---------------- */

  function renderHeader() {
    var titleEl = document.querySelector('[data-field="detachment"]');
    var versionEl = document.querySelector('[data-field="version"]');
    var img = document.getElementById("headerImg");
    var removeBtn = document.getElementById("headerRemoveBtn");

    if (titleEl && titleEl.textContent !== meta.detachment) {
      titleEl.textContent = meta.detachment;
    }
    if (versionEl && versionEl.textContent !== meta.version) {
      versionEl.textContent = meta.version;
    }

    // Always show an image: the user's upload if present, otherwise the
    // default Aquila. The reset button only appears once a custom image is set.
    img.src = meta.image || DEFAULT_IMAGE;
    removeBtn.hidden = !meta.image;
  }

  function readHeaderImage(file) {
    var reader = new FileReader();
    reader.onload = function () {
      meta.image = String(reader.result);
      renderHeader();
      saveMeta();
    };
    reader.readAsDataURL(file);
  }

  function wireHeader() {
    var titleEl = document.querySelector('[data-field="detachment"]');
    if (titleEl) {
      titleEl.addEventListener("input", function () {
        meta.detachment = titleEl.textContent;
        saveMeta();
      });
      titleEl.addEventListener("paste", function (e) {
        e.preventDefault();
        var text = (e.clipboardData || window.clipboardData).getData("text/plain");
        document.execCommand("insertText", false, text);
      });
    }

    var versionEl = document.querySelector('[data-field="version"]');
    if (versionEl) {
      versionEl.addEventListener("input", function () {
        meta.version = versionEl.textContent;
        saveMeta();
      });
      versionEl.addEventListener("paste", function (e) {
        e.preventDefault();
        var text = (e.clipboardData || window.clipboardData).getData("text/plain");
        document.execCommand("insertText", false, text);
      });
    }

    var fileInput = document.getElementById("headerImageFile");
    document.getElementById("headerUploadBtn").addEventListener("click", function () {
      fileInput.click();
    });
    fileInput.addEventListener("change", function () {
      if (fileInput.files && fileInput.files[0]) readHeaderImage(fileInput.files[0]);
      fileInput.value = "";
    });
    document.getElementById("headerRemoveBtn").addEventListener("click", function () {
      meta.image = "";
      renderHeader();
      saveMeta();
    });
  }

  /* ---------------- Card event wiring ---------------- */

  function wireCard(card) {
    var id = card.dataset.id;

    // Editable text fields -> model
    card.querySelectorAll('[contenteditable][data-field]').forEach(function (el) {
      el.addEventListener("input", function () {
        var strat = getStrat(id);
        if (!strat) return;
        var f = el.dataset.field;
        strat[f] = RICH_FIELDS.indexOf(f) >= 0 ? readField(el) : el.textContent;
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
        if (n > 5) n = 5;
        if (String(n) !== cpInput.value) cpInput.value = String(n);
        strat.cp = n;
        if (cpVal) cpVal.textContent = String(n);
        save();
      });
    }

    // When the cursor leaves the controls, drop focus from any control inside
    // them. Otherwise a clicked swatch/CP input keeps focus and the
    // :focus-within rule would keep the pop-up visible after the mouse leaves.
    var controls = card.querySelector(".card-controls");
    if (controls) {
      controls.addEventListener("mouseleave", function () {
        if (controls.contains(document.activeElement) &&
            typeof document.activeElement.blur === "function") {
          document.activeElement.blur();
        }
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
    // The version property is always present, even when empty.
    var payload = { detachment: meta.detachment || "", version: meta.version || "", stratagems: model };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
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
        // Accept both the current object form ({ version, stratagems })
        // and the legacy bare-array form.
        var list = data;
        if (data && !Array.isArray(data) && typeof data === "object") {
          var headerChanged = false;
          if (typeof data.detachment === "string") {
            meta.detachment = data.detachment;
            headerChanged = true;
          }
          if (typeof data.version === "string") {
            meta.version = data.version;
            headerChanged = true;
          }
          if (headerChanged) {
            renderHeader();
            saveMeta();
          }
          list = data.stratagems;
        }
        if (!Array.isArray(list)) throw new Error("Expected a JSON array of stratagems.");
        model = list.map(function (s) {
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

    loadMeta();
    renderHeader();
    wireHeader();
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
