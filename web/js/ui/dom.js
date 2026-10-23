/** Element lookup that fails loudly: a missing id is a markup bug, not something to guard against. */
export function byId(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element #${id}`);
    return el;
}
