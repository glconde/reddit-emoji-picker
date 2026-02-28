// picker.js
// George Conde 2026-02-26
(() => {
  "use strict";

  /**
   * Lightweight picker UI module.
   * - Creates panel DOM
   * - Loads emoji list from emoji-data.json
   * - Renders grid
   */

  const STATE = {
    emojis:
      /** @type {Array<{emoji:string,name:string,category?:string}>} */ ([]),
    loaded: false,
  };

  /**
   * @returns {Promise<void>}
   */
  async function loadEmojis() {
    if (STATE.loaded) return;

    const url = chrome.runtime.getURL("emoji-data.json");
    console.log("[REP] emoji json url:", url);
    const res = await fetch(url);
    if (!res.ok)
      throw new Error(`Failed to load emoji-data.json: ${res.status}`);
    STATE.emojis = await res.json();
    STATE.loaded = true;
  }

  /**
   * @returns {HTMLDivElement}
   */
  function createPanel() {
    const panel = document.createElement("div");
    panel.className = "rep-picker-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Emoji picker");
    panel.style.display = "none";

    const header = document.createElement("div");
    header.className = "rep-picker-header";
    header.textContent = "Emojis";

    const grid = document.createElement("div");
    grid.className = "rep-picker-grid";

    panel.appendChild(header);
    panel.appendChild(grid);

    document.documentElement.appendChild(panel);
    return panel;
  }

  /**
   * @param {HTMLDivElement} panel
   * @param {(emoji: string) => void} onPick
   */
  function render(panel, onPick) {
    const grid = panel.querySelector(".rep-picker-grid");
    if (!(grid instanceof HTMLElement)) return;

    grid.innerHTML = "";

    for (const item of STATE.emojis) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rep-emoji-item";
      btn.textContent = item.emoji;
      btn.title = item.name || item.emoji;

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onPick(item.emoji);
      });

      grid.appendChild(btn);
    }
  }

  // expose on window for content.js to call.
  window.__REP_PICKER__ = {
    loadEmojis,
    createPanel,
    render,
  };
})();
