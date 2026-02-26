// content.js
// George Conde 2026-02-26
(() => {
  "use strict";

  /** @type {HTMLElement|null} */
  let activeEditor = null;

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

  /**
   * @param {HTMLElement|null} el
   */
  function setActiveEditor(el) {
    if (el === activeEditor) return;
    activeEditor = el;

    if (!activeEditor) {
      console.log("[REP] active editor cleared");
      return;
    }

    const type = getEditorType(activeEditor);
    console.log("[REP] active editor set:", {
      type,
      tag: activeEditor.tagName,
      id: activeEditor.id || null,
      class: activeEditor.className || null,
    });
  }

  // Focus detection
  document.addEventListener(
    "focusin",
    (e) => {
      const editor = getEditorFromTarget(e.target);
      if (editor) setActiveEditor(editor);
    },
    true,
  );

  // Clear when focus leaves the editor
  document.addEventListener(
    "focusout",
    (e) => {
      // If focus is moving within the same editor/picker later, we won’t clear here.
      // For now, keep it simple: if the outgoing target is the active editor (or inside it), clear.
      if (!activeEditor) return;

      const target = e.target instanceof HTMLElement ? e.target : null;
      const leavingEditor =
        target &&
        (target === activeEditor ||
          (target.closest && target.closest("*") === target)) && // safe no-op
        (target === activeEditor || activeEditor.contains(target));

      if (leavingEditor) {
        // Delay so we don't clear if focus goes to another element inside editor wrappers.
        setTimeout(() => {
          const now = document.activeElement;
          const stillOnEditor =
            now instanceof HTMLElement &&
            (now === activeEditor || activeEditor?.contains(now));

          if (!stillOnEditor) setActiveEditor(null);
        }, 0);
      }
    },
    true,
  );

  console.log("[REP] content script loaded");
})();
