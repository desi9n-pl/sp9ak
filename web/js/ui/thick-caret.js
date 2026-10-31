/**
 * Chrome draws the text caret 1px wide and CSS cannot make it thicker (`caret-shape` only offers
 * a block or an underscore), so it is easy to lose in the text. The native caret is made transparent
 * and a thicker bar is drawn over the field instead, at the position measured on a hidden copy
 * of the text that wraps the same way. Shown only while the field has the focus and nothing is selected.
 *
 * The copy is kept between measurements and only the edited part of it is replaced, and the caret is read
 * with a Range instead of an inserted marker: re-laying out a long dictated text on every keystroke made typing lag.
 * Very long texts still cost about as much as the field's own layout, so above MAX_LENGTH the native caret
 * comes back; it also comes back for good if a measurement ever fails, so the field never loses its caret.
 */
export const MAX_LENGTH = 20000;

const COPIED_STYLES = [
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'fontStretch',
    'lineHeight', 'letterSpacing', 'wordSpacing', 'textTransform', 'textIndent', 'tabSize',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
];

export class ThickCaret {
    #frame = 0;
    #failed = false;

    constructor(el, { log } = {}) {
        this.el = el;
        this.log = log;
        this.bar = document.createElement('div');
        this.bar.className = 'thick-caret';
        this.bar.setAttribute('aria-hidden', 'true');
        this.bar.hidden = true;
        el.after(this.bar);
        el.classList.add('has-thick-caret');

        this.mirror = document.createElement('div');
        this.mirror.className = 'thick-caret-mirror';
        this.mirror.setAttribute('aria-hidden', 'true');
        this.text = document.createTextNode('');
        // gives the line after a trailing newline (and an empty field) a height, as the field shows it
        this.end = document.createTextNode('\u200b');
        this.mirror.append(this.text, this.end);
        document.body.append(this.mirror);
        this.range = document.createRange();

        for (const type of ['selectionchange', 'input', 'scroll', 'focus', 'blur']) {
            el.addEventListener(type, () => this.schedule());
        }
        // text and caret set from code (dictation, history) do not always fire the events above
        document.addEventListener('selectionchange', () => this.schedule());
        globalThis.ResizeObserver && new ResizeObserver(() => this.schedule()).observe(el);
    }

    /** Measures once per frame, however many events came in. */
    schedule() {
        if (this.#frame) return;
        const run = () => { this.#frame = 0; this.update(); };
        this.#frame = globalThis.requestAnimationFrame ? requestAnimationFrame(run) : setTimeout(run);
    }

    update() {
        if (this.#failed) return;
        try {
            this.#update();
        } catch (error) {
            this.#failed = true;
            this.bar.hidden = true;
            this.el.classList.remove('has-thick-caret');
            this.log?.warn('Gruba karetka wyłączona, zostaje zwykła', String(error));
        }
    }

    #update() {
        const { el, bar } = this;
        const native = el.value.length > MAX_LENGTH;
        el.classList.toggle('has-thick-caret', !native);
        const collapsed = el.selectionStart === el.selectionEnd;
        if (native || document.activeElement !== el || !collapsed) {
            bar.hidden = true;
            return;
        }
        const { left, top, height } = this.#measure(el.selectionStart);
        const x = el.offsetLeft + el.clientLeft + left - el.scrollLeft;
        const y = el.offsetTop + el.clientTop + top - el.scrollTop;
        // scrolled out of the visible part of the field
        const above = y + height < el.offsetTop + el.clientTop;
        const below = y >= el.offsetTop + el.clientTop + el.clientHeight;
        bar.hidden = above || below;
        if (bar.hidden) return;
        bar.style.transform = `translate(${x}px, ${y}px)`;
        bar.style.height = `${height}px`;
        // restart the blink, so the caret stays visible while it moves, like the native one
        bar.classList.remove('blink');
        void bar.offsetWidth;
        bar.classList.add('blink');
    }

    /** Caret position inside the field's padding box, without scrolling. */
    #measure(position) {
        const { el, mirror, range } = this;
        const style = getComputedStyle(el);
        for (const name of COPIED_STYLES) {
            if (mirror.style[name] !== style[name]) mirror.style[name] = style[name];
        }
        const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        const width = `${el.clientWidth - padding}px`;
        if (mirror.style.width !== width) mirror.style.width = width;
        this.#sync(el.value);

        if (position < el.value.length) range.setStart(this.text, position);
        else range.setStart(this.end, 0);
        range.collapse(true);
        let caret = range.getClientRects()[0];
        if (!caret) {
            // a collapsed range on an empty line has no box; the newline that ends the line has one
            range.setEnd(this.text, position + 1);
            caret = range.getClientRects()[0] ?? range.getBoundingClientRect();
        }
        const box = mirror.getBoundingClientRect();
        return { left: caret.left - box.left, top: caret.top - box.top, height: caret.height };
    }

    /** Brings the copy up to date by replacing only what differs between the old and the new text. */
    #sync(value) {
        const old = this.text.data;
        if (old === value) return;
        let start = 0;
        const shorter = Math.min(old.length, value.length);
        while (start < shorter && old.charCodeAt(start) === value.charCodeAt(start)) start++;
        let tail = 0;
        while (tail < shorter - start
            && old.charCodeAt(old.length - 1 - tail) === value.charCodeAt(value.length - 1 - tail)) tail++;
        this.text.replaceData(start, old.length - start - tail, value.slice(start, value.length - tail));
    }
}
