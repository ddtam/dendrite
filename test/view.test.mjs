// View tests: drive the real DendriteView against an in-memory vault and
// check what lands in the notes. These cover every path that writes text:
// typing, autosave, leaving the editor, inserting, moving, deleting and
// undoing. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const h = require('./harness.cjs');
const { DendriteView } = require('../src/main.js');

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const INDEX = 'W/Grant/Grant.md';

async function open(indexText, cards = {}) {
    const app = h.makeApp();
    app.vault.folders.add('W/Grant/cards');
    await app.vault.create(INDEX, indexText);
    for (const [id, t] of Object.entries(cards)) {
        await app.vault.create(`W/Grant/cards/${id}.md`, t);
    }
    const plugin = { settings: { headingTop: 1, cardWidth: 380,
                                 autosaveMs: 20 } };
    const view = new DendriteView({ app, updateHeader() {},
                                    detach() {} }, plugin);
    await view.onOpen();
    await view.setState({ file: INDEX });
    await tick();
    return { app, view, read: (p) => app.vault.text.get(p) };
}

const cardPath = (id) => `W/Grant/cards/${id}.md`;
const type = (view, value) => {
    const ta = view.editing.ta;
    ta.value = value;
    ta.dispatchEvent(new h.window.Event('input'));
};

test('first card: typed text reaches its note and labels the index',
     async () => {
    const { view, read } = await open('---\ndendrite_prefix: G\n---\n');
    await view.insert('first');
    const id = view.active;
    assert.match(id, /^G-[a-z0-9]{5}$/);
    type(view, '# Specific Aims\nPlanning text.');
    await tick(60);
    assert.equal(read(cardPath(id)), '# Specific Aims\nPlanning text.',
                 'autosave wrote the card');
    await view.endEdit();
    assert.equal(read(INDEX), '---\ndendrite_prefix: G\n---\n' +
                 `- [[${id}|Specific Aims]]\n`);
});

test('leaving the editor saves at once, before the autosave fires',
     async () => {
    const { view, read } = await open('---\ndendrite_prefix: G\n---\n');
    view.plugin.settings.autosaveMs = 100000;
    await view.insert('first');
    const id = view.active;
    type(view, 'Never lost.');
    await view.endEdit();
    assert.equal(read(cardPath(id)), 'Never lost.');
});

test('a card\'s frontmatter survives editing its text', async () => {
    const { view, read } = await open(
        '---\ndendrite_prefix: G\n---\n- [[G-aaaaa|Old]]\n',
        { 'G-aaaaa': '---\naliases:\n  - Kept alias\n---\nOld text\n' });
    await view.startEdit('G-aaaaa');
    assert.equal(view.editing.ta.value, 'Old text\n',
                 'the editor shows the body only');
    type(view, 'New text\n');
    await view.endEdit();
    assert.equal(read(cardPath('G-aaaaa')),
                 '---\naliases:\n  - Kept alias\n---\nNew text\n');
    assert.match(read(INDEX), /\[\[G-aaaaa\|Kept alias\]\]/,
                 'the alias, not the first words, is the label');
});

test('insert below, child and above, then indent and outdent', async () => {
    const { view, read } = await open(
        '---\ndendrite_prefix: G\n---\n- [[G-aaaaa|A]]\n',
        { 'G-aaaaa': '# A\n' });
    view.active = 'G-aaaaa';
    await view.insert('below');
    const b = view.active;
    await view.insert('child');
    const c = view.active;
    view.active = b;
    await view.insert('above');
    const d = view.active;
    await view.endEdit();
    const ids = () => [...read(INDEX).matchAll(/\[\[([^|\]]+)/g)]
        .map((m) => m[1]);
    assert.deepEqual(ids(), ['G-aaaaa', d, b, c]);
    assert.match(read(INDEX), new RegExp(`\\n    - \\[\\[${c}`),
                 'the child is nested under its parent');
    view.active = d;
    await view.structural('indent');
    assert.match(read(INDEX), new RegExp(`\\n    - \\[\\[${d}`));
    await view.structural('outdent');
    assert.match(read(INDEX), new RegExp(`\\n- \\[\\[${d}`));
});

test('delete trashes the branch and undo restores notes and tree',
     async () => {
    const index = '---\ndendrite_prefix: G\n---\n' +
        '- [[G-aaaaa|A]]\n    - [[G-bbbbb|B]]\n- [[G-ccccc|C]]\n';
    const { view, read } = await open(index, {
        'G-aaaaa': '# A\n', 'G-bbbbb': 'B text', 'G-ccccc': 'C text' });
    view.active = 'G-aaaaa';
    await view.deleteActive();
    assert.equal(read(cardPath('G-aaaaa')), undefined);
    assert.equal(read(cardPath('G-bbbbb')), undefined);
    assert.equal(read(INDEX), '---\ndendrite_prefix: G\n---\n' +
                 '- [[G-ccccc|C]]\n');
    assert.equal(view.active, 'G-ccccc');
    await view.doUndo();
    assert.equal(read(cardPath('G-bbbbb')), 'B text');
    assert.equal(read(INDEX), index);
});

test('an index edited outside Dendrite is re-read; its own writes are not',
     async () => {
    const { app, view } = await open(
        '---\ndendrite_prefix: G\n---\n- [[G-aaaaa|A]]\n',
        { 'G-aaaaa': 'A', 'G-bbbbb': 'B' });
    let reloads = 0;
    const orig = view.reload.bind(view);
    view.reload = async () => { reloads++; await orig(); };
    view.active = 'G-aaaaa';
    await view.structural('down');
    await view.writeIndex();
    await tick(400);
    assert.equal(reloads, 0, 'own write ignored');
    const f = app.vault.getAbstractFileByPath(INDEX);
    await app.vault.modify(f, '---\ndendrite_prefix: G\n---\n' +
        '- [[G-bbbbb|B]]\n- [[G-aaaaa|A]]\n');
    await tick(400);
    assert.equal(reloads, 1);
    assert.deepEqual(view.root.children.map((n) => n.id),
                     ['G-bbbbb', 'G-aaaaa']);
});

test('cards in cards/ that the index misses are offered for adoption',
     async () => {
    const { view, read } = await open(
        '---\ndendrite_prefix: G\n---\n- [[G-aaaaa|A]]\n',
        { 'G-aaaaa': 'A', 'G-zzzzz': '# Lost card' });
    assert.deepEqual(view.unlinkedCards().map((f) => f.basename),
                     ['G-zzzzz']);
    await view.adopt(view.unlinkedCards());
    assert.match(read(INDEX), /- \[\[G-zzzzz\|Lost card\]\]\n$/);
});

test('export writes the manuscript beside the index', async () => {
    const { view, read } = await open(
        '---\ndendrite_prefix: G\n---\n' +
        '- [[G-aaaaa|Aims]]\n    - [[G-bbbbb|p]]\n',
        { 'G-aaaaa': '# Aims\nplanning', 'G-bbbbb': 'Prose %%note%%here.' });
    await view.exportTo(null);
    assert.equal(read('W/Grant/exports/Grant.md'),
                 '# Aims\n\nProse here.\n');
});
