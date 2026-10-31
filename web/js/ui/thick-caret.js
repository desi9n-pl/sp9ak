/**
 * Chrome draws the text caret 1px wide and CSS cannot make it thicker (`caret-shape` only offers
 * a block or an underscore), so it is easy to lose in the text. The native caret is made transparent
 * and a thicker bar is drawn over the field instead, at the position measured on a hidden copy
 * of the text that wraps the same way. Shown only while the field has the focus and nothing is selected.
 */
const COPIED_STYLES = [
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'fontStretch',
    'lineHeight', 'letterSpacing', 'wordSpacing', 'textTransform', 'textIndent', 'tabSize',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
];

export class ThickCaret {
    #frame = 0;

    constructor(el) {
        this.el = el;
        this.bar = document.createElement('div');
        this.bar.className = 'thick-caret';
        this.bar.setAttribute('aria-hidden', 'true');
        this.bar.hidden = true;
        el.after(this.bar);
        el.classList.add('has-thick-caret');

        this.mirror = document.createElement('div');
        this.mirror.className = 'thick-caret-mirror';
        this.mirror.setAttribute('aria-hidden', 'true');
        document.body.append(this.mirror);

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
        const { el, bar } = this;
        const collapsed = el.selectionStart === el.selectionEnd;
        if (document.activeElement !== el || !collapsed) {
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
        const { el, mirror } = this;
        const style = getComputedStyle(el);
        for (const name of COPIED_STYLES) mirror.style[name] = style[name];
        const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        mirror.style.width = `${el.clientWidth - padding}px`;

        const marker = document.createElement('span');
        // a zero-width space gives the marker the height of one line at the caret
        marker.textContent = '​';
        mirror.replaceChildren(el.value.slice(0, position), marker, el.value.slice(position));
        return { left: marker.offsetLeft, top: marker.offsetTop, height: marker.offsetHeight };
    }
}
