// Tests for the pure core: what Dendrite writes to notes. Run with
// `npm test`. Every write path to a note goes through these functions, so
// a change here that loses text or structure fails before a release.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const c = require('../src/core.js');

const INDEX = [
    '---',
    'dendrite_prefix: R01',
    '---',
    '# R01 grant',
    '',
    'Planning paragraph kept above the tree.',
    '',
    '- [[R01-aaaaa|Aims]]',
    '    - [[R01-bbbbb|Aim 1]]',
    '        - [[R01-ccccc|Aim 1 rationale]]',
    '    - [[R01-ddddd]]',
    '- [[R01-eeeee|Significance]]',
    '',
    'Text after the tree.',
    '',
].join('\n');

test('parse reads nesting, ids and labels', () => {
    const { body } = c.splitFrontmatter(INDEX);
    const { root, before, after } = c.parseIndex(body);
    assert.equal(root.children.length, 2);
    const aims = root.children[0];
    assert.equal(aims.id, 'R01-aaaaa');
    assert.equal(aims.label, 'Aims');
    assert.deepEqual(aims.children.map((n) => n.id),
                     ['R01-bbbbb', 'R01-ddddd']);
    assert.equal(aims.children[0].children[0].label, 'Aim 1 rationale');
    assert.equal(aims.children[1].label, '');
    assert.match(before, /Planning paragraph/);
    assert.match(after, /Text after the tree/);
});

test('an unchanged tree rewrites the index byte for byte', () => {
    const { body } = c.splitFrontmatter(INDEX);
    const { root } = c.parseIndex(body);
    assert.equal(c.writeIndexText(INDEX, root), INDEX);
});

test('tabs and two-space indents read as nesting', () => {
    for (const ind of ['\t', '  ']) {
        const { root } = c.parseIndex(
            `- [[A-11111|a]]\n${ind}- [[A-22222|b]]\n${ind}${ind}` +
            '- [[A-33333|c]]\n- [[A-44444|d]]\n');
        assert.equal(root.children.length, 2, JSON.stringify(ind));
        assert.equal(root.children[0].children[0].children[0].id,
                     'A-33333');
    }
});

test('a write to an empty index appends the tree after its text', () => {
    const text = '---\ndendrite_prefix: X\n---\n# Title\n';
    const root = c.makeRoot();
    c.appendChild(root, c.makeNode('X-aaaaa', 'First', null));
    const out = c.writeIndexText(text, root);
    assert.equal(out, '---\ndendrite_prefix: X\n---\n# Title\n' +
                 '- [[X-aaaaa|First]]\n');
    const again = c.writeIndexText(out, c.parseIndex(
        c.splitFrontmatter(out).body).root);
    assert.equal(again, out);
});

test('labels lose characters that would break the link', () => {
    const root = c.makeRoot();
    c.appendChild(root, c.makeNode('X-aaaaa', 'a | b [c]', null));
    assert.equal(c.serialiseTree(root), '- [[X-aaaaa|a b c]]');
});

test('tree operations move nodes and keep parents consistent', () => {
    const { root } = c.parseIndex(c.splitFrontmatter(INDEX).body);
    const [aims, sig] = root.children;
    const aim1 = aims.children[0];
    const d = aims.children[1];
    assert.ok(c.moveWithin(d, -1));
    assert.deepEqual(aims.children.map((n) => n.id),
                     ['R01-ddddd', 'R01-bbbbb']);
    assert.ok(!c.moveWithin(d, -1));
    assert.ok(c.indent(aim1));
    assert.equal(aim1.parent, d);
    assert.ok(c.outdent(aim1));
    assert.equal(aim1.parent, aims);
    assert.deepEqual(aims.children.map((n) => n.id),
                     ['R01-ddddd', 'R01-bbbbb']);
    assert.ok(c.outdent(aim1));
    assert.deepEqual(root.children.map((n) => n.id),
                     ['R01-aaaaa', 'R01-bbbbb', 'R01-eeeee']);
    assert.ok(!c.outdent(sig));
    assert.ok(!c.indent(root.children[0]));
    for (const n of c.allNodes(root)) {
        assert.ok(n.parent.children.includes(n), n.id);
    }
});

