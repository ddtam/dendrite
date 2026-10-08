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

// ---- limits and counts ---------------------------------------------------

const LIMIT = /^\s*(\d+(?:\.\d+)?)\s*(words?|characters?|chars?|pages?)\s*$/i;

/** `500 words`, `2000 characters`, `1 page`; null if unset or unreadable. */
function parseLimit(value) {
    if (value === null || value === undefined || value === '') return null;
    const m = LIMIT.exec(String(value));
    if (!m) return null;
    const u = m[2].toLowerCase();
    const unit = u.startsWith('w') ? 'words' :
        (u.startsWith('p') ? 'pages' : 'characters');
    return { amount: Number(m[1]), unit };
}

function formatLimit(limit) {
    if (!limit) return '';
    const one = limit.amount === 1;
    const unit = limit.unit === 'pages' ? (one ? 'page' : 'pages') :
        limit.unit === 'words' ? (one ? 'word' : 'words') :
            (one ? 'character' : 'characters');
    return `${limit.amount} ${unit}`;
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
    INDENT, splitFrontmatter, parseIndex, serialiseTree, writeIndexText,
    deriveLabel, stripComments, validPrefix, newId, makeNode, makeRoot,
    insertSibling, appendChild, moveWithin, indent, outdent, remove,
    descendants, allNodes, columns, exportMarkdown, cleanLabel,
};
