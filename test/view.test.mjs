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
                                 autosaveMs: 20, vimKeys: true },
                     openAsMarkdown() {}, async lintCard() {} };
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

test('opening at a card makes it the active card', async () => {
    const { view } = await open(
        '---\ndendrite_prefix: G\n---\n- [[G-aaaaa|A]]\n- [[G-bbbbb|B]]\n',
        { 'G-aaaaa': 'A', 'G-bbbbb': 'B' });
    assert.equal(view.active, 'G-aaaaa');
    await view.setState({ file: INDEX, card: 'G-bbbbb' });
    assert.equal(view.active, 'G-bbbbb');
    assert.ok(view.cardEls.get('G-bbbbb').hasClass('is-active'));
});

test('numbering shows on section cards and never enters their notes',
     async () => {
    const { view, read } = await open(
        '---\ndendrite_prefix: G\ndendrite_number_sections: true\n---\n' +
        '- [[G-aaaaa|Outline]]\n    - [[G-bbbbb|Sub]]\n' +
        '    - [[G-ccccc|p]]\n- [[G-ddddd|Methods]]\n',
        { 'G-aaaaa': '# Outline', 'G-bbbbb': '# Sub', 'G-ccccc': 'Text.',
          'G-ddddd': '# Methods' });
    const num = (id) => view.cardEls.get(id)
        .querySelector('.dendrite-num')?.textContent;
    assert.equal(num('G-aaaaa'), '1.');
    assert.equal(num('G-bbbbb'), '1.1');
    assert.equal(num('G-ccccc'), undefined);
    assert.equal(num('G-ddddd'), '2.');
    view.active = 'G-ddddd';
    await view.structural('up');
    assert.equal(num('G-ddddd'), '1.');
    assert.equal(num('G-aaaaa'), '2.');
    assert.equal(read(cardPath('G-aaaaa')), '# Outline',
                 'the number is not written into the card');
    await view.exportTo(null);
    assert.equal(read('W/Grant/exports/Grant.md'),
                 '# 1. Methods\n\n# 2. Outline\n\n## 2.1 Sub\n\nText.\n');
});

test('a card limit is counted from its branch and marked when over',
     async () => {
    const { view, app } = await open(
        '---\ndendrite_prefix: G\ndendrite_limit: 5 words\n---\n' +
        '- [[G-aaaaa|Aims]]\n    - [[G-bbbbb|p]]\n',
        { 'G-aaaaa': '---\ndendrite_limit: 3 words\n---\n# Aims\nplan',
          'G-bbbbb': 'one two three %%not counted%%' });
    await view.updateCounts();
    const badge = () => view.cardEls.get('G-aaaaa')
        .querySelector('.dendrite-count');
    assert.equal(badge().textContent, '4 / 3 words');
    assert.ok(badge().hasClass('is-over'));
    assert.match(view.totalEl.textContent, /^4 \/ 5 words/);
    const f = view.cardFile('G-aaaaa');
    await app.fileManager.processFrontMatter(f, (fm) => {
        fm.dendrite_limit = '10 words';
    });
    await view.updateCounts();
    assert.equal(badge().textContent, '4 / 10 words');
    assert.ok(!badge().hasClass('is-over'));
});

test('bold, tab and list enter edit the card and are saved', async () => {
    const { view, read } = await open(
        '---\ndendrite_prefix: G\n---\n- [[G-aaaaa|A]]\n',
        { 'G-aaaaa': '- point' });
    await view.startEdit('G-aaaaa');
    const ta = view.editing.ta;
    ta.setSelectionRange(2, 7);
    assert.equal(view.editKey('bold'), false, 'the key is handled');
    assert.equal(ta.value, '- **point**');
    ta.setSelectionRange(ta.value.length, ta.value.length);
    view.editKey('enter');
    assert.equal(ta.value, '- **point**\n- ');
    view.editKey('indent');
    assert.equal(ta.value, '- **point**\n    - ');
    await view.endEdit();
    assert.equal(read(cardPath('G-aaaaa')), '- **point**\n    - ');
    assert.equal(view.editKey('bold'), true,
                 'outside the editor the key goes through');
});

test('the active path flows into each child group', async () => {
    const { view } = await open(
        '---\ndendrite_prefix: G\n---\n' +
        '- [[G-aaaaa|A]]\n    - [[G-bbbbb|B]]\n        - [[G-ccccc|C]]\n' +
        '- [[G-ddddd|D]]\n    - [[G-eeeee|E]]\n',
        { 'G-aaaaa': 'A', 'G-bbbbb': 'B', 'G-ccccc': 'C', 'G-ddddd': 'D',
          'G-eeeee': 'E' });
    await view.select('G-bbbbb');
    view.drawFlow();
    const flows = [...view.board.querySelectorAll('.is-flow')]
        .map((g) => g.querySelector('.dendrite-card').dataset.id);
    assert.deepEqual(flows.sort(), ['G-bbbbb', 'G-ccccc'],
                     'A opens into its children, B into its own');
    assert.equal(view.flowSvg.querySelectorAll('path').length, 2);
});