test('labels come from the heading, then an alias, then first words', () => {
    assert.equal(c.deriveLabel('## Specific Aims\ntext', ['x']),
                 'Specific Aims');
    assert.equal(c.deriveLabel('Plain prose here.', ['Aim 1 rationale']),
                 'Aim 1 rationale');
    assert.equal(c.deriveLabel('One two three four five six seven ' +
                               'eight nine ten', null),
                 'One two three four five six seven eight…');
    assert.equal(c.deriveLabel('%% a note %%\nSee [[X|the paper]].', null),
                 'See the paper.');
    assert.equal(c.deriveLabel('', null), '');
});

test('IDs keep the prefix, avoid taken ones, and split at the last hyphen',
     () => {
    const seq = [0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0.5];
    let i = 0;
    const rand = () => seq[i++ % seq.length];
    const id = c.newId('GRANT-2026', (x) => x === 'GRANT-2026-aaaaa',
                       rand);
    assert.equal(id, 'GRANT-2026-sssss');
    assert.equal(id.slice(0, id.lastIndexOf('-')), 'GRANT-2026');
    assert.ok(c.validPrefix('GRANT-2026'));
    assert.ok(!c.validPrefix('GRANT 2026'));
    assert.ok(!c.validPrefix('-X'));
});

test('export: headings from sections, planning and comments dropped', () => {
    const { root } = c.parseIndex(c.splitFrontmatter(INDEX).body);
    const bodies = {
        'R01-aaaaa': '# Aims\nPlanning: two aims, one page.',
        'R01-bbbbb': '# Aim 1\nPlanning for aim 1.',
        'R01-ccccc': 'The method is %% check n %%robust.',
        'R01-ddddd': 'Untitled paragraph under Aims.',
        'R01-eeeee': '# Significance\nThe question matters.',
    };
    const out = c.exportMarkdown(root.children, (id) => bodies[id], 1);
    assert.equal(out, [
        '# Aims',
        '## Aim 1',
        'The method is robust.',
        'Untitled paragraph under Aims.',
        '# Significance',
        'The question matters.',
    ].join('\n\n') + '\n');
    // A branch exports from its own root at the top level.
    const aim1 = root.children[0].children[0];
    assert.equal(c.exportMarkdown([aim1], (id) => bodies[id], 2),
                 '## Aim 1\n\nThe method is robust.\n');
});

test('frontmatter is kept verbatim and never read as body', () => {
    const t = '---\naliases:\n  - x\n---\nBody\n';
    assert.deepEqual(c.splitFrontmatter(t),
                     { fm: '---\naliases:\n  - x\n---\n', body: 'Body\n' });
    assert.deepEqual(c.splitFrontmatter('No fm'), { fm: '', body: 'No fm' });
});

const ed = require('../src/textedit.js');
const apply = (t, r) => t.slice(0, r.start) + r.text + t.slice(r.end);

test('bold wraps the selection and unwraps it again', () => {
    const r = ed.wrap('a word b', 2, 6, '**');
    const t = apply('a word b', r);
    assert.equal(t, 'a **word** b');
    assert.equal(t.slice(r.selStart, r.selEnd), 'word');
    const back = ed.wrap(t, r.selStart, r.selEnd, '**');
    assert.equal(apply(t, back), 'a word b');
});

test('tab indents and shift-tab outdents every selected line', () => {
    const t = '- a\n- b\nc';
    const r = ed.shiftLines(t, 0, 6, false);
    const t2 = apply(t, r);
    assert.equal(t2, '    - a\n    - b\nc');
    assert.equal(apply(t2, ed.shiftLines(t2, r.selStart, r.selEnd, true)),
                 t);
    assert.equal(apply('\t- x', ed.shiftLines('\t- x', 1, 1, true)), '- x');
});

