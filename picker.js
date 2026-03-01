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

  let EMOJI_CACHE = null;

  /**
   * @returns {Promise<void>}
   */
  async function loadEmojis() {
    if (EMOJI_CACHE) return EMOJI_CACHE;

    const res = await fetch(chrome.runtime.getURL("emoji-data.json"));
    EMOJI_CACHE = await res.json();
    return EMOJI_CACHE;
  }

  async function preload() {
    await loadEmojis();
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

  /** @param {{emoji:string,name:string,keywords?:string[],shortcodes?:string[]}} item */
  function matchesQuery(item) {
    if (!STATE.query) return true;

    const terms = STATE.query.split(/\s+/).filter(Boolean);

    const haystack = [
      item.name || "",
      ...(item.keywords || []),
      ...(item.shortcodes || []),
    ]
      .join(" ")
      .toLowerCase();

    return terms.every((term) => haystack.includes(term));
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

    // const loadingElem = document.createElement("div");
    // loadingElem.className = "rep-loading";
    // loadingElem.textContent = "Loading emojis…";
    // panel.appendChild(loadingElem);

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

    // load once
    if (!STATE.loaded) {
      grid.innerHTML = '<div class="rep-loading">Loading emojis…</div>';
      STATE.emojis = await loadEmojis();
      STATE.loaded = true;
    }

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
      //items = /** @type {any} */ (recentItems).concat(rest);
      items = recentItems.concat(rest);
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
    preload,
  };
})();