test('vim keys move, insert, rearrange and delete in normal mode',
     async () => {
    const { view, read } = await open(
        '---\ndendrite_prefix: G\n---\n' +
        '- [[G-aaaaa|A]]\n    - [[G-bbbbb|B]]\n- [[G-ccccc|C]]\n',
        { 'G-aaaaa': 'A', 'G-bbbbb': 'B', 'G-ccccc': 'C' });
    const key = async (k) => {
        view.contentEl.dispatchEvent(new h.window.KeyboardEvent(
            'keydown', { key: k, bubbles: true, cancelable: true }));
        await tick(5);
    };
    assert.equal(view.active, 'G-aaaaa');
    await key('j');
    assert.equal(view.active, 'G-ccccc');
    await key('k');
    await key('l');
    assert.equal(view.active, 'G-bbbbb');
    await key('h');
    assert.equal(view.active, 'G-aaaaa');
    assert.equal(view.modeEl.textContent, 'NORMAL');
    await key('i');
    assert.equal(view.editing.id, 'G-aaaaa');
    assert.equal(view.editing.ta.selectionStart, 0);
    assert.equal(view.modeEl.textContent, 'INSERT');
    await key('j');
    assert.equal(view.active, 'G-aaaaa', 'letters type in insert mode');
    await view.endEdit();
    await key('J');
    assert.match(read(INDEX), /- \[\[G-ccccc\|C\]\]\n- \[\[G-aaaaa/);
    await key('o');
    const fresh = view.active;
    assert.ok(view.editing && view.editing.id === fresh, 'o opens a card');
    await view.endEdit();
    await key('d');
    assert.ok(view.byId.has(fresh), 'one d does nothing');
    await key('d');
    assert.ok(!view.byId.has(fresh), 'dd deletes');
    await key('u');
    assert.ok(view.byId.has(fresh), 'u restores');
    await key('g');
    await key('g');
    assert.equal(view.active, 'G-ccccc', 'gg goes to the top');
    await key('G');
    assert.equal(view.active, fresh);
});

test('in edit mode the Ctrl shortcuts reach the text, not the view',
     async () => {
    const { view } = await open(
        '---\ndendrite_prefix: G\n---\n- [[G-aaaaa|A]]\n', { 'G-aaaaa': 'A' });
    await view.startEdit('G-aaaaa');
    const handler = (mods, key) => view.scope.keys.find((k) =>
        k.key === key && JSON.stringify(k.mods) === JSON.stringify(mods)).fn;
    for (const key of ['ArrowRight', 'ArrowDown', 'ArrowUp', 'j', 'k', 'l',
                       'Enter']) {
        assert.equal(handler(['Mod'], key)(), true, 'Ctrl+' + key);
    }
    assert.equal(view.root.children.length, 1, 'no card was created');
    assert.equal(view.editing.id, 'G-aaaaa', 'still editing');
    await view.endEdit();
    assert.equal(handler(['Mod'], 'ArrowDown')(), false,
                 'in normal mode the shortcut acts');
});

test('the Linter exemption is added once and only its own entry moves',
     async () => {
    const DendritePlugin = require('../src/main.js');
    const make = (folders) => {
        const linter = { settings: { foldersToIgnore: folders }, saves: 0,
                         async saveSettings() { this.saves++; } };
        const p = new DendritePlugin();
        p.app = { plugins: { plugins: { 'obsidian-linter': linter } } };
        p.settings = { writingFolder: 'Writing', manageLinter: true,
                       linterAdded: null };
        p.saveData = async () => {};
        return { p, linter };
    };
    const { p, linter } = make(['Templates']);
    await p.syncLinter();
    assert.deepEqual(linter.settings.foldersToIgnore,
                     ['Templates', 'Writing']);
    assert.equal(p.settings.linterAdded, 'Writing');
    await p.syncLinter();
    assert.equal(linter.saves, 1, 'nothing rewritten when already right');
    p.settings.writingFolder = 'Drafts';
    await p.syncLinter();
    assert.deepEqual(linter.settings.foldersToIgnore,
                     ['Templates', 'Drafts'], 'its own entry moved');
    p.settings.manageLinter = false;
    await p.syncLinter();
    assert.deepEqual(linter.settings.foldersToIgnore, ['Templates']);
    assert.equal(p.settings.linterAdded, null);

    const own = make(['Writing']);
    await own.p.syncLinter();
    assert.equal(own.p.settings.linterAdded, null, 'the entry was not ours');
    own.p.settings.manageLinter = false;
    await own.p.syncLinter();
    assert.deepEqual(own.linter.settings.foldersToIgnore, ['Writing'],
                     'a hand-added entry is never removed');

    const none = new DendritePlugin();
    none.app = { plugins: { plugins: {} } };
    none.settings = { writingFolder: 'Writing', manageLinter: true };
    await none.syncLinter();
});

test('a changed card is linted with the card-breaking rules off',
     async () => {
    const { view, app, read } = await open(
        '---\ndendrite_prefix: G\n---\n- [[G-aaaaa|A]]\n', { 'G-aaaaa': 'A' });
    const seen = [];
    const linter = {
        settings: { ruleConfigs: {
            'file-name-heading': { enabled: true },
            'emphasis-style': { enabled: true } }, foldersToIgnore: [] },
        async runLinterFile(f) {
            seen.push({ path: f.path, rules: this.settings.ruleConfigs });
            await app.vault.modify(f, app.vault.text.get(f.path)
                .replace(/_(\w+)_/g, '*$1*'));
        },
    };
    app.plugins = { plugins: { 'obsidian-linter': linter } };
    view.plugin = Object.assign(Object.create(
        require('../src/main.js').prototype), { app,
        settings: Object.assign({}, view.plugin.settings,
                                { lintCards: true }) });
    await view.startEdit('G-aaaaa');
    await view.endEdit();
    assert.equal(seen.length, 0, 'an unchanged card is not linted');
    await view.startEdit('G-aaaaa');
    type(view, 'An _emphasised_ word');
    await view.endEdit();
    assert.equal(seen.length, 1);
    assert.equal(seen[0].rules['file-name-heading'].enabled, false);
    assert.equal(seen[0].rules['emphasis-style'].enabled, true);
    assert.equal(linter.settings.ruleConfigs['file-name-heading'].enabled,
                 true, 'Linter\'s own settings are restored');
    assert.equal(read(cardPath('G-aaaaa')), 'An *emphasised* word');
});

test('undoing a new card removes its note unless text was written',
     async () => {
    const { view, read, app } = await open(
        '---\ndendrite_prefix: G\n---\n- [[G-aaaaa|A]]\n', { 'G-aaaaa': 'A' });
    view.active = 'G-aaaaa';
    await view.insert('child');
    const blank = view.active;
    await view.endEdit();
    await view.doUndo();
    assert.equal(read(cardPath(blank)), undefined, 'empty note removed');
    assert.deepEqual(view.unlinkedCards(), []);
    view.active = 'G-aaaaa';
    await view.insert('child');
    const kept = view.active;
    type(view, 'Some words');
    await view.endEdit();
    await view.doUndo();
    assert.equal(read(cardPath(kept)), 'Some words', 'text is never lost');
    assert.deepEqual(view.unlinkedCards().map((f) => f.basename), [kept]);
});

test('the orphan panel adds or deletes each unlinked note', async () => {
    const { view, read } = await open(
        '---\ndendrite_prefix: G\n---\n- [[G-aaaaa|A]]\n',
        { 'G-aaaaa': 'A', 'G-empty': '', 'G-words': 'Lost words' });
    await tick(20);
    const panel = view.contentEl.querySelector('.dendrite-orphans');
    assert.ok(panel, 'the panel floats over the board');
    const labels = [...panel.querySelectorAll('.dendrite-orphan-label')]
        .map((e) => e.textContent).sort();
    assert.deepEqual(labels, ['Lost words', 'empty']);
    const delEmpty = [...panel.querySelectorAll('button')]
        .find((b) => b.textContent === 'Delete 1 empty');
    delEmpty.click();
    await tick(20);
    assert.equal(read(cardPath('G-empty')), undefined);
    assert.equal(read(cardPath('G-words')), 'Lost words');
    const panel2 = view.contentEl.querySelector('.dendrite-orphans');
    [...panel2.querySelectorAll('button')]
        .find((b) => b.textContent === 'Add').click();
    await tick(20);
    assert.match(read(INDEX), /\[\[G-words\|Lost words\]\]/);
    assert.equal(view.contentEl.querySelector('.dendrite-orphans'), null);
});

test('right-click opens the card menu at the pointer, delete included',
     async () => {
    const { view } = await open(
        '---\ndendrite_prefix: G\n---\n- [[G-aaaaa|A]]\n- [[G-bbbbb|B]]\n',
        { 'G-aaaaa': 'A', 'G-bbbbb': 'B' });
    const card = view.cardEls.get('G-bbbbb');
    card.dispatchEvent(new h.window.MouseEvent('contextmenu',
        { bubbles: true, cancelable: true }));
    await tick(10);
    assert.equal(view.active, 'G-bbbbb', 'the card is selected');
    const menu = h.obsidian.lastMenu;
    assert.equal(menu.shown, 'mouse');
    const del = menu.items.find((i) => /^Delete/.test(i.title));
    assert.ok(del, 'the menu offers delete');
    await del.click();
    await tick(10);
    assert.ok(!view.byId.has('G-bbbbb'));
});

test('a card changing height redraws the flow', async () => {
    const { view } = await open(
        '---\ndendrite_prefix: G\n---\n- [[G-aaaaa|A]]\n    - [[G-bbbbb|B]]\n',
        { 'G-aaaaa': 'A', 'G-bbbbb': 'B' });
    let draws = 0;
    const orig = view.drawFlow.bind(view);
    view.drawFlow = () => { draws++; orig(); };
    globalThis.lastResizer.fire();
    await tick(5);
    assert.equal(draws, 1);
});