test('enter continues a list, numbers it, and ends it on an empty item',
     () => {
    const t = '- first';
    const r = ed.enter(t, t.length, t.length);
    assert.equal(apply(t, r), '- first\n- ');
    const n = '    3. third';
    assert.equal(apply(n, ed.enter(n, n.length, n.length)),
                 '    3. third\n    4. ');
    const k = '- [x] done';
    assert.equal(apply(k, ed.enter(k, k.length, k.length)),
                 '- [x] done\n- [ ] ');
    const empty = '- a\n- ';
    assert.equal(apply(empty, ed.enter(empty, empty.length, empty.length)),
                 '- a\n');
    assert.equal(ed.enter('plain', 5, 5), null);
});

test('limits parse in words, characters and pages', () => {
    assert.deepEqual(c.parseLimit('500 words'),
                     { amount: 500, unit: 'words' });
    assert.deepEqual(c.parseLimit('2000 chars'),
                     { amount: 2000, unit: 'characters' });
    assert.deepEqual(c.parseLimit('1 page'), { amount: 1, unit: 'pages' });
    assert.equal(c.parseLimit('lots'), null);
    assert.equal(c.parseLimit(''), null);
    assert.equal(c.formatLimit({ amount: 1, unit: 'pages' }), '1 page');
});

test('counts leave out markup, link targets and comments', () => {
    const md = '# Aims\n\n- The **method** is [[Note|robust]] ' +
        '[@smith2020] %% not this %%here.';
    const n = c.countText(md, true);
    assert.equal(n.words, 7);
    assert.equal(n.chars, 'Aims The method is robust cite here.'.length);
    assert.equal(c.countText(md, false).chars,
                 'AimsThemethodisrobustcitehere.'.length);
    assert.equal(c.measure({ words: 750, chars: 0 }, 'pages', 500), 1.5);
});

test('sections are numbered by position and renumber when moved', () => {
    const { root } = c.parseIndex(c.splitFrontmatter(INDEX).body);
    const heads = new Set(['R01-aaaaa', 'R01-bbbbb', 'R01-eeeee']);
    let nums = c.sectionNumbers(root.children, (id) => heads.has(id));
    assert.equal(nums.get('R01-aaaaa'), '1.');
    assert.equal(nums.get('R01-bbbbb'), '1.1');
    assert.equal(nums.get('R01-eeeee'), '2.');
    assert.equal(nums.has('R01-ccccc'), false);
    c.moveWithin(root.children[1], -1);
    nums = c.sectionNumbers(root.children, (id) => heads.has(id));
    assert.equal(nums.get('R01-eeeee'), '1.');
    assert.equal(nums.get('R01-bbbbb'), '2.1');
    const bodies = { 'R01-eeeee': '# Significance', 'R01-aaaaa': '# Aims',
                     'R01-bbbbb': '# Aim 1\nplan', 'R01-ccccc': 'Text.',
                     'R01-ddddd': '' };
    assert.equal(c.exportMarkdown(root.children, (id) => bodies[id], 1, nums),
                 '# 1. Significance\n\n# 2. Aims\n\n## 2.1 Aim 1\n\n' +
                 'Text.\n');
});

test('a column with nothing on the active path aligns children beside ' +
     'their parent', () => {
    // Column 0: A (children a1, a2), B (no children), C (child c1).
    const root = c.makeRoot();
    const [A, B, C] = ['A', 'B', 'C'].map((id) => c.makeNode(id, id, null));
    for (const n of [A, B, C]) c.appendChild(root, n);
    const [a1, a2] = ['a1', 'a2'].map((id) => c.makeNode(id, id, null));
    c.appendChild(A, a1);
    c.appendChild(A, a2);
    const c1 = c.makeNode('c1', 'c1', null);
    c.appendChild(C, c1);
    const cols = c.columns(root);
    // Each card 100 high; column 0 cards at 0, 100, 200; column 1 groups
    // a1 at 0, a2 at 100, c1 at 220.
    const top = { A: 0, B: 100, C: 200, a1: 0, a2: 100, c1: 220 };
    const pos = (id) => ({ top: top[id], height: 100 });
    // A active: its children centre in column 1.
    let t = c.alignColumns(cols, A, pos, [400, 400]);
    assert.equal(t[0], 50 - 200);
    assert.equal(t[1], 100 - 200);
    // B active, no children: the nearest parent's group is top-aligned
    // with it. A and C are equally near; the one above, A, is chosen.
    t = c.alignColumns(cols, B, pos, [400, 400]);
    assert.equal(t[0], 150 - 200);
    const aOnScreen = top.A - t[0];
    assert.equal(top.a1 - t[1], aOnScreen, 'a1 sits beside A');
    // C active: c1 centres beside it.
    t = c.alignColumns(cols, C, pos, [400, 400]);
    assert.equal(t[1], 270 - 200);
});

