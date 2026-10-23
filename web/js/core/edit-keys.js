/** Decides whether a key press tries to change text (selecting, navigating and copying do not). */

const EDITING_KEYS = new Set(['Backspace', 'Delete', 'Enter']);
const EDITING_CTRL_SHORTCUTS = new Set(['x', 'v', 'z', 'y']);

export function isEditKey({ key, ctrlKey = false, metaKey = false, altKey = false } = {}) {
    if (!key) return false;
    if (ctrlKey || metaKey) return EDITING_CTRL_SHORTCUTS.has(key.toLowerCase());
    if (altKey) return false;
    return EDITING_KEYS.has(key) || key.length === 1;
}
