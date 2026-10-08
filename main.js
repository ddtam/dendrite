/* Dendrite: bundled from src/ by esbuild; edit src/, not this file. */
"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/core.js
var require_core = __commonJS({
  "src/core.js"(exports2, module2) {
    "use strict";
    var INDENT = "    ";
    var ITEM = /^(\s*)[-*+]\s+\[\[([^\]|#]+)(?:\|([^\]]*))?\]\]\s*$/;
    var HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
    var PREFIX = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;
    var ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
    var ID_LEN = 5;
    var LABEL_WORDS = 8;
    function splitFrontmatter(text) {
      const m = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
      if (!m) return { fm: "", body: text };
      return { fm: m[0], body: text.slice(m[0].length) };
    }
    function makeNode(id, label, parent) {
      return { id, label: label || "", children: [], parent };
    }
    function makeRoot() {
      return makeNode(null, "", null);
    }
    function parseIndex(body) {
      const lines = body.split("\n");
      let start = -1;
      let end = -1;
      for (let i = 0; i < lines.length; i++) {
        if (ITEM.test(lines[i])) {
          if (start < 0) start = i;
          end = i;
        } else if (start >= 0 && lines[i].trim() !== "") {
          break;
        }
      }
      const root = makeRoot();
      if (start < 0) {
        return { root, before: body, after: "" };
      }
      const items = [];
      let unit = Infinity;
      for (let i = start; i <= end; i++) {
        const m = ITEM.exec(lines[i]);
        if (!m) continue;
        const width = m[1].replace(/\t/g, INDENT).length;
        if (width > 0) unit = Math.min(unit, width);
        items.push({ width, id: m[2].trim(), label: (m[3] || "").trim() });
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
      const before = lines.slice(0, start).join("\n");
      const after = lines.slice(end + 1).join("\n");
      return {
        root,
        before: start > 0 ? before + "\n" : "",
        after: end + 1 < lines.length ? "\n" + after : ""
      };
    }
    function cleanLabel(label) {
      return String(label || "").replace(/[[\]|\n\r]/g, " ").replace(/\s+/g, " ").trim();
    }
    function serialiseTree(root) {
      const out = [];
      const walk = (node, depth) => {
        for (const c of node.children) {
          const label = cleanLabel(c.label);
          out.push(INDENT.repeat(depth) + "- [[" + c.id + (label ? "|" + label : "") + "]]");
          walk(c, depth + 1);
        }
      };
      walk(root, 0);
      return out.join("\n");
    }
    function writeIndexText(text, root) {
      const { fm, body } = splitFrontmatter(text);
      const p = parseIndex(body);
      let before = p.before;
      if (!p.root.children.length && before && !before.endsWith("\n")) {
        before += "\n";
      }
      const list = serialiseTree(root);
      const after = p.root.children.length ? p.after : "";
      return fm + before + list + (list && !after ? "\n" : "") + after;
    }
    function deriveLabel(body, aliases) {
      const lines = stripComments(body || "").split("\n").map((l) => l.trim()).filter(Boolean);
      const first = lines[0] || "";
      const h = HEADING.exec(first);
      if (h) return cleanLabel(h[2]);
      const alias = Array.isArray(aliases) ? aliases[0] : typeof aliases === "string" ? aliases : null;
      if (alias) return cleanLabel(alias);
      if (!first) return "";
      const words = first.replace(/[*_`>#~=]/g, "").replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").split(/\s+/).filter(Boolean);
      const cut = words.slice(0, LABEL_WORDS).join(" ");
      return cleanLabel(words.length > LABEL_WORDS ? cut + "\u2026" : cut);
    }
    function stripComments(text) {
      return text.replace(/%%[\s\S]*?%%/g, "");
    }
    function validPrefix(prefix) {
      return PREFIX.test(prefix || "");
    }
    function newId(prefix, taken, rand = Math.random) {
      for (let tries = 0; tries < 1e3; tries++) {
        let s = "";
        for (let i = 0; i < ID_LEN; i++) {
          s += ID_CHARS[Math.floor(rand() * ID_CHARS.length)];
        }
        const id = prefix + "-" + s;
        if (!taken(id)) return id;
      }
      throw new Error("Dendrite: could not find a free card ID");
    }
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
    function indent(node) {
      const i = indexOf(node);
      if (i === 0) return false;
      const target = node.parent.children[i - 1];
      node.parent.children.splice(i, 1);
      node.parent = target;
      target.children.push(node);
      return true;
    }
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
    function exportMarkdown(nodes, bodyOf, headingTop) {
      const top = Math.max(1, Math.min(6, headingTop || 1));
      const blocks = [];
      const heading = (text, depth) => "#".repeat(Math.min(6, top + depth)) + " " + text;
      const walk = (node, depth) => {
        const body = stripComments(bodyOf(node.id) || "").trim();
        const lines = body ? body.split("\n") : [];
        const h = lines.length ? HEADING.exec(lines[0].trim()) : null;
        if (node.children.length) {
          if (h) blocks.push(heading(h[2], depth));
          for (const c of node.children) walk(c, depth + 1);
        } else if (h) {
          blocks.push(heading(h[2], depth));
          const rest = lines.slice(1).join("\n").trim();
          if (rest) blocks.push(rest);
        } else if (body) {
          blocks.push(body);
        }
      };
      for (const n of nodes) walk(n, 0);
      return blocks.join("\n\n") + (blocks.length ? "\n" : "");
    }
    module2.exports = {
      INDENT,
      splitFrontmatter,
      parseIndex,
      serialiseTree,
      writeIndexText,
      deriveLabel,
      stripComments,
      validPrefix,
      newId,
      makeNode,
      makeRoot,
      insertSibling,
      appendChild,
      moveWithin,
      indent,
      outdent,
      remove,
      descendants,
      allNodes,
      columns,
      exportMarkdown,
      cleanLabel
    };
  }
});

// src/main.js
var {
  ItemView,
  MarkdownView,
  Plugin,
  PluginSettingTab,
  Setting,
  MarkdownRenderer,
  Component,
  Modal,
  Notice,
  TFile,
  TFolder,
  Scope,
  setIcon,
  normalizePath,
  Keymap
} = require("obsidian");
var core = require_core();
var VIEW = "dendrite-view";
var DEFAULTS = {
  writingFolder: "Writing",
  headingTop: 1,
  cardWidth: 380,
  autosaveMs: 600,
  openInDendrite: true
};
var CARD_NAME = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*-[a-z0-9]{5}$/;
var UNDO_DEPTH = 50;
function prefixOf(app, file) {
  const fm = app.metadataCache.getFileCache(file)?.frontmatter;
  const p = fm && fm.dendrite_prefix;
  return p ? String(p).trim() : null;
}
function isIndex(app, file) {
  return file instanceof TFile && file.extension === "md" && !!prefixOf(app, file);
}
function safeName(s) {
  return String(s).replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim();
}
var DendriteView = class extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.file = null;
    this.root = core.makeRoot();
    this.byId = /* @__PURE__ */ new Map();
    this.active = null;
    this.lastChild = /* @__PURE__ */ new Map();
    this.cardEls = /* @__PURE__ */ new Map();
    this.rendered = /* @__PURE__ */ new Map();
    this.editing = null;
    this.undo = [];
    this.selfWrites = /* @__PURE__ */ new Set();
    this.reloadTimer = null;
    this.scope = new Scope(this.app.scope);
    this.registerKeys();
  }
  getViewType() {
    return VIEW;
  }
  getIcon() {
    return "list-tree";
  }
  getDisplayText() {
    return this.file ? this.file.basename : "Dendrite";
  }
  getState() {
    return { file: this.file ? this.file.path : null };
  }
  async setState(state, result) {
    const f = state && state.file && this.app.vault.getAbstractFileByPath(state.file);
    if (f instanceof TFile) {
      this.file = f;
      await this.reload();
      if (state.card && this.byId.has(state.card)) {
        this.active = state.card;
        this.applyActive(false);
      }
    }
    return super.setState(state, result);
  }
  async onOpen() {
    this.contentEl.addClass("dendrite");
    this.contentEl.tabIndex = 0;
    this.observer = new IntersectionObserver(
      (entries) => this.onVisible(entries),
      { root: null, rootMargin: "600px 200px" }
    );
    this.registerEvent(this.app.vault.on(
      "modify",
      (f) => this.onModify(f)
    ));
    this.registerEvent(this.app.vault.on("rename", (f, old) => {
      if (this.file && f === this.file) {
        this.leaf.updateHeader();
      } else if (f instanceof TFile) {
        this.onRenameCard(f, old);
      }
    }));
    this.registerEvent(this.app.vault.on("delete", (f) => {
      if (f === this.file) this.leaf.detach();
      else if (f instanceof TFile && this.byId.has(f.basename)) {
        this.invalidate(f.basename);
        this.renderCard(f.basename);
      }
    }));
    this.registerEvent(this.app.metadataCache.on(
      "changed",
      (f) => this.onMetadata(f)
    ));
    this.registerDomEvent(
      this.contentEl,
      "click",
      (e) => this.onClick(e)
    );
    this.registerDomEvent(this.contentEl, "dblclick", (e) => {
      const card = e.target.closest(".dendrite-card");
      if (card && !this.editing) this.startEdit(card.dataset.id);
    });
    this.registerDomEvent(
      window,
      "beforeunload",
      () => {
        this.flush();
      }
    );
  }
  async onClose() {
    await this.flush();
    if (this.observer) this.observer.disconnect();
    for (const r of this.rendered.values()) r.comp.unload();
    this.rendered.clear();
  }
  // ---- loading ---------------------------------------------------------
  async reload() {
    if (!this.file) return;
    const text = await this.app.vault.read(this.file);
    this.loadText(text);
    this.render();
  }
  loadText(text) {
    const { body } = core.splitFrontmatter(text);
    this.root = core.parseIndex(body).root;
    this.reindex();
    if (!this.active || !this.byId.has(this.active)) {
      const first = this.root.children[0];
      this.active = first ? first.id : null;
    }
  }
  reindex() {
    this.byId.clear();
    for (const n of core.allNodes(this.root)) this.byId.set(n.id, n);
  }
  prefix() {
    return this.file ? prefixOf(this.app, this.file) : null;
  }
  cardsFolder() {
    const dir = this.file.parent ? this.file.parent.path : "";
    return normalizePath((dir && dir !== "/" ? dir + "/" : "") + "cards");
  }
  cardFile(id) {
    const f = this.app.metadataCache.getFirstLinkpathDest(
      id,
      this.file ? this.file.path : ""
    );
    return f instanceof TFile ? f : null;
  }
  // ---- rendering -------------------------------------------------------
  render() {
    const el = this.contentEl;
    if (this.observer) this.observer.disconnect();
    el.empty();
    this.cardEls.clear();
    el.style.setProperty(
      "--dendrite-card-width",
      this.plugin.settings.cardWidth + "px"
    );
    if (!this.file) {
      el.createDiv({
        cls: "dendrite-empty",
        text: "Open an index note in Dendrite."
      });
      return;
    }
    this.renderBar(el);
    const board = el.createDiv({ cls: "dendrite-board" });
    this.board = board;
    const cols = core.columns(this.root);
    this.cols = cols;
    if (!cols.length) {
      const empty = board.createDiv({ cls: "dendrite-empty" });
      empty.createSpan({ text: "No cards yet. " });
      const b = empty.createEl("button", { text: "Add the first card" });
      b.onclick = () => this.insert("first");
      return;
    }
    cols.forEach((nodes, d) => {
      const col = board.createDiv({ cls: "dendrite-col" });
      col.dataset.depth = String(d);
      col.createDiv({ cls: "dendrite-spacer" });
      let group = null;
      let parent;
      for (const n of nodes) {
        if (!group || n.parent !== parent) {
          group = col.createDiv({ cls: "dendrite-group" });
          parent = n.parent;
        }
        this.renderShell(group, n);
      }
      col.createDiv({ cls: "dendrite-spacer" });
    });
    this.applyActive(false);
  }
  renderBar(el) {
    const bar = el.createDiv({ cls: "dendrite-bar" });
    bar.createDiv({ cls: "dendrite-title", text: this.file.basename });
    const btn = (icon, label, title, fn) => {
      const b = bar.createEl("button", { cls: "dendrite-bar-btn" });
      setIcon(b.createSpan({ cls: "dendrite-bar-icon" }), icon);
      b.createSpan({ text: label });
      b.setAttr("aria-label", title);
      b.onclick = fn;
    };
    btn(
      "file-output",
      "Export",
      "Export the manuscript to markdown",
      () => this.exportTo(null)
    );
    btn(
      "undo-2",
      "Undo",
      "Undo the last structural change (Ctrl+Z)",
      () => this.doUndo()
    );
    btn(
      "file-text",
      "Index",
      "Open the index note as markdown",
      () => this.plugin.openAsMarkdown(this.file)
    );
    const unlinked = this.unlinkedCards();
    if (unlinked.length) {
      const warn = bar.createDiv({ cls: "dendrite-warn" });
      warn.setText(`${unlinked.length} card note(s) in cards/ are not in the index`);
      const fix = warn.createEl("button", { text: "Add at the end" });
      fix.onclick = () => this.adopt(unlinked);
    }
  }
  renderShell(group, n) {
    const card = group.createDiv({ cls: "dendrite-card" });
    card.dataset.id = n.id;
    if (n.children.length) card.addClass("has-children");
    const body = card.createDiv({ cls: "dendrite-card-body" });
    const cached = this.rendered.get(n.id);
    const f = this.cardFile(n.id);
    if (this.editing && this.editing.id === n.id) {
      body.appendChild(this.editing.ta);
    } else if (cached && f && cached.mtime === f.stat.mtime) {
      body.appendChild(cached.el);
    } else {
      body.createDiv({
        cls: "dendrite-placeholder",
        text: n.label || n.id
      });
      card.addClass("is-pending");
    }
    this.cardEls.set(n.id, card);
    if (this.observer) this.observer.observe(card);
  }
  onVisible(entries) {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const id = e.target.dataset.id;
      this.observer.unobserve(e.target);
      if (e.target.hasClass("is-pending")) this.renderCard(id);
    }
  }
  invalidate(id) {
    const r = this.rendered.get(id);
    if (r) {
      r.comp.unload();
      this.rendered.delete(id);
    }
  }
  async renderCard(id) {
    const card = this.cardEls.get(id);
    if (!card || this.editing && this.editing.id === id) return;
    const body = card.querySelector(".dendrite-card-body");
    const f = this.cardFile(id);
    if (!f) {
      card.removeClass("is-pending");
      card.addClass("is-missing");
      body.empty();
      body.createDiv({
        cls: "dendrite-placeholder",
        text: `Missing note: ${id}`
      });
      return;
    }
    const cached = this.rendered.get(id);
    if (cached && cached.mtime === f.stat.mtime) {
      body.empty();
      body.appendChild(cached.el);
      card.removeClass("is-pending");
      return;
    }
    const text = core.splitFrontmatter(
      await this.app.vault.cachedRead(f)
    ).body;
    const comp = new Component();
    comp.load();
    const out = createDiv({ cls: "dendrite-md markdown-rendered" });
    if (text.trim()) {
      await MarkdownRenderer.render(this.app, text, out, f.path, comp);
    } else {
      out.createDiv({
        cls: "dendrite-placeholder",
        text: "Empty card"
      });
    }
    this.invalidate(id);
    this.rendered.set(id, { el: out, comp, mtime: f.stat.mtime });
    const now = this.cardEls.get(id);
    if (now && !(this.editing && this.editing.id === id)) {
      const b = now.querySelector(".dendrite-card-body");
      b.empty();
      b.appendChild(out);
      now.removeClass("is-pending");
      now.removeClass("is-missing");
      if (this.lineage && this.lineage.has(id)) this.centre(false);
    }
  }
  /** Highlight the active card's lineage and bring it into view. */
  applyActive(smooth = true) {
    this.highlight();
    this.centre(smooth);
  }
  highlight() {
    if (!this.board) return;
    const node = this.active && this.byId.get(this.active);
    const lineage = /* @__PURE__ */ new Set();
    if (node) {
      for (let n = node; n && n.id; n = n.parent) lineage.add(n.id);
      for (const d of core.descendants(node)) lineage.add(d.id);
    }
    this.lineage = lineage;
    this.board.toggleClass("has-active", !!node);
    for (const [id, el] of this.cardEls) {
      el.toggleClass("is-active", id === this.active);
      el.toggleClass("is-lineage", lineage.has(id));
    }
    this.renderToolbar();
  }
  /**
   * Centre the active card, horizontally and vertically, and in every
   * other column the part of its lineage that column holds.
   */
  centre(smooth = true) {
    if (!this.board) return;
    const node = this.active && this.byId.get(this.active);
    if (!node) return;
    const lineage = /* @__PURE__ */ new Set();
    for (let n = node; n && n.id; n = n.parent) lineage.add(n.id);
    for (const d of core.descendants(node)) lineage.add(d.id);
    const behavior = smooth ? "smooth" : "auto";
    const cols = this.board.querySelectorAll(".dendrite-col");
    cols.forEach((col2, d) => {
      const inCol = (this.cols[d] || []).filter(
        (n) => lineage.has(n.id)
      );
      if (!inCol.length) return;
      let target = inCol;
      if (d === node.depth) target = [node];
      const a = this.cardEls.get(target[0].id);
      const b = this.cardEls.get(target[target.length - 1].id);
      if (!a || !b) return;
      const mid = (a.offsetTop + b.offsetTop + b.offsetHeight) / 2;
      col2.scrollTo({ top: mid - col2.clientHeight / 2, behavior });
    });
    const col = cols[node.depth];
    if (col) {
      const left = col.offsetLeft - (this.board.clientWidth - col.offsetWidth) / 2;
      this.board.scrollTo({ left, behavior });
    }
  }
  renderToolbar() {
    if (this.toolbar) this.toolbar.remove();
    this.toolbar = null;
    const card = this.active && this.cardEls.get(this.active);
    if (!card || this.editing) return;
    const t = card.createDiv({ cls: "dendrite-toolbar" });
    const btn = (icon, title, fn) => {
      const b = t.createEl("button", { cls: "clickable-icon" });
      setIcon(b, icon);
      b.setAttr("aria-label", title);
      b.onclick = (e) => {
        e.stopPropagation();
        fn();
      };
    };
    btn("pencil", "Edit (Enter)", () => this.startEdit(this.active));
    btn(
      "arrow-down-to-line",
      "New card below (Ctrl+\u2193)",
      () => this.insert("below")
    );
    btn(
      "corner-down-right",
      "New child card (Ctrl+\u2192)",
      () => this.insert("child")
    );
    btn("more-horizontal", "More", () => this.cardMenu(t));
    this.toolbar = t;
  }
  cardMenu(anchor) {
    const { Menu } = require("obsidian");
    const m = new Menu();
    const item = (title, icon, fn) => m.addItem((i) => i.setTitle(title).setIcon(icon).onClick(fn));
    item(
      "New card above (Ctrl+\u2191)",
      "arrow-up-to-line",
      () => this.insert("above")
    );
    item("Move up (Alt+\u2191)", "arrow-up", () => this.structural("up"));
    item(
      "Move down (Alt+\u2193)",
      "arrow-down",
      () => this.structural("down")
    );
    item("Indent (Alt+\u2192)", "indent", () => this.structural("indent"));
    item("Outdent (Alt+\u2190)", "outdent", () => this.structural("outdent"));
    m.addSeparator();
    item(
      "Export this branch",
      "file-output",
      () => this.exportTo(this.byId.get(this.active))
    );
    item("Open card note", "file", () => {
      const f = this.cardFile(this.active);
      if (f) this.plugin.openAsMarkdown(f);
    });
    m.addSeparator();
    item(
      "Delete card and its children (Ctrl+Backspace)",
      "trash-2",
      () => this.deleteActive()
    );
    const r = anchor.getBoundingClientRect();
    m.showAtPosition({ x: r.left, y: r.bottom });
  }
  // ---- interaction -----------------------------------------------------
  onClick(e) {
    const link = e.target.closest("a.internal-link");
    if (link) {
      e.preventDefault();
      const href = link.getAttr("data-href") || link.getAttr("href");
      this.app.workspace.openLinkText(
        href,
        this.file.path,
        Keymap.isModEvent(e)
      );
      return;
    }
    if (e.target.closest(".dendrite-toolbar, textarea, button")) return;
    const card = e.target.closest(".dendrite-card");
    if (card) this.select(card.dataset.id);
    this.contentEl.focus();
  }
  async select(id) {
    if (!id || id === this.active) return;
    if (this.editing) await this.endEdit();
    const node = this.byId.get(id);
    if (node && node.parent && node.parent.id) {
      this.lastChild.set(node.parent.id, id);
    }
    this.active = id;
    this.applyActive();
  }
  navigate(dir) {
    const node = this.active && this.byId.get(this.active);
    if (!node) return;
    if (dir === "left") {
      if (node.parent && node.parent.id) this.select(node.parent.id);
    } else if (dir === "right") {
      if (!node.children.length) return;
      const last = this.lastChild.get(node.id);
      const pick = node.children.find((c) => c.id === last) || node.children[0];
      this.select(pick.id);
    } else {
      const col = this.cols[node.depth];
      const i = col.indexOf(node) + (dir === "up" ? -1 : 1);
      if (i >= 0 && i < col.length) this.select(col[i].id);
    }
  }
  registerKeys() {
    const s = this.scope;
    const nav = (dir) => () => {
      if (this.editing) return true;
      this.navigate(dir);
      return false;
    };
    for (const [key, dir] of [
      ["ArrowUp", "up"],
      ["ArrowDown", "down"],
      ["ArrowLeft", "left"],
      ["ArrowRight", "right"]
    ]) {
      s.register([], key, nav(dir));
    }
    s.register([], "Enter", () => {
      if (this.editing) return true;
      if (this.active) this.startEdit(this.active);
      return false;
    });
    s.register([], "Escape", () => {
      if (!this.editing) return true;
      this.endEdit();
      return false;
    });
    s.register(["Mod"], "Enter", () => {
      if (this.editing) this.endEdit();
      else if (this.active) this.startEdit(this.active);
      return false;
    });
    for (const [key, where] of [
      ["ArrowDown", "below"],
      ["j", "below"],
      ["ArrowUp", "above"],
      ["k", "above"],
      ["ArrowRight", "child"],
      ["l", "child"]
    ]) {
      s.register(["Mod"], key, () => {
        this.insert(where);
        return false;
      });
    }
    for (const [key, op] of [
      ["ArrowUp", "up"],
      ["ArrowDown", "down"],
      ["ArrowRight", "indent"],
      ["ArrowLeft", "outdent"]
    ]) {
      s.register(["Alt"], key, () => {
        if (this.editing) return true;
        this.structural(op);
        return false;
      });
    }
    s.register(["Mod"], "Backspace", () => {
      if (this.editing) return true;
      this.deleteActive();
      return false;
    });
    s.register(["Mod"], "z", () => {
      if (this.editing) return true;
      this.doUndo();
      return false;
    });
  }
  // ---- editing ---------------------------------------------------------
  async startEdit(id) {
    if (this.editing) {
      if (this.editing.id === id) return;
      await this.endEdit();
    }
    if (id !== this.active) {
      this.active = id;
      this.applyActive();
    }
    let f = this.cardFile(id);
    if (!f) f = await this.createCardFile(id);
    const raw = await this.app.vault.read(f);
    const ta = createEl("textarea", { cls: "dendrite-editor" });
    ta.value = core.splitFrontmatter(raw).body;
    const ed = {
      id,
      file: f,
      ta,
      dirty: false,
      timer: null,
      saving: Promise.resolve()
    };
    this.editing = ed;
    const fit = () => {
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    };
    ta.addEventListener("input", () => {
      ed.dirty = true;
      fit();
      this.centre(false);
      clearTimeout(ed.timer);
      ed.timer = setTimeout(
        () => this.save(ed),
        this.plugin.settings.autosaveMs
      );
    });
    ta.addEventListener("blur", () => {
      this.save(ed);
    });
    const card = this.cardEls.get(id);
    if (card) {
      const body = card.querySelector(".dendrite-card-body");
      body.empty();
      body.appendChild(ta);
      card.addClass("is-editing");
      card.removeClass("is-pending");
    }
    this.renderToolbar();
    fit();
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }
  /** Write the editor's text to its card, keeping the frontmatter. */
  save(ed) {
    clearTimeout(ed.timer);
    if (!ed.dirty) return ed.saving;
    ed.dirty = false;
    const text = ed.ta.value;
    ed.saving = ed.saving.then(() => this.app.vault.process(
      ed.file,
      (data) => core.splitFrontmatter(data).fm + text
    )).then(() => this.syncLabel(ed.id, text)).catch((err) => {
      ed.dirty = true;
      console.error("Dendrite: save failed", err);
      new Notice("Dendrite could not save the card; the text is still in the editor.");
    });
    return ed.saving;
  }
  async flush() {
    if (this.editing) await this.save(this.editing);
  }
  async endEdit() {
    const ed = this.editing;
    if (!ed) return;
    await this.save(ed);
    this.editing = null;
    this.invalidate(ed.id);
    const card = this.cardEls.get(ed.id);
    if (card) {
      card.removeClass("is-editing");
      card.addClass("is-pending");
    }
    await this.renderCard(ed.id);
    this.renderToolbar();
    this.contentEl.focus();
  }
  async syncLabel(id, body) {
    const node = this.byId.get(id);
    if (!node) return;
    const f = this.cardFile(id);
    const fm = f && this.app.metadataCache.getFileCache(f)?.frontmatter;
    const label = core.deriveLabel(body, fm && fm.aliases);
    if (label !== node.label) {
      node.label = label;
      await this.writeIndex();
    }
  }
  // ---- structure -------------------------------------------------------
  snapshot(files = []) {
    this.undo.push({
      tree: core.serialiseTree(this.root),
      active: this.active,
      files
    });
    if (this.undo.length > UNDO_DEPTH) this.undo.shift();
  }
  async writeIndex() {
    const root = this.root;
    await this.app.vault.process(this.file, (data) => {
      const out = core.writeIndexText(data, root);
      this.selfWrites.add(out);
      if (this.selfWrites.size > 20) {
        this.selfWrites.delete(this.selfWrites.values().next().value);
      }
      return out;
    });
  }
  async createCardFile(id) {
    const folder = this.cardsFolder();
    if (!this.app.vault.getAbstractFileByPath(folder)) {
      await this.app.vault.createFolder(folder);
    }
    return this.app.vault.create(
      normalizePath(`${folder}/${id}.md`),
      ""
    );
  }
  taken(id) {
    return this.byId.has(id) || !!this.app.metadataCache.getFirstLinkpathDest(id, "") || !!this.app.vault.getAbstractFileByPath(
      normalizePath(`${this.cardsFolder()}/${id}.md`)
    );
  }
  async insert(where) {
    const prefix = this.prefix();
    if (!prefix || !core.validPrefix(prefix)) {
      new Notice("Dendrite: set a valid dendrite_prefix in the index note's properties first.");
      return;
    }
    if (this.editing) await this.endEdit();
    const node = this.active && this.byId.get(this.active);
    const id = core.newId(prefix, (x) => this.taken(x));
    await this.createCardFile(id);
    this.snapshot();
    const fresh = core.makeNode(id, "", null);
    if (!node || where === "first") {
      core.appendChild(this.root, fresh);
    } else if (where === "child") {
      core.appendChild(node, fresh);
    } else {
      core.insertSibling(node, fresh, where === "below");
    }
    this.byId.set(id, fresh);
    this.active = id;
    await this.writeIndex();
    this.render();
    await this.startEdit(id);
  }
  async structural(op) {
    const node = this.active && this.byId.get(this.active);
    if (!node) return;
    if (this.editing) await this.endEdit();
    const before = core.serialiseTree(this.root);
    const fn = {
      up: () => core.moveWithin(node, -1),
      down: () => core.moveWithin(node, 1),
      indent: () => core.indent(node),
      outdent: () => core.outdent(node)
    }[op];
    if (!fn || !fn()) return;
    this.undo.push({ tree: before, active: this.active, files: [] });
    await this.writeIndex();
    this.render();
  }
  async deleteActive() {
    const node = this.active && this.byId.get(this.active);
    if (!node) return;
    if (this.editing) await this.endEdit();
    const doomed = [node, ...core.descendants(node)];
    const files = [];
    for (const n of doomed) {
      const f = this.cardFile(n.id);
      if (f) files.push({
        path: f.path,
        data: await this.app.vault.read(f)
      });
    }
    this.snapshot(files);
    const sibs = node.parent.children;
    const i = sibs.indexOf(node);
    const next = sibs[i + 1] || sibs[i - 1] || (node.parent.id ? node.parent : null);
    core.remove(node);
    this.reindex();
    this.active = next ? next.id : null;
    await this.writeIndex();
    for (const n of doomed) {
      const f = this.cardFile(n.id);
      this.invalidate(n.id);
      if (f) await this.app.fileManager.trashFile(f);
    }
    this.render();
    new Notice(`Dendrite: deleted ${doomed.length} card(s). Ctrl+Z in the view restores them.`);
  }
  async doUndo() {
    const snap = this.undo.pop();
    if (!snap) {
      new Notice("Dendrite: nothing to undo.");
      return;
    }
    if (this.editing) await this.endEdit();
    for (const { path, data } of snap.files) {
      if (!this.app.vault.getAbstractFileByPath(path)) {
        await this.app.vault.create(path, data);
      }
    }
    this.root = core.parseIndex(snap.tree + "\n").root;
    this.reindex();
    this.active = snap.active;
    await this.writeIndex();
    this.render();
  }
  unlinkedCards() {
    const folder = this.app.vault.getAbstractFileByPath(
      this.cardsFolder()
    );
    if (!(folder instanceof TFolder)) return [];
    return folder.children.filter((f) => f instanceof TFile && f.extension === "md" && !this.byId.has(f.basename));
  }
  async adopt(files) {
    this.snapshot();
    for (const f of files) {
      const n = core.makeNode(f.basename, "", null);
      core.appendChild(this.root, n);
      const body = core.splitFrontmatter(
        await this.app.vault.cachedRead(f)
      ).body;
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
      n.label = core.deriveLabel(body, fm && fm.aliases);
    }
    this.reindex();
    await this.writeIndex();
    this.render();
  }
  // ---- changes from outside the view -----------------------------------
  async onModify(f) {
    if (!(f instanceof TFile) || !this.file) return;
    if (f === this.file) {
      const text = await this.app.vault.cachedRead(f);
      if (this.selfWrites.delete(text)) return;
      clearTimeout(this.reloadTimer);
      this.reloadTimer = setTimeout(() => this.reload(), 300);
      return;
    }
    const id = f.basename;
    if (!this.byId.has(id)) return;
    if (this.editing && this.editing.id === id) return;
    this.invalidate(id);
    const card = this.cardEls.get(id);
    if (card) {
      card.addClass("is-pending");
      this.renderCard(id);
    }
  }
  async onMetadata(f) {
    if (!(f instanceof TFile) || !this.byId.has(f.basename)) return;
    if (this.editing && this.editing.id === f.basename) return;
    const body = core.splitFrontmatter(
      await this.app.vault.cachedRead(f)
    ).body;
    await this.syncLabel(f.basename, body);
  }
  onRenameCard(f, oldPath) {
    const old = oldPath.split("/").pop().replace(/\.md$/, "");
    const node = this.byId.get(old);
    if (!node || f.basename === old) return;
    this.byId.delete(old);
    node.id = f.basename;
    this.byId.set(node.id, node);
    if (this.active === old) this.active = node.id;
    this.invalidate(old);
  }
  // ---- export ----------------------------------------------------------
  async exportTo(node) {
    await this.flush();
    const scope = node ? [node] : this.root.children;
    const ids = node ? [node, ...core.descendants(node)] : core.allNodes(this.root);
    const bodies = /* @__PURE__ */ new Map();
    for (const n of ids) {
      const f = this.cardFile(n.id);
      if (f) {
        bodies.set(n.id, core.splitFrontmatter(
          await this.app.vault.cachedRead(f)
        ).body);
      }
    }
    const text = core.exportMarkdown(
      scope,
      (id) => bodies.get(id),
      this.plugin.settings.headingTop
    );
    const dir = normalizePath(
      (this.file.parent.path === "/" ? "" : this.file.parent.path + "/") + "exports"
    );
    if (!this.app.vault.getAbstractFileByPath(dir)) {
      await this.app.vault.createFolder(dir);
    }
    const name = safeName(this.file.basename + (node ? " - " + (node.label || node.id) : ""));
    const path = normalizePath(`${dir}/${name}.md`);
    const existing = this.app.vault.getAbstractFileByPath(path);
    let out;
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, text);
      out = existing;
    } else {
      out = await this.app.vault.create(path, text);
    }
    await this.app.workspace.getLeaf("tab").openFile(out);
    new Notice(`Dendrite: exported to ${path}`);
  }
};
var NewManuscriptModal = class extends Modal {
  constructor(plugin) {
    super(plugin.app);
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    this.titleEl.setText("New Dendrite manuscript");
    let title = "";
    let prefix = "";
    new Setting(contentEl).setName("Title").setDesc("Names the folder and the index note.").addText((t) => t.setPlaceholder("Grant application 2026").onChange((v) => {
      title = v;
    }));
    new Setting(contentEl).setName("Prefix").setDesc("Starts every card ID, such as GRANT-2026. Letters, digits and hyphens; unique in the vault.").addText((t) => t.setPlaceholder("GRANT-2026").onChange((v) => {
      prefix = v.trim();
    }));
    new Setting(contentEl).addButton((b) => b.setButtonText("Create").setCta().onClick(async () => {
      const err = this.plugin.checkNew(title, prefix);
      if (err) {
        new Notice("Dendrite: " + err);
        return;
      }
      this.close();
      await this.plugin.createManuscript(safeName(title), prefix);
    }));
  }
  onClose() {
    this.contentEl.empty();
  }
};
var DendriteSettings = class extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    const s = this.plugin.settings;
    containerEl.empty();
    const save = () => this.plugin.saveSettings();
    new Setting(containerEl).setName("Writing folder").setDesc("Where new manuscripts are created, one folder each.").addText((t) => t.setValue(s.writingFolder).onChange((v) => {
      s.writingFolder = v.trim();
      save();
    }));
    new Setting(containerEl).setName("Top section heading level").setDesc("Export writes a top-level section card as this heading level, deeper sections one level down each.").addDropdown((d) => {
      for (let i = 1; i <= 4; i++) d.addOption(String(i), "H" + i);
      d.setValue(String(s.headingTop)).onChange((v) => {
        s.headingTop = Number(v);
        save();
      });
    });
    new Setting(containerEl).setName("Card width").setDesc("In pixels.").addSlider((sl) => sl.setLimits(260, 640, 20).setValue(s.cardWidth).setDynamicTooltip().onChange((v) => {
      s.cardWidth = v;
      save();
      this.plugin.rerender();
    }));
    new Setting(containerEl).setName("Open index notes in Dendrite").setDesc("Opening an index note shows it in Dendrite. Its markdown stays one button away in the view.").addToggle((tg) => tg.setValue(s.openInDendrite).onChange((v) => {
      s.openInDendrite = v;
      save();
    }));
    new Setting(containerEl).setName("Autosave delay").setDesc("Milliseconds after the last keystroke before a card is written to its note.").addSlider((sl) => sl.setLimits(200, 3e3, 100).setValue(s.autosaveMs).setDynamicTooltip().onChange((v) => {
      s.autosaveMs = v;
      save();
    }));
  }
};
module.exports = class DendritePlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    this.registerView(VIEW, (leaf) => new DendriteView(leaf, this));
    this.addSettingTab(new DendriteSettings(this.app, this));
    this.addRibbonIcon("list-tree", "Open in Dendrite", () => {
      const f = this.app.workspace.getActiveFile();
      if (f && isIndex(this.app, f)) this.openIndex(f);
      else new NewManuscriptModal(this).open();
    });
    this.addCommand({
      id: "open-index",
      name: "Open the current index note in Dendrite",
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        if (!f || !isIndex(this.app, f)) return false;
        if (!checking) this.openIndex(f);
        return true;
      }
    });
    this.addCommand({
      id: "new-manuscript",
      name: "New manuscript",
      callback: () => new NewManuscriptModal(this).open()
    });
    this.markdownLeaves = /* @__PURE__ */ new WeakMap();
    this.registerEvent(this.app.workspace.on(
      "file-open",
      (f) => this.onFileOpen(f)
    ));
    this.registerEvent(this.app.workspace.on(
      "active-leaf-change",
      (leaf) => this.decorate(leaf)
    ));
    this.app.workspace.onLayoutReady(() => {
      this.app.workspace.iterateAllLeaves((l) => this.decorate(l));
    });
    this.registerEvent(this.app.workspace.on("file-menu", (menu, f) => {
      if (!isIndex(this.app, f)) return;
      menu.addItem((i) => i.setTitle("Open in Dendrite").setIcon("list-tree").onClick(() => this.openIndex(f)));
    }));
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  rerender() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) {
      leaf.view.render();
    }
  }
  async openIndex(file, card = null, leaf = null) {
    const target = leaf || this.app.workspace.getLeaf("tab");
    await target.setViewState({
      type: VIEW,
      active: true,
      state: { file: file.path, card }
    });
    this.app.workspace.revealLeaf(target);
  }
  async openAsMarkdown(file) {
    const leaf = this.app.workspace.getLeaf("tab");
    this.markdownLeaves.set(leaf, file.path);
    await leaf.openFile(file);
  }
  /** An index note opened as markdown switches to Dendrite. */
  onFileOpen(file) {
    if (!this.settings.openInDendrite || !file) return;
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || view.file !== file || !isIndex(this.app, file)) return;
    if (this.markdownLeaves.get(view.leaf) === file.path) return;
    this.openIndex(file, null, view.leaf);
  }
  isCard(file) {
    return file instanceof TFile && file.extension === "md" && file.parent && file.parent.name === "cards" && CARD_NAME.test(file.basename);
  }
  /** The index note that links a card, found from Obsidian's links. */
  indexFor(card) {
    const links = this.app.metadataCache.resolvedLinks;
    for (const src of Object.keys(links)) {
      if (!links[src][card.path]) continue;
      const f = this.app.vault.getAbstractFileByPath(src);
      if (isIndex(this.app, f)) return f;
    }
    return null;
  }
  /**
   * Give a markdown view of an index or a card a header button back
   * into Dendrite, at that card when it is one.
   */
  decorate(leaf) {
    const view = leaf && leaf.view;
    if (!(view instanceof MarkdownView)) return;
    const file = view.file;
    const kind = isIndex(this.app, file) ? "index" : this.isCard(file) ? "card" : null;
    if (view.dendriteAction) {
      if (view.dendriteAction.kind === kind && view.dendriteAction.path === (file && file.path)) return;
      view.dendriteAction.el.remove();
      view.dendriteAction = null;
    }
    if (!kind) return;
    const el = view.addAction(
      "list-tree",
      kind === "index" ? "Open in Dendrite" : "Open this card in Dendrite",
      () => {
        if (kind === "index") {
          this.markdownLeaves.delete(view.leaf);
          this.openIndex(file, null, view.leaf);
          return;
        }
        const index = this.indexFor(file);
        if (index) this.openIndex(index, file.basename, view.leaf);
        else new Notice("Dendrite: no index note links this card.");
      }
    );
    view.dendriteAction = { el, kind, path: file.path };
  }
  prefixesInUse() {
    const out = /* @__PURE__ */ new Set();
    for (const f of this.app.vault.getMarkdownFiles()) {
      const p = prefixOf(this.app, f);
      if (p) out.add(p.toLowerCase());
    }
    return out;
  }
  checkNew(title, prefix) {
    if (!safeName(title)) return "give the manuscript a title.";
    if (!core.validPrefix(prefix)) {
      return "a prefix is letters, digits and single hyphens.";
    }
    if (this.prefixesInUse().has(prefix.toLowerCase())) {
      return `the prefix ${prefix} is already used by another manuscript.`;
    }
    const dir = normalizePath(`${this.settings.writingFolder}/` + safeName(title));
    if (this.app.vault.getAbstractFileByPath(dir)) {
      return `${dir} already exists.`;
    }
    return null;
  }
  async createManuscript(title, prefix) {
    const vault = this.app.vault;
    const dir = normalizePath(`${this.settings.writingFolder}/${title}`);
    for (const p of [this.settings.writingFolder, dir, `${dir}/cards`]) {
      const np = normalizePath(p);
      if (np && !vault.getAbstractFileByPath(np)) {
        await vault.createFolder(np);
      }
    }
    const index = await vault.create(
      normalizePath(`${dir}/${title}.md`),
      `---
dendrite_prefix: ${prefix}
---
`
    );
    await new Promise((r) => {
      const ref = this.app.metadataCache.on("changed", (f) => {
        if (f === index) {
          this.app.metadataCache.offref(ref);
          r();
        }
      });
      setTimeout(r, 1500);
    });
    await this.openIndex(index);
  }
};
module.exports.core = core;
module.exports.DendriteView = DendriteView;
