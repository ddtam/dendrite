'use strict';
/*
 * Dendrite's pure core: everything that decides what is written to a note,
 * kept free of Obsidian so it can be tested in node. main.js wires it to
 * the vault and the view.
 *
 * The document model. A manuscript is an INDEX note whose body holds a
 * nested list of links, one per card, nesting giving the tree:
 *
 *     - [[R01-7kq2m|Aims]]
 *         - [[R01-c4x9p|Aim 1 rationale]]
 *
 * A CARD is an ordinary note named by an ID, `<prefix>-<suffix>`. The
 * index and the cards are the whole document; nothing about it is stored
 * anywhere else, so it survives the plugin.
 */

const INDENT = '    ';
const ITEM = /^(\s*)[-*+]\s+\[\[([^\]|#]+)(?:\|([^\]]*))?\]\]\s*$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const PREFIX = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;
const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const ID_LEN = 5;
const LABEL_WORDS = 8;

/** Split a note into its frontmatter block (kept verbatim) and body. */
function splitFrontmatter(text) {
    const m = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
    if (!m) return { fm: '', body: text };
    return { fm: m[0], body: text.slice(m[0].length) };
}

function makeNode(id, label, parent) {
    return { id, label: label || '', children: [], parent };
}

function makeRoot() {
    return makeNode(null, '', null);
}

/**
 * Parse an index body. The tree is the first run of link items; text
 * before and after it is kept verbatim, so a heading or a note to self in
 * the index survives every write. Blank lines inside the run are allowed.
 */
function parseIndex(body) {
    const lines = body.split('\n');
    let start = -1;
    let end = -1;
    for (let i = 0; i < lines.length; i++) {
        if (ITEM.test(lines[i])) {
            if (start < 0) start = i;
            end = i;
        } else if (start >= 0 && lines[i].trim() !== '') {
            break;
        }
    }
    const root = makeRoot();
    if (start < 0) {
        return { root, before: body, after: '' };
    }
    // The indent unit is the smallest non-zero indent, so tabs, two
    // spaces and four spaces all read; a jump of more than one level
    // under a parent is clamped to its child.
    const items = [];
    let unit = Infinity;
    for (let i = start; i <= end; i++) {
        const m = ITEM.exec(lines[i]);
        if (!m) continue;
        const width = m[1].replace(/\t/g, INDENT).length;
        if (width > 0) unit = Math.min(unit, width);
        items.push({ width, id: m[2].trim(), label: (m[3] || '').trim() });
    }
    if (!isFinite(unit)) unit = INDENT.length;
    const stack = [root];
    for (const it of items) {
        let depth = Math.round(it.width / unit);
        depth = Math.min(depth, stack.length - 1);
        stack.length = depth + 1;
        const parent = stack[depth];
        const node = makeNode(it.id, it.label, parent);
        parent.children.push(node);
        stack.push(node);
    }
    const before = lines.slice(0, start).join('\n');
    const after = lines.slice(end + 1).join('\n');
    return {
        root,
        before: start > 0 ? before + '\n' : '',
        after: end + 1 < lines.length ? '\n' + after : '',
    };
}

function cleanLabel(label) {
    return String(label || '').replace(/[[\]|\n\r]/g, ' ')
        .replace(/\s+/g, ' ').trim();
}

function serialiseTree(root) {
    const out = [];
    const walk = (node, depth) => {
        for (const c of node.children) {
            const label = cleanLabel(c.label);
            out.push(INDENT.repeat(depth) + '- [[' + c.id +
                     (label ? '|' + label : '') + ']]');
            walk(c, depth + 1);
        }
    };
    walk(root, 0);
    return out.join('\n');
}

/** Rebuild an index note's text around a new tree, keeping the rest. */
function writeIndexText(text, root) {
    const { fm, body } = splitFrontmatter(text);
    const p = parseIndex(body);
    let before = p.before;
    if (!p.root.children.length && before && !before.endsWith('\n')) {
        before += '\n';
    }
    const list = serialiseTree(root);
    const after = p.root.children.length ? p.after : '';
    return fm + before + list + (list && !after ? '\n' : '') + after;
}

/**
 * A card's label: its heading line, else its first alias, else its first
 * words. Derived each time and never written into the card.
 */
function deriveLabel(body, aliases) {
    const lines = stripComments(body || '').split('\n')
        .map((l) => l.trim()).filter(Boolean);
    const first = lines[0] || '';
    const h = HEADING.exec(first);
    if (h) return cleanLabel(h[2]);
    const alias = Array.isArray(aliases) ? aliases[0] :
        (typeof aliases === 'string' ? aliases : null);
    if (alias) return cleanLabel(alias);
    if (!first) return '';
    const words = first.replace(/[*_`>#~=]/g, '')
        .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .split(/\s+/).filter(Boolean);
    const cut = words.slice(0, LABEL_WORDS).join(' ');
    return cleanLabel(words.length > LABEL_WORDS ? cut + '…' : cut);
}

/** Obsidian comments are planning beside the prose; export drops them. */
function stripComments(text) {
    return text.replace(/%%[\s\S]*?%%/g, '');
}

function validPrefix(prefix) {
    return PREFIX.test(prefix || '');
}

/**
 * A new card ID. The suffix is random rather than a running number so two
 * computers adding cards while out of sync cannot both create the same
 * file; `taken` says whether an ID is already in use here.
 */
function newId(prefix, taken, rand = Math.random) {
    for (let tries = 0; tries < 1000; tries++) {
        let s = '';
        for (let i = 0; i < ID_LEN; i++) {
            s += ID_CHARS[Math.floor(rand() * ID_CHARS.length)];
        }
        const id = prefix + '-' + s;
        if (!taken(id)) return id;
    }
    throw new Error('Dendrite: could not find a free card ID');
}

// ---- tree operations ----------------------------------------------------
// Each mutates the tree in place and returns true if anything changed.

function indexOf(node) {
    return node.parent.children.indexOf(node);
}

function insertSibling(node, newNode, below) {
    const sibs = node.parent.children;
    newNode.parent = node.parent;
    sibs.splice(indexOf(node) + (below ? 1 : 0), 0, newNode);
    return true;
}

function appendChild(parent, newNode) {
    newNode.parent = parent;
    parent.children.push(newNode);
    return true;
}

function moveWithin(node, delta) {
    const sibs = node.parent.children;
    const i = indexOf(node);
    const j = i + delta;
    if (j < 0 || j >= sibs.length) return false;
    sibs.splice(i, 1);
    sibs.splice(j, 0, node);
    return true;
}

/** Become the last child of the sibling above. */
function indent(node) {
    const i = indexOf(node);
    if (i === 0) return false;
    const target = node.parent.children[i - 1];
    node.parent.children.splice(i, 1);
    node.parent = target;
    target.children.push(node);
    return true;
}

/** Become the sibling just after the parent. */
function outdent(node) {
    const parent = node.parent;
    if (!parent.parent) return false;
    parent.children.splice(indexOf(node), 1);
    const gp = parent.parent;
    gp.children.splice(gp.children.indexOf(parent) + 1, 0, node);
    node.parent = gp;
    return true;
}

/**
 * Merge a card into the one above it: the card's children follow its
 * text to the end of that card's children. Returns the card merged into,
 * or null when there is no card above.
 */
function mergeIntoAbove(node) {
    const i = indexOf(node);
    if (i === 0) return null;
    const target = node.parent.children[i - 1];
    for (const c of node.children.slice()) appendChild(target, c);
    node.children = [];
    remove(node);
    return target;
}

/**
 * Merge a card into its parent: its children take its place among the
 * parent's children. Returns the parent, or null for a top-level card.
 */
function mergeIntoParent(node) {
    const parent = node.parent;
    if (!parent.id) return null;
    const i = indexOf(node);
    for (const c of node.children) c.parent = parent;
    parent.children.splice(i, 1, ...node.children);
    node.children = [];
    return parent;
}

function remove(node) {
    node.parent.children.splice(indexOf(node), 1);
    return true;
}

function descendants(node) {
    const out = [];
    const walk = (n) => {
        for (const c of n.children) {
            out.push(c);
            walk(c);
        }
    };
    walk(node);
    return out;
}

function allNodes(root) {
    return descendants(root);
}

/** Nodes grouped by depth, each column in reading order. */
function columns(root) {
    const cols = [];
    const walk = (n, d) => {
        for (const c of n.children) {
            c.depth = d;
            (cols[d] = cols[d] || []).push(c);
            walk(c, d + 1);
        }
    };
    walk(root, 0);
    return cols;
}

// ---- export ---------------------------------------------------------------

/**
 * Assemble a manuscript. A card with children is a section: its heading
 * line is exported at the level its depth gives, and its other text is
 * planning and is dropped. A card with no children is prose and is
 * exported whole, its own heading line, if any, re-levelled the same way.
 * Comments are dropped everywhere. `bodyOf(id)` returns a card's body.
 */
function exportMarkdown(nodes, bodyOf, headingTop, numbers) {
    const top = Math.max(1, Math.min(6, headingTop || 1));
    const blocks = [];
    let current = null;
    const heading = (text, depth) => '#'.repeat(Math.min(6, top + depth)) +
        ' ' + (numbers && numbers.has(current) ?
            numbers.get(current) + ' ' : '') + text;
    const walk = (node, depth) => {
        current = node.id;
        const body = stripComments(bodyOf(node.id) || '').trim();
        const lines = body ? body.split('\n') : [];
        const h = lines.length ? HEADING.exec(lines[0].trim()) : null;
        if (node.children.length) {
            if (h) blocks.push(heading(h[2], depth));
            for (const c of node.children) walk(c, depth + 1);
        } else if (h) {
            blocks.push(heading(h[2], depth));
            const rest = lines.slice(1).join('\n').trim();
            if (rest) blocks.push(rest);
        } else if (body) {
            blocks.push(body);
        }
    };
    for (const n of nodes) walk(n, 0);
    return blocks.join('\n\n') + (blocks.length ? '\n' : '');
}

/**
 * Section numbers by position, as LaTeX numbers them: every card whose
 * text opens with a heading is numbered among its siblings that do, so
 * moving a section renumbers it. `hasHeading(id)` says which cards do.
 * Returns id -> `1.`, `1.2` and so on.
 */
function sectionNumbers(roots, hasHeading) {
    const out = new Map();
    const walk = (nodes, prefix) => {
        let i = 0;
        for (const n of nodes) {
            if (hasHeading(n.id)) {
                i += 1;
                const num = prefix ? `${prefix}.${i}` : String(i);
                out.set(n.id, prefix ? num : num + '.');
                walk(n.children, num);
            } else {
                walk(n.children, prefix);
            }
        }
    };
    walk(roots, '');
    return out;
}

// ---- splitting and merging card text -------------------------------------

/**
 * Cut a card's text for a move to a new card. With a selection, the
 * selection moves; with a bare cursor, everything after it moves. The
 * text left behind is closed up so the cut leaves no run of blank lines.
 * Returns { keep, moved, at }, `at` being where the moved text was in
 * `keep`, or null when there is nothing to move.
 */
function splitText(body, start, end) {
    const a = Math.min(start, end);
    const b = start === end ? body.length : Math.max(start, end);
    const moved = body.slice(a, b).trim();
    if (!moved) return null;
    const before = body.slice(0, a);
    const after = body.slice(b);
    let keep;
    let at;
    if (!after.trim()) {
        keep = before.replace(/\s+$/, '');
        at = keep.length;
    } else if (!before.trim()) {
        keep = after.replace(/^\s+/, '');
        at = 0;
    } else if (/\n\s*$/.test(before) || /^\s*\n/.test(after)) {
        // The cut fell between lines: close up to one blank line.
        keep = before.replace(/\s+$/, '') + '\n\n' +
            after.replace(/^\s+/, '');
        at = before.replace(/\s+$/, '').length;
    } else {
        // The cut fell inside a line: join the two halves with a space.
        keep = before.replace(/[ \t]+$/, '') + ' ' +
            after.replace(/^[ \t]+/, '');
        at = before.replace(/[ \t]+$/, '').length;
    }
    return { keep, moved, at };
}

/** One card's text after another's, separated by a blank line. */
function mergeText(first, second) {
    const a = (first || '').replace(/\s+$/, '');
    const b = (second || '').replace(/^\s+/, '');
    return a && b ? a + '\n\n' + b : a || b;
}

// ---- column alignment ----------------------------------------------------

/**
 * Where each column scrolls to, Gingko-style. The active card's column
 * centres it, and each column to its left centres the ancestor it holds.
 * A column to the right centres the active card's descendants it holds;
 * if it holds none, it top-aligns a group of children with that group's
 * parent, choosing the parent nearest the previous column's anchor, so
 * children always sit beside their parent.
 *
 * `cols` is columns(root); `pos(id)` gives a card's { top, height } in
 * its column; `heights[d]` is column d's visible height. Returns the
 * scrollTop for each column, or null to leave a column alone.
 */
function alignColumns(cols, active, pos, heights) {
    const targets = cols.map(() => null);
    if (!active) return targets;
    const lineage = new Set([active.id]);
    for (let n = active.parent; n && n.id; n = n.parent) lineage.add(n.id);
    for (const d of descendants(active)) lineage.add(d.id);
    const centre = (nodes, d) => {
        const a = pos(nodes[0].id);
        const b = pos(nodes[nodes.length - 1].id);
        if (!a || !b) return null;
        return (a.top + b.top + b.height) / 2 - heights[d] / 2;
    };
    const anchor = [];
    for (let d = 0; d < cols.length; d++) {
        const inCol = cols[d].filter((n) => lineage.has(n.id));
        if (d === active.depth) {
            targets[d] = centre([active], d);
            anchor[d] = active;
        } else if (inCol.length) {
            targets[d] = centre(inCol, d);
            anchor[d] = inCol[0];
        } else if (d > active.depth && anchor[d - 1] &&
                   targets[d - 1] !== null) {
            const prev = cols[d - 1];
            const at = prev.indexOf(anchor[d - 1]);
            let best = null;
            prev.forEach((n, i) => {
                if (!n.children.length) return;
                const dist = Math.abs(i - at);
                if (!best || dist < best.dist) best = { n, dist };
            });
            if (!best) continue;
            const parent = pos(best.n.id);
            const first = pos(best.n.children[0].id);
            if (!parent || !first) continue;
            const onScreen = parent.top - targets[d - 1];
            targets[d] = first.top - onScreen;
            anchor[d] = best.n.children[0];
        }
    }
    return targets;
}

/**
 * The flow as one SVG path, so the bands and the tinted groups they open
 * into are filled once where they overlap, never doubled. Each pair is a
 * card's box and the box of the group holding its children, in the SVG's
 * coordinates, each with its corner radius `r`. The band leaves the card
 * from the straight part of its right edge, tucked under it, and enters
 * the group's straight left edge; the group is a rounded rectangle. All
 * subpaths run clockwise, so the nonzero fill joins them as one shape.
 */
function flowPath(pairs) {
    const f = (x) => Math.round(x * 10) / 10;
    const parts = [];
    for (const { card: a, group: b } of pairs) {
        const ra = Math.min(a.r || 0, (a.bottom - a.top) / 2);
        const rb = Math.min(b.r || 0, (b.right - b.left) / 2,
                            (b.bottom - b.top) / 2);
        const x1 = a.right - 1;
        const x2 = b.left + rb;
        const at = a.top + ra;
        const ab = a.bottom - ra;
        const bt = b.top + rb;
        const bb = b.bottom - rb;
        const mx = (a.right + b.left) / 2;
        parts.push(`M${f(x1)},${f(at)} C${f(mx)},${f(at)} ${f(mx)},${f(bt)} ` +
                   `${f(x2)},${f(bt)} L${f(x2)},${f(bb)} C${f(mx)},${f(bb)} ` +
                   `${f(mx)},${f(ab)} ${f(x1)},${f(ab)} Z`);
        // The group, a rounded rectangle, clockwise from its top left.
        const [l, r, t, btm] = [b.left, b.right, b.top, b.bottom];
        parts.push(`M${f(l + rb)},${f(t)} H${f(r - rb)} ` +
                   `A${f(rb)},${f(rb)} 0 0 1 ${f(r)},${f(t + rb)} ` +
                   `V${f(btm - rb)} ` +
                   `A${f(rb)},${f(rb)} 0 0 1 ${f(r - rb)},${f(btm)} ` +
                   `H${f(l + rb)} ` +
                   `A${f(rb)},${f(rb)} 0 0 1 ${f(l)},${f(btm - rb)} ` +
                   `V${f(t + rb)} ` +
                   `A${f(rb)},${f(rb)} 0 0 1 ${f(l + rb)},${f(t)} Z`);
    }
    return parts.join(' ');
}

/**
 * The thread: one band per step of the active card's path, from a card
 * to the specific card it leads to in the next column, so which card a
 * card came from is unambiguous however deep the path. Each pair is two
 * card boxes; each band runs from the straight part of one card's right
 * edge to the straight part of the next card's left edge, tucked under
 * both.
 */
function threadPath(pairs) {
    const f = (x) => Math.round(x * 10) / 10;
    const parts = [];
    for (const { from: a, to: b } of pairs) {
        const ra = Math.min(a.r || 0, (a.bottom - a.top) / 2);
        const rb = Math.min(b.r || 0, (b.bottom - b.top) / 2);
        const x1 = a.right - 1;
        const x2 = b.left + 1;
        const mx = (a.right + b.left) / 2;
        const [at, ab] = [a.top + ra, a.bottom - ra];
        const [bt, bb] = [b.top + rb, b.bottom - rb];
        parts.push(`M${f(x1)},${f(at)} C${f(mx)},${f(at)} ${f(mx)},${f(bt)} ` +
                   `${f(x2)},${f(bt)} L${f(x2)},${f(bb)} C${f(mx)},${f(bb)} ` +
                   `${f(mx)},${f(ab)} ${f(x1)},${f(ab)} Z`);
    }
    return parts.join(' ');
}

// ---- limits and counts ---------------------------------------------------

// An amount, which may be a fraction, then a unit.
const NUM = '\\d+(?:\\.\\d+)?';
const LIMIT = new RegExp(`^\\s*(${NUM}(?:\\s*/\\s*${NUM})?)\\s*` +
                         '(words?|characters?|chars?|pages?)\\s*$', 'i');

/** `12`, `0.5` or `1/4` as a number; NaN if unreadable. */
function parseAmount(text) {
    const parts = String(text).split('/').map((s) => Number(s.trim()));
    if (parts.length === 1) return parts[0];
    if (parts.length === 2 && parts[1]) return parts[0] / parts[1];
    return NaN;
}

/**
 * `500 words`, `2000 characters`, `1 page`, `1/4 page`; null if unset or
 * unreadable.
 */
function parseLimit(value) {
    if (value === null || value === undefined || value === '') return null;
    const m = LIMIT.exec(String(value));
    if (!m) return null;
    const amount = parseAmount(m[1]);
    if (!(amount > 0)) return null;
    const u = m[2].toLowerCase();
    const unit = u.startsWith('w') ? 'words' :
        (u.startsWith('p') ? 'pages' : 'characters');
    return { amount, unit };
}

/** A number for display: whole, or up to two decimals. */
function fmtNum(x) {
    return Number.isInteger(x) ? x.toLocaleString() :
        String(Math.round(x * 100) / 100);
}

function formatLimit(limit) {
    if (!limit) return '';
    const one = limit.amount === 1;
    const unit = limit.unit === 'pages' ? (one ? 'page' : 'pages') :
        limit.unit === 'words' ? (one ? 'word' : 'words') :
            (one ? 'character' : 'characters');
    return `${fmtNum(limit.amount)} ${unit}`;
}

/**
 * An amount in another unit. Pages convert through words per page and
 * characters through characters per word; both are estimates, so the
 * result says whether one was used.
 */
function convert(amount, from, to, wordsPerPage, charsPerWord) {
    if (from === to) return { value: amount, estimated: false };
    const wpp = wordsPerPage || 500;
    const cpw = charsPerWord || 6;
    const words = from === 'words' ? amount :
        from === 'pages' ? amount * wpp : amount / cpw;
    const value = to === 'words' ? words :
        to === 'pages' ? words / wpp : words * cpw;
    return { value, estimated: true };
}

/**
 * Quotas that waterfall down the tree. Each card with a quota is
 * measured against it, and against it are set the quotas of its nearest
 * descendants that carry one, its allocations. The manuscript's total,
 * if any, is the quota of the root.
 *
 * `quotaOf(id)` gives { amount, unit, required } or null; `countOf(nodes)`
 * gives { words, chars } for what export would write for those nodes.
 * Returns id -> report, with the root's under null:
 *   { quota, used, usedEstimated, allocated, allocatedEstimated, parts }
 * where allocated is null when nothing below carries a quota.
 */
function quotas(root, quotaOf, countOf, opts = {}) {
    const wpp = opts.wordsPerPage || 500;
    const cpw = opts.charsPerWord || 6;
    const out = new Map();
    const nearest = (node) => {
        const found = [];
        for (const c of node.children) {
            if (quotaOf(c.id)) found.push(c);
            else found.push(...nearest(c));
        }
        return found;
    };
    const report = (node, quota) => {
        const nodes = node.id ? [node] : node.children;
        const n = countOf(nodes);
        const used = measure(n, quota.unit, wpp);
        const parts = nearest(node);
        let allocated = null;
        let allocatedEstimated = false;
        if (parts.length) {
            allocated = 0;
            for (const p of parts) {
                const q = quotaOf(p.id);
                const c = convert(q.amount, q.unit, quota.unit, wpp, cpw);
                allocated += c.value;
                allocatedEstimated = allocatedEstimated || c.estimated;
            }
        }
        return { quota, used, usedEstimated: quota.unit === 'pages',
                 allocated, allocatedEstimated,
                 parts: parts.map((p) => p.id) };
    };
    if (opts.total) out.set(null, report(root, opts.total));
    for (const n of allNodes(root)) {
        const q = quotaOf(n.id);
        if (q) out.set(n.id, report(n, q));
    }
    return out;
}

/**
 * Words and characters in exported markdown, counting what a reader of
 * the output would see: markup, link targets and list markers are left
 * out, and a citation key counts as one word, since what it becomes
 * depends on the citation style.
 */
function countText(markdown, countSpaces) {
    const plain = stripComments(markdown)
        .replace(/!\[\[[^\]]*\]\]/g, ' ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[(@[^\]]+)\]/g, 'cite')
        .replace(/^\s{0,3}#{1,6}\s+/gm, '')
        .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[.\]\s+)?/gm, '')
        .replace(/^\s*>\s?/gm, '')
        .replace(/[*_`~=]+/g, '');
    const words = (plain.match(/\S+/g) || []).length;
    const collapsed = plain.replace(/\s+/g, ' ').trim();
    const chars = countSpaces ? collapsed.length :
        collapsed.replace(/ /g, '').length;
    return { words, chars };
}

/** A count in a limit's unit; pages are words over a words-per-page. */
function measure(count, unit, wordsPerPage) {
    if (unit === 'words') return count.words;
    if (unit === 'characters') return count.chars;
    return count.words / (wordsPerPage || 500);
}

module.exports = {
    parseLimit, formatLimit, countText, measure, sectionNumbers,
    alignColumns, parseAmount, convert, quotas, fmtNum,
    splitText, mergeText,
    mergeIntoAbove, mergeIntoParent,
    flowPath, threadPath,
    INDENT, splitFrontmatter, parseIndex, serialiseTree, writeIndexText,
    deriveLabel, stripComments, validPrefix, newId, makeNode, makeRoot,
    insertSibling, appendChild, moveWithin, indent, outdent, remove,
    descendants, allNodes, columns, exportMarkdown, cleanLabel,
};
