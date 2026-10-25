/**
 * A button clicked with the mouse keeps the focus, and the first keystroke afterwards (Esc, Ctrl+D, typing)
 * makes the browser draw the keyboard focus ring on it, far from where the user is writing.
 * After a mouse click the focus goes back to the text field. Keyboard activation (Enter or Space,
 * `event.detail === 0`) is left alone, so keyboard users keep their place; so is anything inside a dialog.
 */
export function installPointerFocus({ editor, root = document }) {
    root.addEventListener('click', event => {
        if (event.detail === 0) return;
        const button = event.target.closest?.('button');
        if (!button || button.closest('[role="dialog"], .modal-backdrop')) return;
        // the button may have just opened a dialog, which owns the focus now
        if (root.querySelector('.modal-backdrop.open')) return;
        editor.focus();
    });
}