test('quotas: fractions, conversion and the waterfall of allocations', () => {
    assert.equal(c.parseAmount('1/4'), 0.25);
    assert.deepEqual(c.convert(0.5, 'pages', 'words', 500, 6),
                     { value: 250, estimated: true });
    assert.deepEqual(c.convert(60, 'characters', 'words', 500, 6),
                     { value: 10, estimated: true });
    assert.deepEqual(c.convert(3, 'words', 'words'),
                     { value: 3, estimated: false });

    // S3 (required, half a page) holds A and B, a quarter page each, and
    // M with no quota whose child C has 100 words.
    const root = c.makeRoot();
    const mk = (id, parent) => {
        const n = c.makeNode(id, id, null);
        c.appendChild(parent, n);
        return n;
    };
    const s3 = mk('S3', root);
    mk('A', s3);
    mk('B', s3);
    const m = mk('M', s3);
    mk('C', m);
    const q = {
        S3: { amount: 0.5, unit: 'pages', required: true },
        A: { amount: 0.25, unit: 'pages', required: false },
        B: { amount: 0.25, unit: 'pages', required: false },
        C: { amount: 100, unit: 'words', required: false },
    };
    const words = { S3: 1, A: 120, B: 80, M: 0, C: 30 };
    const countOf = (nodes) => {
        let w = 0;
        for (const n of nodes) {
            for (const x of [n, ...c.descendants(n)]) w += words[x.id];
        }
        return { words: w, chars: w * 6 };
    };
    const r = c.quotas(root, (id) => q[id] || null, countOf,
                       { wordsPerPage: 500, charsPerWord: 6,
                         total: { amount: 1, unit: 'pages' } });
    const s = r.get('S3');
    assert.deepEqual(s.parts, ['A', 'B', 'C'],
                     'the nearest quotas below, through M');
    assert.equal(s.allocated, 0.25 + 0.25 + 100 / 500);
    assert.ok(s.allocatedEstimated, 'words were converted to pages');
    assert.equal(s.used, 231 / 500);
    assert.ok(s.usedEstimated);
    assert.equal(r.get('A').used, 120 / 500);
    assert.equal(r.get('A').allocated, null, 'nothing below A');
    assert.equal(r.get('C').used, 30);
    assert.ok(!r.get('C').usedEstimated, 'words are counted, not estimated');
    assert.deepEqual(r.get(null).parts, ['S3']);
    assert.equal(r.get(null).allocated, 0.5);
    assert.equal(r.has('M'), false, 'a card without a quota has no report');
});

test('splitting moves a selection or the rest, and closes up the cut', () => {
    const body = 'First para.\n\nSecond para.\n\nThird para.';
    let r = c.splitText(body, 13, 25);
    assert.equal(r.moved, 'Second para.');
    assert.equal(r.keep, 'First para.\n\nThird para.');
    assert.equal(r.keep.slice(0, r.at), 'First para.');
    r = c.splitText(body, 13, 13);
    assert.equal(r.moved, 'Second para.\n\nThird para.', 'cursor: the rest');
    assert.equal(r.keep, 'First para.');
    r = c.splitText('One two three four.', 8, 14);
    assert.equal(r.moved, 'three');
    assert.equal(r.keep, 'One two four.', 'mid-line: one space');
    r = c.splitText(body, 0, 13);
    assert.equal(r.keep, 'Second para.\n\nThird para.');
    assert.equal(r.at, 0);
    assert.equal(c.splitText(body, body.length, body.length), null,
                 'nothing after the cursor');
    assert.equal(c.mergeText('A.\n\n', '\n\nB.'), 'A.\n\nB.');
    assert.equal(c.mergeText('', 'B.'), 'B.');
});
