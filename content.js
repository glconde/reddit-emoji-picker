// content.js
// George Conde 2026-02-26

(() => {
  "use strict";

  // to spot on console.log
  const LOG_PREFIX = "[REP]";

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
    console.log(LOG_PREFIX, ...args);
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

  function restoreSelectionIntoEditor() {
    if (!activeEditor || !savedRange) return;

    activeEditor.focus?.();

    const sel = window.getSelection();
    if (!sel) return;

    sel.removeAllRanges();
    sel.addRange(savedRange);
  }

  function getLiveEditor() {
    // If we have one and it’s still in DOM, use it
    if (activeEditor instanceof HTMLElement && activeEditor.isConnected)
      return activeEditor;

    // Try from current active element
    const ae = document.activeElement;
    if (ae instanceof HTMLElement) {
      const ce = ae.closest?.('[contenteditable="true"]');
      if (ce instanceof HTMLElement) return ce;
    }

    // Try from current selection
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
   * Support both textarea and contenteditable (rich editor).
   * @param {EventTarget|null} target
   * @returns {HTMLElement|null}
   */
  function getEditorFromTarget(target) {
    if (!(target instanceof HTMLElement)) return null;

    // 1) Direct textarea
    if (target.tagName === "TEXTAREA") return target;

    // 2) Direct contenteditable
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
    console.log("[REP] insertEmoji()", { emoji, hasEditor: !!activeEditor });
    console.log(
      "[REP] editor connected?",
      activeEditor?.isConnected,
      activeEditor,
    );

    // contenteditable insertion (new Reddit)
    const editor = getLiveEditor ? getLiveEditor() : activeEditor;
    if (!editor) return;
    activeEditor = editor;

    editor.focus?.();

    const ok = document.execCommand("insertText", false, emoji);

    if (ok) {
      try {
        const sel2 = window.getSelection();
        if (sel2 && sel2.rangeCount) {
          savedRange = sel2.getRangeAt(0).cloneRange();
        }
      } catch {}
      return; // 🔥 IMPORTANT: stop here if it worked
    }

    const sel = window.getSelection();
    if (!sel) return;

    // Restore saved caret if it’s still valid
    if (savedRange) {
      try {
        if (editor.contains(savedRange.startContainer)) {
          sel.removeAllRanges();
          sel.addRange(savedRange);
        }
      } catch {
        // ignore
      }
    }

    // Ensure we have a range inside editor (fallback = END, not start)
    let range;
    if (sel.rangeCount && sel.anchorNode && editor.contains(sel.anchorNode)) {
      range = sel.getRangeAt(0);
    } else {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    // Insert
    range.deleteContents();
    const node = document.createTextNode(emoji);
    range.insertNode(node);

    // Move caret after
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    // Save for next time
    savedRange = range.cloneRange();

    // Notify React/editor once
    editor.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
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
