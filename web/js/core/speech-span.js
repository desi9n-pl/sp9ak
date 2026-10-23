/**
 * The slice of the text field currently owned by the speech recognizer.
 * Updating it rewrites only that slice, so text typed before or after it survives.
 */
export class SpeechSpan {
    start = 0;
    length = 0;
    final = '';
    interim = '';

    /** Starts a fresh span at `position`. */
    begin(position) {
        this.start = position;
        this.length = 0;
        this.final = '';
        this.interim = '';
    }

    /** Returns the field value with the span replaced, and where the caret belongs. */
    apply(currentValue, final, interim) {
        const end = Math.min(this.start + this.length, currentValue.length);
        const speech = (final + interim).replace(/ {2,}/g, ' ');
        this.length = speech.length;
        this.final = final;
        this.interim = interim;
        return {
            value: currentValue.slice(0, this.start) + speech + currentValue.slice(end),
            caret: this.start + final.length,
        };
    }

    /** Turns the pending interim result into final text. Returns false if there was none. */
    commitInterim() {
        if (!this.interim) return false;
        this.final += `${this.interim} `;
        this.interim = '';
        return true;
    }
}

/**
 * Where a new dictation begins. The live caret wins (it survives focus loss);
 * the remembered one is only a fallback when the caret is unknown.
 */
export function resolveStartPosition(caret, remembered, valueLength) {
    const position = Number.isInteger(caret) ? caret : remembered;
    return Math.max(0, Math.min(Number.isInteger(position) ? position : valueLength, valueLength));
}
