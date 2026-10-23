/** Keyboard shortcuts of the page. */
export function installShortcuts({ copyAll, newNote, toggleDictation, dismiss }) {
    document.addEventListener('keydown', event => {
        const key = event.key?.toLowerCase() ?? ''; // autofill dispatches key-less events
        if (event.ctrlKey && key === 'c' && !window.getSelection()?.toString()) {
            event.preventDefault();
            copyAll();
        } else if (event.ctrlKey && key === 's') {
            event.preventDefault(); // no "Save page as…" dialog
        } else if (event.ctrlKey && key === 'n') {
            event.preventDefault();
            newNote();
        } else if (event.ctrlKey && key === 'd') {
            event.preventDefault();
            // a held-down shortcut must not toggle dictation over and over
            if (!event.repeat) toggleDictation();
        } else if (event.key === 'Escape') {
            dismiss();
        }
    });
}
