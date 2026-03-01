// content.js
// George Conde 2026-02-26

(() => {
  "use strict";

  // to spot on console.log
  const LOG_PREFIX = "[REP]";
  // turn DEBUG mode on/off
  const DEBUG = false;

  /** @type {HTMLElement|null} */
  let activeEditor = null;

  /** @type {HTMLButtonElement|null} */
  let emojiBtn = null;

  /** @type {HTMLDivElement|null} */
  let pickerPanel = null;

  let pickerOpen = false;

  /** @type {Range|null} */
  let savedRange = null;

  function log(...args) {
    if (DEBUG) console.log(LOG_PREFIX, ...args);
  }

  function saveSelectionIfInEditor() {
    const editor = getLiveEditor();
    if (!editor) return;

    // keep activeEditor synced
    activeEditor = editor;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const anchor = sel.anchorNode;
    if (anchor && editor.contains(anchor)) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
  }

  function getLiveEditor() {
    // check if one is still in DOM, use it
    if (activeEditor instanceof HTMLElement && activeEditor.isConnected)
      return activeEditor;

    // try from current active element
    const ae = document.activeElement;
    if (ae instanceof HTMLElement) {
      const ce = ae.closest?.('[contenteditable="true"]');
      if (ce instanceof HTMLElement) return ce;
    }

    // try from current selection
    const sel = window.getSelection();
    const anchor = sel?.anchorNode;
    if (anchor) {
      const el =
        anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement;
      const ce = el?.closest?.('[contenteditable="true"]');
      if (ce instanceof HTMLElement) return ce;
    }

    return null;
  }

  /**
   * support both textarea and contenteditable (rich editor).
   * @param {EventTarget|null} target
   * @returns {HTMLElement|null}
   */
  function getEditorFromTarget(target) {
    if (!(target instanceof HTMLElement)) return null;

    // direct textarea
    if (target.tagName === "TEXTAREA") return target;

    // direct contenteditable
    const ce = target.closest('[contenteditable="true"]');
    if (ce) return ce;

    return null;
  }

  /**
   * @param {HTMLElement} el
   * @returns {"textarea"|"contenteditable"}
   */
  function getEditorType(el) {
    return el.tagName === "TEXTAREA" ? "textarea" : "contenteditable";
  }

  /** create the floating button once or summons the already created one */
  function ensureEmojiButton() {
    if (emojiBtn) return emojiBtn;

    const btn = document.createElement("button");

    btn.type = "button";
    btn.className = "rep-emoji-btn";
    btn.setAttribute("aria-label", "Open emoji picker");
    btn.title = "Emoji";
    btn.textContent = "🙂";

    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("pointerdown", (e) => e.preventDefault());

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // toggle picker
      if (!pickerPanel) {
        if (!window.__REP_PICKER__) {
          log("picker module missing");
          return;
        }
        pickerPanel = window.__REP_PICKER__.createPanel();
        // close when clicking outside
        document.addEventListener("mousedown", onDocumentMouseDown, true);
      }

      if (!pickerOpen) {
        saveSelectionIfInEditor();
        await openPicker();
      } else {
        closePicker();
      }
    });

    document.documentElement.appendChild(btn);
    emojiBtn = btn;
    return btn;
  }

  function removeEmojiButton() {
    if (!emojiBtn) return;
    emojiBtn.remove();
    emojiBtn = null;
  }

  function positionEmojiButton() {
    if (!activeEditor || !emojiBtn) return;

    const rect = activeEditor.getBoundingClientRect();

    // hide button if editor is off-screen/collapsed,
    const isVisible =
      rect.width > 20 &&
      rect.height > 20 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth;

    if (!isVisible) {
      emojiBtn.style.display = "none";
      if (pickerOpen) closePicker();
      return;
    }
    emojiBtn.style.display = "flex";

    const inset = 10;
    const btnSize = 32;

    // bottom-right inside the editor box
    let top = rect.bottom - btnSize - inset;
    let left = rect.right - btnSize - inset;

    // clamp to viewport
    top = Math.max(8, Math.min(top, window.innerHeight - btnSize - 8));
    left = Math.max(8, Math.min(left, window.innerWidth - btnSize - 8));

    emojiBtn.style.top = `${Math.round(top)}px`;
    emojiBtn.style.left = `${Math.round(left)}px`;

    // keep picker anchored to button
    if (pickerOpen) positionPickerPanel();
  }

  function positionPickerPanel() {
    if (!pickerPanel || !emojiBtn) return;

    const btnRect = emojiBtn.getBoundingClientRect();
    const panelWidth = 280;
    const panelMaxHeight = 260;
    const gap = 8;

    // default: above the button
    let top = btnRect.top - panelMaxHeight - gap;
    let left = btnRect.right - panelWidth;

    // if not enough room above, fallback below
    if (top < 8) {
      top = btnRect.bottom + gap;
    }

    // clamp horizontally
    left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));

    pickerPanel.style.top = `${Math.round(top)}px`;
    pickerPanel.style.left = `${Math.round(left)}px`;
  }

  async function openPicker() {
    if (!pickerPanel || !window.__REP_PICKER__) return;

    try {
      await window.__REP_PICKER__.loadEmojis();
    } catch (err) {
      log("failed to load emojis:", err);
      return;
    }

    window.__REP_PICKER__.render(pickerPanel, (emoji) => {
      insertEmoji(emoji);
      closePicker();
    });

    pickerOpen = true;
    pickerPanel.style.display = "block";
    positionPickerPanel();
  }

  function closePicker() {
    if (!pickerPanel) return;
    pickerOpen = false;
    pickerPanel.style.display = "none";
  }

  function onDocumentMouseDown(e) {
    if (!pickerOpen) return;
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (!t) return;

    const clickedInsidePanel = pickerPanel && pickerPanel.contains(t);
    const clickedButton = emojiBtn && emojiBtn.contains(t);
    const clickedEditor = activeEditor && activeEditor.contains(t);

    // allow clicking within panel/button/editor without closing
    if (clickedInsidePanel || clickedButton || clickedEditor) return;

    closePicker();
  }

  /**
   * insert emoji into either textarea or contenteditable.
   * @param {string} emoji
   */
  function insertEmoji(emoji) {
    if (!activeEditor) return;

    if (DEBUG)
      console.log("[REP] insertEmoji()", { emoji, hasEditor: !!activeEditor });

    // get editor
    const editor = getLiveEditor() || activeEditor;
    if (!editor) return;
    activeEditor = editor;

    editor.focus?.();

    const sel = window.getSelection();
    if (!sel) return;

    if (savedRange) {
      try {
        // ok to fail if reddit rerenders child nodes
        if (editor.contains(savedRange.startContainer)) {
          sel.removeAllRanges();
          sel.addRange(savedRange);
        }
      } catch {
        // noop
      }
    }

    // note: using deprecated execCommand for reliability
    const ok = document.execCommand("insertText", false, emoji);

    if (ok) {
      // refresh savedRange to the new caret position
      try {
        if (sel.rangeCount) savedRange = sel.getRangeAt(0).cloneRange();
      } catch {}
      return; // early exit
    }

    // handle textarea
    if (getEditorType(editor) === "textarea") {
      const start = editor.selectionStart ?? 0;
      const end = editor.selectionEnd ?? 0;

      editor.value =
        editor.value.slice(0, start) + emoji + editor.value.slice(end);

      const newPos = start + emoji.length;
      editor.setSelectionRange(newPos, newPos);

      // something has changed, let framework know.
      editor.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          composed: true,
          inputType: "insertText",
          data: emoji,
        }),
      );

      return; // early exit
    }

    const selection = window.getSelection();
    if (!selection) return;

    // if the picker search box is used
    const focusInPicker =
      pickerPanel &&
      document.activeElement instanceof HTMLElement &&
      pickerPanel.contains(document.activeElement);

    let range;

    // focus editor first, then restore saved caret if valid
    editor.focus?.();

    if (savedRange && editor.contains(savedRange.startContainer)) {
      try {
        selection.removeAllRanges();
        selection.addRange(savedRange);
        range = selection.getRangeAt(0);
      } catch {
        // noop
      }
    }

    // fall back to current selection
    if (!range && !focusInPicker && selection.rangeCount > 0) {
      const candidate = selection.getRangeAt(0);
      if (editor.contains(candidate.commonAncestorContainer)) {
        range = candidate;
      }
    }

    // append at the end
    if (!range) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }

    range.deleteContents();
    const textNode = document.createTextNode(emoji);
    range.insertNode(textNode);

    // place caret after the emoji
    range.setStartAfter(textNode);
    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);

    // save
    savedRange = range.cloneRange();

    // let framework (react/vue) know
    editor.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: "insertText",
        data: emoji,
      }),
    );
  }

  /**
   * @param {HTMLElement|null} el
   */
  function setActiveEditor(el) {
    if (el === activeEditor) return;

    activeEditor = el;

    if (!activeEditor) {
      log("active editor cleared");
      removeEmojiButton();
      return;
    }

    const type = getEditorType(activeEditor);
    log("active editor set:", {
      type,
      tag: activeEditor.tagName,
      id: activeEditor.id || null,
      class: activeEditor.className || null,
    });

    ensureEmojiButton();
    positionEmojiButton();
  }

  // handle resize or scroll
  window.addEventListener("scroll", () => positionEmojiButton(), true);
  window.addEventListener("resize", () => positionEmojiButton());

  // focus detection
  document.addEventListener(
    "focusin",
    (e) => {
      const editor = getEditorFromTarget(e.target);
      if (editor) setActiveEditor(editor);
    },
    true,
  );

  // when focus leaves the editor, clear
  document.addEventListener(
    "focusout",
    (e) => {
      setTimeout(() => {
        // prevent clearing of editor if picker is open
        if (pickerOpen) return;

        const now = document.activeElement;

        const editorStillFocused =
          activeEditor &&
          now instanceof HTMLElement &&
          (now === activeEditor || activeEditor.contains(now));

        const focusOnButton =
          emojiBtn && now instanceof HTMLElement && emojiBtn.contains(now);

        const focusOnPanel =
          pickerPanel &&
          now instanceof HTMLElement &&
          pickerPanel.contains(now);

        if (!editorStillFocused && !focusOnButton && !focusOnPanel) {
          setActiveEditor(null);
        }
      }, 0);
    },
    true,
  );

  document.addEventListener("selectionchange", () => {
    if (!activeEditor) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const anchor = sel.anchorNode;
    if (anchor && activeEditor.contains(anchor)) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
  });

  log("content script loaded");
})();
