/** Rules for what is worth keeping in the session history. */

/** Shortest text saved as a session at all. */
export const MIN_SESSION_LENGTH = 5;
/** Dictation is only auto-saved above this length, to skip accidental taps. */
export const MIN_AUTOSAVE_LENGTH = 10;

export function shouldSaveSession(text, lastSaved) {
    const trimmed = text.trim();
    return trimmed.length >= MIN_SESSION_LENGTH && trimmed !== lastSaved;
}
