/** Parsing of the model's `[[original|suggestion]]` markup into reviewable segments. */

const MARKER = /\[\[([^|\]]*?)(?:\|([^\]]*))?\]\]/g;

/**
 * Splits a response into plain text and suspect segments. A marker without
 * a suggestion (the model dropped the `|`) becomes a suspect with an empty one.
 */
export function parseSemanticResponse(response) {
    const segments = [];
    let cursor = 0;
    for (const match of response.matchAll(MARKER)) {
        if (match.index > cursor) segments.push({ kind: 'text', text: response.slice(cursor, match.index) });
        segments.push({
            kind: 'suspect',
            original: match[1].trim(),
            suggestion: (match[2] ?? '').trim(),
            accepted: false,
        });
        cursor = match.index + match[0].length;
    }
    if (cursor < response.length) segments.push({ kind: 'text', text: response.slice(cursor) });
    return segments;
}

/** Joins segments back into text, taking each suggestion the user accepted. */
export function buildSemanticText(segments) {
    return segments
        .map(s => (s.kind === 'text' ? s.text : s.accepted ? s.suggestion : s.original))
        .join('');
}
