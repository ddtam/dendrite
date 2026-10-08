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
