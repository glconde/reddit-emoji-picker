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
  const STORAGE_KEY = "rep_recent_emojis";
  const MAX_RECENTS = 24;

  const STATE = {
    emojis:
      /** @type {Array<{emoji:string,name:string,category?:string,keywords?:string[]}>} */ ([]),
    loaded: false,
    query: "",
    onPick: /** @type {(emoji: string) => void} */ (() => {}),
  };

  /**
   * @returns {Promise<void>}
   */
  async function loadEmojis() {
    if (STATE.loaded) return;

    const url = chrome.runtime.getURL("emoji-data.json");
    //console.log("[REP] emoji json url:", url);
    const res = await fetch(url);
    if (!res.ok)
      throw new Error(`Failed to load emoji-data.json: ${res.status}`);
    STATE.emojis = await res.json();
    STATE.loaded = true;
  }

  /** @returns {Promise<string[]>} */
  async function getRecents() {
    try {
      if (!chrome?.storage?.local) return [];
      const data = await chrome.storage.local.get(STORAGE_KEY);
      const arr = data?.[STORAGE_KEY];
      return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  }

  /** @param {string} emoji */
  async function addRecent(emoji) {
    try {
      if (!chrome?.storage?.local) return;
      const recents = await getRecents();
      const next = [emoji, ...recents.filter((e) => e !== emoji)].slice(
        0,
        MAX_RECENTS,
      );
      await chrome.storage.local.set({ [STORAGE_KEY]: next });
    } catch {
      // noop
    }
  }

  /** @param {string} q */
  function setQuery(q) {
    STATE.query = q.trim().toLowerCase();
  }

  /** @param {{emoji:string,name:string,keywords?:string[]}} item */
  function matchesQuery(item) {
    if (!STATE.query) return true;
    const q = STATE.query;

    if (item.emoji && item.emoji.includes(q)) return true;
    if (item.name && item.name.toLowerCase().includes(q)) return true;

    if (Array.isArray(item.keywords)) {
      for (const kw of item.keywords) {
        if (typeof kw === "string" && kw.toLowerCase().includes(q)) return true;
      }
    }
    return false;
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

    const title = document.createElement("div");
    title.className = "rep-picker-title";
    title.textContent = "Emojis";

    const search = document.createElement("input");
    search.className = "rep-picker-search";
    search.type = "search";
    search.placeholder = "Search…";
    search.autocomplete = "off";

    // input handler
    search.addEventListener("input", () => {
      setQuery(search.value);
      // render with current state
      render(panel, STATE.onPick);
    });

    header.appendChild(title);
    header.appendChild(search);

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
  async function render(panel, onPick) {
    STATE.onPick = onPick;

    const grid = panel.querySelector(".rep-picker-grid");
    if (!(grid instanceof HTMLElement)) return;

    grid.innerHTML = "";

    const q = STATE.query;
    const filtered = STATE.emojis.filter(matchesQuery);

    // empty query, show recents first
    let items = filtered;
    if (!q) {
      const recents = await getRecents();
      const recentSet = new Set(recents);

      const recentItems = recents
        .map((e) => STATE.emojis.find((x) => x.emoji === e))
        .filter(Boolean);

      const rest = filtered.filter((x) => !recentSet.has(x.emoji));
      items = /** @type {any} */ (recentItems).concat(rest);
    }

    for (const item of items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rep-emoji-item";
      btn.textContent = item.emoji;
      btn.title = item.name || item.emoji;
      // helps keep selection stable in contenteditable
      btn.addEventListener("mousedown", (e) => e.preventDefault());

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onPick(item.emoji);
        addRecent(item.emoji).catch(() => {});
      });

      grid.appendChild(btn);
    }

    // empty state
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "rep-picker-empty";
      empty.textContent = "No matches.";
      grid.appendChild(empty);
    }
  }

  // expose on window for content.js to call.
  window.__REP_PICKER__ = {
    loadEmojis,
    createPanel,
    render,
  };
})();
