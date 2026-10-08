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
    function mergeIntoAbove(node) {
      const i = indexOf(node);
      if (i === 0) return null;
      const target = node.parent.children[i - 1];
      for (const c of node.children.slice()) appendChild(target, c);
      node.children = [];
      remove(node);
      return target;
    }
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
    function exportMarkdown(nodes, bodyOf, headingTop, numbers) {
      const top = Math.max(1, Math.min(6, headingTop || 1));
      const blocks = [];
      let current = null;
      const heading = (text, depth) => "#".repeat(Math.min(6, top + depth)) + " " + (numbers && numbers.has(current) ? numbers.get(current) + " " : "") + text;
      const walk = (node, depth) => {
        current = node.id;
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
    function sectionNumbers(roots, hasHeading) {
      const out = /* @__PURE__ */ new Map();
      const walk = (nodes, prefix) => {
        let i = 0;
        for (const n of nodes) {
          if (hasHeading(n.id)) {
            i += 1;
            const num = prefix ? `${prefix}.${i}` : String(i);
            out.set(n.id, prefix ? num : num + ".");
            walk(n.children, num);
          } else {
            walk(n.children, prefix);
          }
        }
      };
      walk(roots, "");
      return out;
    }
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
        keep = before.replace(/\s+$/, "");
        at = keep.length;
      } else if (!before.trim()) {
        keep = after.replace(/^\s+/, "");
        at = 0;
      } else if (/\n\s*$/.test(before) || /^\s*\n/.test(after)) {
        keep = before.replace(/\s+$/, "") + "\n\n" + after.replace(/^\s+/, "");
        at = before.replace(/\s+$/, "").length;
      } else {
        keep = before.replace(/[ \t]+$/, "") + " " + after.replace(/^[ \t]+/, "");
        at = before.replace(/[ \t]+$/, "").length;
      }
      return { keep, moved, at };
    }
    function mergeText(first, second) {
      const a = (first || "").replace(/\s+$/, "");
      const b = (second || "").replace(/^\s+/, "");
      return a && b ? a + "\n\n" + b : a || b;
    }
    function alignColumns(cols, active, pos, heights) {
      const targets = cols.map(() => null);
      if (!active) return targets;
      const lineage = /* @__PURE__ */ new Set([active.id]);
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
        } else if (d > active.depth && anchor[d - 1] && targets[d - 1] !== null) {
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
    function flowPath(pairs) {
      const f = (x) => Math.round(x * 10) / 10;
      const parts = [];
      for (const { card: a, group: b } of pairs) {
        const ra = Math.min(a.r || 0, (a.bottom - a.top) / 2);
        const rb = Math.min(
          b.r || 0,
          (b.right - b.left) / 2,
          (b.bottom - b.top) / 2
        );
        const x1 = a.right - 1;
        const x2 = b.left + 1;
        const at = a.top + ra;
        const ab = a.bottom - ra;
        const bt = b.top;
        const bb = b.bottom;
        const mx = (a.right + b.left) / 2;
        parts.push(`M${f(x1)},${f(at)} C${f(mx)},${f(at)} ${f(mx)},${f(bt)} ${f(x2)},${f(bt)} L${f(x2)},${f(bb)} C${f(mx)},${f(bb)} ${f(mx)},${f(ab)} ${f(x1)},${f(ab)} Z`);
        const [l, r, t, btm] = [b.left, b.right, b.top, b.bottom];
        parts.push(`M${f(l)},${f(t)} H${f(r - rb)} A${f(rb)},${f(rb)} 0 0 1 ${f(r)},${f(t + rb)} V${f(btm - rb)} A${f(rb)},${f(rb)} 0 0 1 ${f(r - rb)},${f(btm)} H${f(l)} Z`);
      }
      return parts.join(" ");
    }
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
        parts.push(`M${f(x1)},${f(at)} C${f(mx)},${f(at)} ${f(mx)},${f(bt)} ${f(x2)},${f(bt)} L${f(x2)},${f(bb)} C${f(mx)},${f(bb)} ${f(mx)},${f(ab)} ${f(x1)},${f(ab)} Z`);
      }
      return parts.join(" ");
    }
    var NUM = "\\d+(?:\\.\\d+)?";
    var LIMIT = new RegExp(`^\\s*(${NUM}(?:\\s*/\\s*${NUM})?)\\s*(words?|characters?|chars?|pages?)\\s*$`, "i");
    function parseAmount(text) {
      const parts = String(text).split("/").map((s) => Number(s.trim()));
      if (parts.length === 1) return parts[0];
      if (parts.length === 2 && parts[1]) return parts[0] / parts[1];
      return NaN;
    }
    function parseLimit(value) {
      if (value === null || value === void 0 || value === "") return null;
      const m = LIMIT.exec(String(value));
      if (!m) return null;
      const amount = parseAmount(m[1]);
      if (!(amount > 0)) return null;
      const u = m[2].toLowerCase();
      const unit = u.startsWith("w") ? "words" : u.startsWith("p") ? "pages" : "characters";
      return { amount, unit };
    }
    function fmtNum(x) {
      return Number.isInteger(x) ? x.toLocaleString() : String(Math.round(x * 100) / 100);
    }
    function formatLimit(limit) {
      if (!limit) return "";
      const one = limit.amount === 1;
      const unit = limit.unit === "pages" ? one ? "page" : "pages" : limit.unit === "words" ? one ? "word" : "words" : one ? "character" : "characters";
      return `${fmtNum(limit.amount)} ${unit}`;
    }
    function convert(amount, from, to, wordsPerPage, charsPerWord) {
      if (from === to) return { value: amount, estimated: false };
      const wpp = wordsPerPage || 500;
      const cpw = charsPerWord || 6;
      const words = from === "words" ? amount : from === "pages" ? amount * wpp : amount / cpw;
      const value = to === "words" ? words : to === "pages" ? words / wpp : words * cpw;
      return { value, estimated: true };
    }
    function quotas(root, quotaOf, countOf, opts = {}) {
      const wpp = opts.wordsPerPage || 500;
      const cpw = opts.charsPerWord || 6;
      const out = /* @__PURE__ */ new Map();
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
        return {
          quota,
          used,
          usedEstimated: quota.unit === "pages",
          allocated,
          allocatedEstimated,
          parts: parts.map((p) => p.id)
        };
      };
      if (opts.total) out.set(null, report(root, opts.total));
      for (const n of allNodes(root)) {
        const q = quotaOf(n.id);
        if (q) out.set(n.id, report(n, q));
      }
      return out;
    }
    function countText(markdown, countSpaces) {
      const plain = stripComments(markdown).replace(/!\[\[[^\]]*\]\]/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[(@[^\]]+)\]/g, "cite").replace(/^\s{0,3}#{1,6}\s+/gm, "").replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[.\]\s+)?/gm, "").replace(/^\s*>\s?/gm, "").replace(/[*_`~=]+/g, "");
      const words = (plain.match(/\S+/g) || []).length;
      const collapsed = plain.replace(/\s+/g, " ").trim();
      const chars = countSpaces ? collapsed.length : collapsed.replace(/ /g, "").length;
      return { words, chars };
    }
    function measure(count, unit, wordsPerPage) {
      if (unit === "words") return count.words;
      if (unit === "characters") return count.chars;
      return count.words / (wordsPerPage || 500);
    }
    module2.exports = {
      parseLimit,
      formatLimit,
      countText,
      measure,
      sectionNumbers,
      alignColumns,
      parseAmount,
      convert,
      quotas,
      fmtNum,
      splitText,
      mergeText,
      mergeIntoAbove,
      mergeIntoParent,
      flowPath,
      threadPath,
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

// src/textedit.js
var require_textedit = __commonJS({
  "src/textedit.js"(exports2, module2) {
    "use strict";
    var INDENT = "    ";
    var LIST = /^(\s*)([-*+]|(\d+)([.)]))(\s+)(\[.\]\s+)?/;
    function lineStart(text, i) {
      return text.lastIndexOf("\n", i - 1) + 1;
    }
    function lineEnd(text, i) {
      const j = text.indexOf("\n", i);
      return j < 0 ? text.length : j;
    }
    function wrap(text, s, e, mark) {
      const sel = text.slice(s, e);
      const n = mark.length;
      if (text.slice(s - n, s) === mark && text.slice(e, e + n) === mark) {
        return {
          start: s - n,
          end: e + n,
          text: sel,
          selStart: s - n,
          selEnd: e - n
        };
      }
      return {
        start: s,
        end: e,
        text: mark + sel + mark,
        selStart: s + n,
        selEnd: e + n
      };
    }
    function shiftLines(text, s, e, outdent) {
      const a = lineStart(text, s);
      const b = lineEnd(text, e > s && text[e - 1] === "\n" ? e - 1 : e);
      const lines = text.slice(a, b).split("\n");
      let firstDelta = 0;
      let total = 0;
      const out = lines.map((line, i) => {
        let delta;
        let next;
        if (outdent) {
          const m = /^( {1,4}|\t)/.exec(line);
          delta = m ? -m[0].length : 0;
          next = line.slice(-delta);
        } else {
          delta = INDENT.length;
          next = INDENT + line;
        }
        if (i === 0) firstDelta = delta;
        total += delta;
        return next;
      });
      return {
        start: a,
        end: b,
        text: out.join("\n"),
        selStart: Math.max(a, s + firstDelta),
        selEnd: Math.max(a, e + total)
      };
    }
    function enter(text, s, e) {
      if (s !== e) return null;
      const a = lineStart(text, s);
      const line = text.slice(a, lineEnd(text, s));
      const m = LIST.exec(line);
      if (!m) return null;
      if (line.trim() === m[0].trim()) {
        return {
          start: a,
          end: a + line.length,
          text: "",
          selStart: a,
          selEnd: a
        };
      }
      const marker = m[3] ? String(Number(m[3]) + 1) + m[4] : m[2];
      const task = m[6] ? "[ ] " : "";
      const insert = "\n" + m[1] + marker + m[5] + task;
      return {
        start: s,
        end: s,
        text: insert,
        selStart: s + insert.length,
        selEnd: s + insert.length
      };
    }
    module2.exports = { wrap, shiftLines, enter };
  }
});

// src/editor.js
var require_editor = __commonJS({
  "src/editor.js"(exports2, module2) {
    "use strict";
    var { Scope: Scope2 } = require("obsidian");
    var EditorClass = null;
    var resolveFailed = false;
    function markdownEditorClass(app) {
      if (EditorClass || resolveFailed) return EditorClass;
      try {
        const embed = app.embedRegistry.embedByExtension.md(
          { app, containerEl: createDiv(), state: {} },
          null,
          ""
        );
        embed.editable = true;
        embed.showEditor();
        const proto = Object.getPrototypeOf(
          Object.getPrototypeOf(embed.editMode)
        );
        embed.unload();
        EditorClass = proto && proto.constructor;
        if (typeof EditorClass !== "function") throw new Error("no class");
      } catch (err) {
        resolveFailed = true;
        EditorClass = null;
        console.warn("Dendrite: Obsidian's editor is unavailable; cards use the text box.", err);
      }
      return EditorClass;
    }
    function obsidianEditor(app, parent, opts) {
      const Base = markdownEditorClass(app);
      if (!Base) return null;
      class CardEditor extends Base {
        constructor(container) {
          super(app, container, {
            app,
            onMarkdownScroll: () => {
            },
            getMode: () => "source"
          });
          this.cardOpts = opts;
          this.scope = new Scope2(app.scope);
          this.scope.register([], "Escape", () => {
            opts.onEscape();
            return false;
          });
          this.owner.editMode = this;
          this.owner.editor = this.editor;
          this.owner.file = opts.file;
          this.set(opts.value || "", false);
          const content = this.editor.cm.contentDOM;
          content.addEventListener("focusin", () => {
            app.keymap.pushScope(this.scope);
            app.workspace.activeEditor = this.owner;
          });
          content.addEventListener("blur", () => {
            app.keymap.popScope(this.scope);
            if (this._loaded) opts.onBlur();
          });
          const ws = app.workspace;
          const original = ws.setActiveLeaf;
          const self = this;
          const patched = function(...args) {
            if (self.editor && self.editor.cm && self.editor.cm.hasFocus) {
              return void 0;
            }
            return original.apply(this, args);
          };
          ws.setActiveLeaf = patched;
          this.register(() => {
            if (ws.setActiveLeaf === patched) ws.setActiveLeaf = original;
          });
        }
        onUpdate(update, changed) {
          super.onUpdate(update, changed);
          if (changed) this.cardOpts.onChange();
        }
        onunload() {
          super.onunload();
          app.keymap.popScope(this.scope);
          if (app.workspace.activeEditor === this.owner) {
            app.workspace.activeEditor = null;
          }
        }
      }
      const el = createDiv({ cls: "dendrite-cm" });
      let ed;
      try {
        ed = new CardEditor(el);
        parent.addChild(ed);
        if (!ed.editor || !ed.editor.cm) throw new Error("no CodeMirror");
      } catch (err) {
        console.warn("Dendrite: Obsidian's editor failed to start; using the text box.", err);
        if (ed) {
          try {
            parent.removeChild(ed);
          } catch (e) {
          }
        }
        return null;
      }
      return {
        kind: "obsidian",
        el,
        get value() {
          return ed.editor.cm.state.doc.toString();
        },
        focus(atStart) {
          const editor = ed.editor;
          editor.focus();
          if (atStart) {
            editor.setCursor({ line: 0, ch: 0 });
          } else {
            const last = editor.lastLine();
            editor.setCursor({
              line: last,
              ch: editor.getLine(last).length
            });
          }
        },
        selection() {
          const editor = ed.editor;
          return [
            editor.posToOffset(editor.getCursor("from")),
            editor.posToOffset(editor.getCursor("to"))
          ];
        },
        replace(text, at) {
          ed.editor.setValue(text);
          this.focusAt(at);
        },
        focusAt(at) {
          const editor = ed.editor;
          editor.focus();
          editor.setCursor(editor.offsetToPos(at));
        },
        destroy() {
          parent.removeChild(ed);
        }
      };
    }
    function textEditor(opts) {
      const ta = createEl("textarea", { cls: "dendrite-editor" });
      ta.value = opts.value || "";
      const fit = () => {
        ta.style.height = "auto";
        ta.style.height = ta.scrollHeight + "px";
      };
      ta.addEventListener("input", () => {
        fit();
        opts.onChange();
      });
      ta.addEventListener("blur", () => opts.onBlur());
      return {
        kind: "text",
        el: ta,
        ta,
        get value() {
          return ta.value;
        },
        focus(atStart) {
          fit();
          ta.focus();
          const at = atStart ? 0 : ta.value.length;
          ta.setSelectionRange(at, at);
        },
        selection() {
          return [ta.selectionStart, ta.selectionEnd];
        },
        replace(text, at) {
          ta.value = text;
          fit();
          this.focusAt(at);
        },
        focusAt(at) {
          ta.focus();
          ta.setSelectionRange(at, at);
        },
        destroy() {
          ta.remove();
        }
      };
    }
    function cardEditor2(app, parent, opts, useObsidian) {
      return useObsidian && obsidianEditor(app, parent, opts) || textEditor(opts);
    }
    function resetForTests() {
      EditorClass = null;
      resolveFailed = false;
    }
    module2.exports = { cardEditor: cardEditor2, textEditor, resetForTests };
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
var textedit = require_textedit();
var { cardEditor } = require_editor();
var VIEW = "dendrite-view";
var DEFAULTS = {
  writingFolder: "Writing",
  headingTop: 1,
  cardWidth: 380,
  autosaveMs: 600,
  openInDendrite: true,
  vimKeys: true,
  manageLinter: true,
  lintCards: true,
  obsidianEditor: true,
  // The Linter ignore entry Dendrite added itself, if any, so that only
  // that entry is ever removed again.
  linterAdded: null
};
var LINTER_ID = "obsidian-linter";
var CARD_UNSAFE_RULES = ["file-name-heading", "capitalize-headings"];
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
      this.contentEl.focus();
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
    this.resizer = new ResizeObserver(() => this.onResize());
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
    this.registerDomEvent(
      this.contentEl,
      "keydown",
      (e) => this.onNavKey(e)
    );
    this.registerDomEvent(this.contentEl, "contextmenu", async (e) => {
      const card = e.target.closest(".dendrite-card");
      if (!card || e.target.closest("textarea, .dendrite-cm")) return;
      e.preventDefault();
      await this.select(card.dataset.id, false);
      this.cardMenu(card, e);
    });
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
    this.hideQuotaTip();
    this.closeQuotaEditor();
    await this.flush();
    if (this.observer) this.observer.disconnect();
    if (this.resizer) this.resizer.disconnect();
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
    if (this.resizer) this.resizer.disconnect();
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
    const stage = el.createDiv({ cls: "dendrite-stage" });
    const NS = "http://www.w3.org/2000/svg";
    this.flowSvg = document.createElementNS(NS, "svg");
    this.flowSvg.classList.add("dendrite-flow");
    stage.appendChild(this.flowSvg);
    const board = stage.createDiv({ cls: "dendrite-board" });
    this.board = board;
    board.addEventListener("scroll", () => this.scheduleFlow(), true);
    this.renderOrphans(stage);
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
    this.updateNumbers();
    this.updateCounts();
  }
  renderBar(el) {
    const bar = el.createDiv({ cls: "dendrite-bar" });
    this.modeEl = bar.createDiv({ cls: "dendrite-mode" });
    this.showMode();
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
    btn(
      "settings",
      "Settings",
      "This manuscript's settings",
      () => new ManuscriptModal(this).open()
    );
    this.totalEl = bar.createDiv({ cls: "dendrite-total" });
  }
  /**
   * Card notes in cards/ that the index does not link, in a panel
   * floating over the board's top right, each to add or to delete.
   */
  async renderOrphans(stage) {
    const files = this.unlinkedCards();
    if (!files.length) return;
    const panel = stage.createDiv({ cls: "dendrite-orphans" });
    const head = panel.createDiv({ cls: "dendrite-orphans-head" });
    head.createSpan({ text: `${files.length} card note(s) not in the index` });
    const list = panel.createDiv({ cls: "dendrite-orphans-list" });
    const empty = [];
    for (const f of files) {
      const body = core.splitFrontmatter(
        await this.app.vault.cachedRead(f)
      ).body;
      if (!body.trim()) empty.push(f);
      const row = list.createDiv({ cls: "dendrite-orphan" });
      row.createSpan({
        cls: "dendrite-orphan-label",
        text: core.deriveLabel(body, null) || "empty"
      });
      const add = row.createEl("button", { text: "Add" });
      add.setAttr("aria-label", "Add at the end of the index");
      add.onclick = () => this.adopt([f]);
      const del = row.createEl("button", {
        cls: "mod-warning",
        text: "Delete"
      });
      del.setAttr("aria-label", "Move the note to the trash");
      del.onclick = () => this.trashOrphans([f]);
    }
    const foot = panel.createDiv({ cls: "dendrite-orphans-foot" });
    const all = foot.createEl("button", { text: "Add all" });
    all.onclick = () => this.adopt(files);
    if (empty.length) {
      const b = foot.createEl("button", {
        cls: "mod-warning",
        text: `Delete ${empty.length} empty`
      });
      b.onclick = () => this.trashOrphans(empty);
    }
  }
  async trashOrphans(files) {
    for (const f of files) await this.app.fileManager.trashFile(f);
    this.render();
  }
  renderShell(group, n) {
    const card = group.createDiv({ cls: "dendrite-card" });
    card.dataset.id = n.id;
    if (n.children.length) card.addClass("has-children");
    const body = card.createDiv({ cls: "dendrite-card-body" });
    const cached = this.rendered.get(n.id);
    const f = this.cardFile(n.id);
    if (this.editing && this.editing.id === n.id) {
      body.appendChild(this.editing.editor.el);
      card.addClass("is-editing");
      card.toggleClass(
        "has-obsidian-editor",
        this.editing.editor.kind === "obsidian"
      );
    } else if (cached && f && cached.mtime === f.stat.mtime) {
      body.appendChild(cached.el);
    } else {
      body.createDiv({
        cls: "dendrite-placeholder",
        text: n.label || n.id
      });
      card.addClass("is-pending");
    }
    const foot = card.createDiv({ cls: "dendrite-card-foot" });
    this.renderQuotaWidget(foot, n.id);
    this.cardEls.set(n.id, card);
    if (this.observer) this.observer.observe(card);
    if (this.resizer) this.resizer.observe(card);
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
      this.scheduleFlow();
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
    this.scheduleFlow();
  }
  onResize() {
    if (this.resizeFrame) return;
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = null;
      this.centre(false);
      this.drawFlow();
    });
  }
  scheduleFlow() {
    if (this.flowFrame) return;
    this.flowFrame = requestAnimationFrame(() => {
      this.flowFrame = null;
      this.drawFlow();
    });
  }
  /**
   * Gingko's flow: a band from the right edge of each card on the active
   * path, from the root down to the active card, widening to the left
   * edge of the group holding its children in the next column.
   */
  drawFlow() {
    const svg = this.flowSvg;
    if (!svg || !this.board) return;
    while (svg.firstChild) svg.firstChild.remove();
    for (const g of this.board.querySelectorAll(".is-flow")) {
      g.classList.remove("is-flow");
    }
    const node = this.active && this.byId.get(this.active);
    if (!node) return;
    const box = svg.getBoundingClientRect();
    const rel = (el) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left - box.left,
        right: r.right - box.left,
        top: r.top - box.top,
        bottom: r.bottom - box.top,
        r: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0
      };
    };
    const pairs = [];
    const steps = [];
    for (let n = node; n && n.id; n = n.parent) {
      const card = this.cardEls.get(n.id);
      if (!card) continue;
      if (n.parent && n.parent.id) {
        const up = this.cardEls.get(n.parent.id);
        if (up) steps.push({ from: rel(up), to: rel(card) });
      }
      if (!n.children.length) continue;
      const child = this.cardEls.get(n.children[0].id);
      const group = child && child.parentElement;
      if (!group) continue;
      group.classList.add("is-flow");
      pairs.push({ card: rel(card), group: rel(group) });
    }
    const NS = "http://www.w3.org/2000/svg";
    const draw = (cls, d) => {
      if (!d) return;
      const path = document.createElementNS(NS, "path");
      path.setAttribute("class", cls);
      path.setAttribute("d", d);
      svg.appendChild(path);
    };
    draw("dendrite-flow-context", core.flowPath(pairs));
    draw("dendrite-flow-thread", core.threadPath(steps));
  }
  /**
   * Centre the active card, horizontally and vertically, and in every
   * other column the part of its lineage that column holds.
   */
  centre(smooth = true) {
    if (!this.board) return;
    const node = this.active && this.byId.get(this.active);
    if (!node) return;
    const behavior = smooth ? "smooth" : "auto";
    const cols = this.board.querySelectorAll(".dendrite-col");
    const pos = (id) => {
      const el = this.cardEls.get(id);
      return el ? { top: el.offsetTop, height: el.offsetHeight } : null;
    };
    const heights = [...cols].map((c) => c.clientHeight);
    const targets = core.alignColumns(this.cols, node, pos, heights);
    cols.forEach((col2, d) => {
      if (targets[d] !== null) {
        col2.scrollTo({ top: targets[d], behavior });
      }
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
    const foot = card.querySelector(":scope > .dendrite-card-foot") || card.createDiv({ cls: "dendrite-card-foot" });
    const t = foot.createDiv({ cls: "dendrite-toolbar" });
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
    btn(
      "sliders-horizontal",
      "Card properties: label and limit",
      () => new CardModal(this, this.active).open()
    );
    btn("more-horizontal", "More", () => this.cardMenu(t));
    this.toolbar = t;
  }
  cardMenu(anchor, event) {
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
      "Card properties\u2026",
      "sliders-horizontal",
      () => new CardModal(this, this.active).open()
    );
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
      "Merge into the card above",
      "merge",
      () => this.merge("above")
    );
    item(
      "Merge into the parent card",
      "arrow-left-to-line",
      () => this.merge("parent")
    );
    m.addSeparator();
    item(
      "Delete card and its children (Ctrl+Backspace)",
      "trash-2",
      () => this.deleteActive()
    );
    if (event) {
      m.showAtMouseEvent(event);
      return;
    }
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
    if (e.target.closest(".dendrite-toolbar, textarea, .dendrite-cm, button, .dendrite-quota")) return;
    const card = e.target.closest(".dendrite-card");
    if (card) this.select(card.dataset.id);
    this.contentEl.focus();
  }
  /**
   * Make a card the active one. `move` false highlights it without
   * scrolling, so a menu opened on it stays beside it.
   */
  async select(id, move = true) {
    if (!id || id === this.active) return;
    if (this.editing) await this.endEdit();
    const node = this.byId.get(id);
    if (node && node.parent && node.parent.id) {
      this.lastChild.set(node.parent.id, id);
    }
    this.active = id;
    if (move) this.applyActive();
    else this.highlight();
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
      if (this.editing) return this.editKey("enter");
      if (this.active) this.startEdit(this.active);
      return false;
    });
    s.register(["Mod"], "b", () => this.editKey("bold"));
    s.register(["Mod"], "i", () => this.editKey("italic"));
    s.register([], "Tab", () => this.editKey("indent"));
    s.register(["Shift"], "Tab", () => this.editKey("outdent"));
    s.register([], "Escape", () => {
      if (!this.editing) return true;
      this.endEdit();
      return false;
    });
    s.register(["Mod"], "Enter", () => {
      if (this.editing) return true;
      if (this.active) this.startEdit(this.active);
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
        if (this.editing) return true;
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
  /** Run a text command in the editor; true lets the key through. */
  editKey(cmd) {
    const ed = this.editing;
    if (!ed) return cmd !== "indent" && cmd !== "outdent";
    if (!ed.ta) return true;
    const ta = ed.ta;
    const v = ta.value;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const r = cmd === "bold" ? textedit.wrap(v, s, e, "**") : cmd === "italic" ? textedit.wrap(v, s, e, "*") : cmd === "indent" ? textedit.shiftLines(v, s, e, false) : cmd === "outdent" ? textedit.shiftLines(v, s, e, true) : textedit.enter(v, s, e);
    if (!r) return true;
    ta.focus();
    ta.setSelectionRange(r.start, r.end);
    let done = false;
    try {
      done = r.text ? document.execCommand("insertText", false, r.text) : r.start === r.end || document.execCommand("delete");
    } catch (err) {
      done = false;
    }
    if (!done) {
      ta.setRangeText(r.text, r.start, r.end, "end");
      ta.dispatchEvent(new Event("input"));
    }
    ta.setSelectionRange(r.selStart, r.selEnd);
    return false;
  }
  async startEdit(id, atStart = false) {
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
    const ed = {
      id,
      file: f,
      dirty: false,
      timer: null,
      saving: Promise.resolve()
    };
    const editor = cardEditor(this.app, this, {
      value: core.splitFrontmatter(raw).body,
      file: f,
      onChange: () => {
        ed.dirty = true;
        ed.changed = true;
        this.centre(false);
        this.scheduleCounts();
        clearTimeout(ed.timer);
        ed.timer = setTimeout(
          () => this.save(ed),
          this.plugin.settings.autosaveMs
        );
      },
      onBlur: () => {
        this.save(ed);
      },
      onEscape: () => {
        this.endEdit();
      }
    }, this.plugin.settings.obsidianEditor !== false);
    ed.editor = editor;
    ed.ta = editor.ta || null;
    this.editing = ed;
    const card = this.cardEls.get(id);
    if (card) {
      const body = card.querySelector(".dendrite-card-body");
      body.empty();
      body.appendChild(editor.el);
      card.addClass("is-editing");
      card.toggleClass("has-obsidian-editor", editor.kind === "obsidian");
      card.removeClass("is-pending");
    }
    this.renderToolbar();
    editor.focus(atStart);
    this.showMode();
  }
  /** Write the editor's text to its card, keeping the frontmatter. */
  save(ed) {
    clearTimeout(ed.timer);
    if (!ed.dirty) return ed.saving;
    ed.dirty = false;
    const text = ed.editor.value;
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
    ed.editor.destroy();
    if (ed.changed) await this.plugin.lintCard(ed.file);
    this.invalidate(ed.id);
    const card = this.cardEls.get(ed.id);
    if (card) {
      card.removeClass("is-editing");
      card.removeClass("has-obsidian-editor");
      card.addClass("is-pending");
    }
    await this.renderCard(ed.id);
    this.renderToolbar();
    this.showMode();
    this.contentEl.focus();
  }
  showMode() {
    if (!this.modeEl) return;
    this.modeEl.setText(this.editing ? "INSERT" : "NORMAL");
    this.modeEl.toggleClass("is-insert", !!this.editing);
  }
  /**
   * Vim-style keys in normal mode, when no card is being edited. Plain
   * letters are bound to nothing else here, so they are handled from
   * the pane's own keydown rather than registered in Obsidian's scope.
   */
  onNavKey(e) {
    if (this.editing || e.defaultPrevented) return;
    if (e.target.closest("input, textarea, select, .dendrite-cm")) return;
    if (this.arrowKey(e)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!this.plugin.settings.vimKeys) return;
    const prev = this.pendingKey;
    this.pendingKey = null;
    const k = e.key;
    const act = {
      h: () => this.navigate("left"),
      j: () => this.navigate("down"),
      k: () => this.navigate("up"),
      l: () => this.navigate("right"),
      i: () => this.active && this.startEdit(this.active, true),
      a: () => this.active && this.startEdit(this.active),
      o: () => this.insert("below"),
      O: () => this.insert("above"),
      n: () => this.insert(this.active ? "child" : "first"),
      J: () => this.structural("down"),
      K: () => this.structural("up"),
      ">": () => this.structural("indent"),
      "<": () => this.structural("outdent"),
      u: () => this.doUndo(),
      G: () => this.columnEnd(false)
    }[k];
    if (k === "d" || k === "g") {
      e.preventDefault();
      if (prev === k) {
        if (k === "d") this.deleteActive();
        else this.columnEnd(true);
      } else {
        this.pendingKey = k;
      }
      return;
    }
    if (!act) return;
    e.preventDefault();
    act();
  }
  /** Arrows, Alt and Ctrl arrows, and Enter; true if handled. */
  arrowKey(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === "Enter" && !mod && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      if (this.active) this.startEdit(this.active);
      return true;
    }
    const dir = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right"
    }[e.key];
    if (!dir || e.shiftKey) return false;
    let act = null;
    if (e.altKey && !mod) {
      const op = {
        up: "up",
        down: "down",
        left: "outdent",
        right: "indent"
      }[dir];
      act = () => this.structural(op);
    } else if (mod && !e.altKey) {
      const where = { up: "above", down: "below", right: "child" }[dir];
      if (where) act = () => this.insert(where);
    } else if (!mod && !e.altKey) {
      act = () => this.navigate(dir);
    }
    if (!act) return false;
    e.preventDefault();
    act();
    return true;
  }
  columnEnd(top) {
    const node = this.active && this.byId.get(this.active);
    const col = node ? this.cols[node.depth] : this.cols[0];
    if (!col || !col.length) return;
    this.select((top ? col[0] : col[col.length - 1]).id);
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
  snapshot(files = [], created = []) {
    this.undo.push({
      tree: core.serialiseTree(this.root),
      active: this.active,
      files,
      created
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
  async createCardFile(id, text = "") {
    const folder = this.cardsFolder();
    if (!this.app.vault.getAbstractFileByPath(folder)) {
      await this.app.vault.createFolder(folder);
    }
    return this.app.vault.create(
      normalizePath(`${folder}/${id}.md`),
      text
    );
  }
  /**
   * Move the selection, or everything after the cursor, out of the card
   * being edited into a new card below it or a new last child. The new
   * card is written and indexed before the text leaves the original, so
   * a failure part-way leaves the text twice, never nowhere.
   */
  async moveSelection(where) {
    const ed = this.editing;
    if (!ed) return;
    const prefix = this.prefix();
    if (!prefix || !core.validPrefix(prefix)) {
      new Notice("Dendrite: set a valid dendrite_prefix first.");
      return;
    }
    const original = ed.editor.value;
    const [s, e] = ed.editor.selection();
    const cut = core.splitText(original, s, e);
    if (!cut) {
      new Notice("Dendrite: nothing selected, and nothing after the cursor, to move.");
      return;
    }
    const node = this.byId.get(ed.id);
    if (!node) return;
    const before = core.serialiseTree(this.root);
    const id = core.newId(prefix, (x) => this.taken(x));
    const made = await this.createCardFile(id, cut.moved);
    const fresh = core.makeNode(
      id,
      core.deriveLabel(cut.moved, null),
      null
    );
    if (where === "child") core.appendChild(node, fresh);
    else core.insertSibling(node, fresh, true);
    this.byId.set(id, fresh);
    await this.writeIndex();
    ed.editor.replace(cut.keep, cut.at);
    ed.dirty = true;
    ed.changed = true;
    await this.save(ed);
    this.undo.push({
      tree: before,
      active: ed.id,
      files: [],
      created: [{ path: made.path, body: cut.moved }],
      restores: [{
        path: ed.file.path,
        body: original,
        ifBody: cut.keep
      }]
    });
    if (this.undo.length > UNDO_DEPTH) this.undo.shift();
    this.render();
    ed.editor.focusAt(cut.at);
  }
  /**
   * Merge the active card into the card above it, or into its parent.
   * The receiving card is written with both texts before the merged
   * card's note goes to the trash.
   */
  async merge(kind) {
    const node = this.active && this.byId.get(this.active);
    if (!node) return;
    if (this.editing) await this.endEdit();
    const i = node.parent.children.indexOf(node);
    const target = kind === "above" ? i > 0 ? node.parent.children[i - 1] : null : node.parent.id ? node.parent : null;
    if (!target) {
      new Notice(kind === "above" ? "Dendrite: no card above this one to merge into." : "Dendrite: a top-level card has no parent to merge into.");
      return;
    }
    const src = this.cardFile(node.id);
    const dst = this.cardFile(target.id);
    if (!src || !dst) {
      new Notice("Dendrite: a card note is missing; nothing merged.");
      return;
    }
    const srcText = await this.app.vault.read(src);
    const dstBody = core.splitFrontmatter(
      await this.app.vault.read(dst)
    ).body;
    const merged = core.mergeText(
      dstBody,
      core.splitFrontmatter(srcText).body
    );
    const before = core.serialiseTree(this.root);
    await this.app.vault.process(
      dst,
      (data) => core.splitFrontmatter(data).fm + merged
    );
    if (kind === "above") core.mergeIntoAbove(node);
    else {
      core.mergeIntoParent(node);
      core.remove(node);
    }
    this.reindex();
    this.active = target.id;
    await this.writeIndex();
    this.invalidate(node.id);
    this.invalidate(target.id);
    await this.app.fileManager.trashFile(src);
    this.undo.push({
      tree: before,
      active: node.id,
      files: [{ path: src.path, data: srcText }],
      created: [],
      restores: [{ path: dst.path, body: dstBody, ifBody: merged }]
    });
    if (this.undo.length > UNDO_DEPTH) this.undo.shift();
    await this.syncLabel(target.id, merged);
    this.render();
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
    const made = await this.createCardFile(id);
    this.snapshot([], [made.path]);
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
    for (const entry of snap.created || []) {
      const path = typeof entry === "string" ? entry : entry.path;
      const expect = typeof entry === "string" ? "" : entry.body;
      const f = this.app.vault.getAbstractFileByPath(path);
      if (!(f instanceof TFile)) continue;
      const body = core.splitFrontmatter(
        await this.app.vault.read(f)
      ).body;
      if (body.trim() === expect.trim()) {
        this.invalidate(f.basename);
        await this.app.fileManager.trashFile(f);
      }
    }
    for (const r of snap.restores || []) {
      const f = this.app.vault.getAbstractFileByPath(r.path);
      if (!(f instanceof TFile)) continue;
      const body = core.splitFrontmatter(
        await this.app.vault.read(f)
      ).body;
      if (body.trim() !== r.ifBody.trim()) continue;
      await this.app.vault.process(
        f,
        (data) => core.splitFrontmatter(data).fm + r.body
      );
      this.invalidate(f.basename);
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
    if (!(f instanceof TFile)) return;
    if (f === this.file) {
      this.updateNumbers();
      this.updateCounts();
      return;
    }
    if (!this.byId.has(f.basename)) return;
    this.updateNumbers();
    this.scheduleCounts();
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
  // ---- manuscript settings, numbering and counts ------------------------
  /** The manuscript's settings, from its index note's properties. */
  manuscript() {
    const fm = this.file && this.app.metadataCache.getFileCache(this.file)?.frontmatter || {};
    const top = Number(fm.dendrite_heading_top);
    const wpp = Number(fm.dendrite_words_per_page);
    const cpw = Number(fm.dendrite_chars_per_word);
    return {
      prefix: this.prefix(),
      limit: core.parseLimit(fm.dendrite_limit),
      limitRequired: fm.dendrite_limit_required === true,
      charsPerWord: cpw > 0 ? cpw : 6,
      countSpaces: fm.dendrite_count_spaces !== false,
      wordsPerPage: wpp > 0 ? wpp : 500,
      headingTop: top >= 1 && top <= 6 ? top : this.plugin.settings.headingTop,
      number: fm.dendrite_number_sections === true
    };
  }
  cardProps(id) {
    const f = this.cardFile(id);
    return f && this.app.metadataCache.getFileCache(f)?.frontmatter || {};
  }
  /** Whether a card's text opens with a heading, from Obsidian's cache. */
  hasHeading(id) {
    if (this.editing && this.editing.id === id) {
      return /^\s*#{1,6}\s/.test(this.editing.editor.value);
    }
    const f = this.cardFile(id);
    const sections = f && this.app.metadataCache.getFileCache(f)?.sections;
    const first = (sections || []).find((s) => s.type !== "yaml");
    return !!first && first.type === "heading";
  }
  numbers() {
    if (!this.manuscript().number) return /* @__PURE__ */ new Map();
    return core.sectionNumbers(
      this.root.children,
      (id) => this.hasHeading(id)
    );
  }
  /** Show each section card's number, updated in place. */
  updateNumbers() {
    const nums = this.numbers();
    for (const [id, card] of this.cardEls) {
      let badge = card.querySelector(":scope > .dendrite-num");
      const num = nums.get(id);
      if (!num) {
        if (badge) badge.remove();
        continue;
      }
      if (!badge) {
        badge = createDiv({ cls: "dendrite-num" });
        card.prepend(badge);
      }
      badge.setText(num);
    }
  }
  scheduleCounts() {
    clearTimeout(this.countTimer);
    this.countTimer = setTimeout(() => this.updateCounts(), 400);
  }
  /**
   * Count what each limited card's branch would export, and the whole
   * manuscript, and show them against their limits. Card text is read
   * only when some limit is set, so a manuscript without limits pays
   * nothing for this.
   */
  /** A card's quota, with whether the call requires it. */
  quotaOf(id) {
    const fm = this.cardProps(id);
    const q = core.parseLimit(fm.dendrite_limit);
    return q ? Object.assign(q, {
      required: fm.dendrite_limit_required === true
    }) : null;
  }
  /**
   * Each card with a quota shows what it uses against it and what the
   * quotas below it allocate; the bar does the same for the manuscript
   * total. Over a required quota is an error, over a target a warning.
   * Card text is read only when some quota is set.
   */
  async updateCounts() {
    if (!this.file || !this.board) return;
    const ms = this.manuscript();
    this.quotaReports = /* @__PURE__ */ new Map();
    if (this.totalEl) this.totalEl.empty();
    const any = ms.limit || core.allNodes(this.root).some(
      (n) => this.quotaOf(n.id)
    );
    if (!any) {
      for (const [id, card] of this.cardEls) this.fillQuota(card, id);
      return;
    }
    const bodies = await this.loadBodies();
    const bodyOf = (id) => this.editing && this.editing.id === id ? this.editing.editor.value : bodies.get(id);
    const countOf = (nodes) => core.countText(
      core.exportMarkdown(nodes, bodyOf, 1),
      ms.countSpaces
    );
    const total = ms.limit ? Object.assign(
      {},
      ms.limit,
      { required: ms.limitRequired }
    ) : null;
    const reports = core.quotas(
      this.root,
      (id) => this.quotaOf(id),
      countOf,
      {
        wordsPerPage: ms.wordsPerPage,
        charsPerWord: ms.charsPerWord,
        total
      }
    );
    this.quotaReports = reports;
    for (const [id, card] of this.cardEls) this.fillQuota(card, id);
    if (!this.totalEl) return;
    const top = reports.get(null);
    if (top) {
      this.showQuota(this.totalEl, top);
    } else {
      const n = countOf(this.root.children);
      this.totalEl.setText(`${n.words.toLocaleString()} words`);
    }
  }
  /**
   * A card's quota at its bottom left: a target and a bar filled to its
   * use. Details fade in on hover; a click edits the quota. A card
   * without one shows the target only on hover, to offer setting one.
   */
  renderQuotaWidget(foot, id) {
    const w = foot.createDiv({ cls: "dendrite-quota is-empty" });
    setIcon(w.createSpan({ cls: "dendrite-quota-icon" }), "target");
    const bar = w.createDiv({ cls: "dendrite-quota-bar" });
    bar.createDiv({ cls: "dendrite-quota-fill" });
    w.addEventListener("mouseenter", () => this.showQuotaTip(id, w));
    w.addEventListener("mouseleave", () => this.hideQuotaTip());
    w.addEventListener("click", (e) => {
      e.stopPropagation();
      this.hideQuotaTip();
      this.editQuota(id, w);
    });
    const r = this.quotaReports && this.quotaReports.get(id);
    if (r) this.fillQuota(foot.parentElement, id);
  }
  fillQuota(card, id) {
    const w = card.querySelector(
      ":scope > .dendrite-card-foot > .dendrite-quota"
    );
    if (!w) return;
    const r = this.quotaReports && this.quotaReports.get(id);
    w.removeClass("is-over-required");
    w.removeClass("is-over-target");
    w.toggleClass("is-empty", !r);
    if (!r) return;
    const kind = r.quota.required ? "required" : "target";
    const share = r.used / r.quota.amount;
    const over = share > 1 || r.allocated !== null && r.allocated > r.quota.amount;
    if (over) w.addClass(`is-over-${kind}`);
    w.toggleClass("is-required", r.quota.required);
    w.querySelector(".dendrite-quota-fill").style.width = Math.min(100, Math.round(share * 100)) + "%";
  }
  showQuotaTip(id, anchor) {
    this.hideQuotaTip();
    const tip = document.body.createDiv({ cls: "dendrite-quota-tip" });
    const r = this.quotaReports && this.quotaReports.get(id);
    if (r) this.showQuota(tip, r);
    else tip.setText("No quota. Click to set one.");
    const a = anchor.getBoundingClientRect();
    tip.style.left = a.left + "px";
    tip.style.top = a.top - 6 + "px";
    this.quotaTip = tip;
    requestAnimationFrame(() => tip.addClass("is-shown"));
  }
  hideQuotaTip() {
    if (this.quotaTip) this.quotaTip.remove();
    this.quotaTip = null;
  }
  /** A small editor for a card's quota, beside its target. */
  editQuota(id, anchor) {
    this.closeQuotaEditor();
    const f = this.cardFile(id);
    if (!f) return;
    const fm = this.cardProps(id);
    const q = core.parseLimit(fm.dendrite_limit);
    const pop = document.body.createDiv({ cls: "dendrite-quota-pop" });
    const amount = pop.createEl("input", { type: "text" });
    amount.placeholder = "500, or 1/4";
    amount.value = q ? core.fmtNum(q.amount) : "";
    const unit = pop.createEl("select");
    for (const u of ["words", "characters", "pages"]) {
      unit.createEl("option", { text: u, value: u });
    }
    unit.value = q ? q.unit : "words";
    const label = pop.createEl("label", { cls: "dendrite-quota-req" });
    const req = label.createEl("input", { type: "checkbox" });
    req.checked = fm.dendrite_limit_required === true;
    label.createSpan({ text: "required by the call" });
    const row = pop.createDiv({ cls: "dendrite-quota-actions" });
    const save = row.createEl("button", {
      cls: "mod-cta",
      text: "Save"
    });
    const clear = row.createEl("button", { text: "Remove" });
    const a = anchor.getBoundingClientRect();
    pop.style.left = a.left + "px";
    pop.style.top = a.bottom + 4 + "px";
    const write = async (remove) => {
      const n = core.parseAmount(amount.value);
      const ok = !remove && amount.value.trim() && n > 0;
      await writeProps(this.app, f, {
        dendrite_limit: ok ? core.formatLimit({ amount: n, unit: unit.value }) : null,
        dendrite_limit_required: ok && req.checked ? true : null
      });
      this.closeQuotaEditor();
    };
    save.onclick = () => write(false);
    clear.onclick = () => write(true);
    const scope = new Scope(this.app.scope);
    scope.register([], "Enter", () => {
      write(false);
      return false;
    });
    scope.register([], "Escape", () => {
      this.closeQuotaEditor();
      return false;
    });
    if (this.app.keymap) this.app.keymap.pushScope(scope);
    const outside = (e) => {
      if (!pop.contains(e.target)) this.closeQuotaEditor();
    };
    setTimeout(() => document.addEventListener("mousedown", outside), 0);
    this.quotaPop = { pop, scope, outside };
    amount.focus();
    amount.select();
  }
  closeQuotaEditor() {
    const q = this.quotaPop;
    if (!q) return;
    this.quotaPop = null;
    if (this.app.keymap) this.app.keymap.popScope(q.scope);
    document.removeEventListener("mousedown", q.outside);
    q.pop.remove();
    this.contentEl.focus();
  }
  showQuota(el, r) {
    const q = r.quota;
    const kind = q.required ? "required" : "target";
    const tilde = (est) => est ? "~" : "";
    const used = el.createDiv({ cls: "dendrite-quota-line" });
    used.setText(`${tilde(r.usedEstimated)}${core.fmtNum(r.used)} / ${core.formatLimit(q)}`);
    used.createSpan({ cls: "dendrite-quota-kind", text: kind });
    if (r.used > q.amount) used.addClass(`is-over-${kind}`);
    if (r.allocated === null) return;
    const alloc = el.createDiv({ cls: "dendrite-quota-line dendrite-quota-alloc" });
    const left = q.amount - r.allocated;
    alloc.setText(left >= 0 ? `${tilde(r.allocatedEstimated)}${core.fmtNum(r.allocated)} allocated, ${core.fmtNum(left)} free` : `${tilde(r.allocatedEstimated)}${core.fmtNum(r.allocated)} allocated, ${core.fmtNum(-left)} over`);
    if (left < 0) alloc.addClass(`is-over-${kind}`);
    el.setAttr("aria-label", r.usedEstimated || r.allocatedEstimated ? "Figures marked ~ are estimates, from words per page or characters per word in the manuscript settings." : "");
  }
  async loadBodies() {
    this.bodies = this.bodies || /* @__PURE__ */ new Map();
    for (const n of core.allNodes(this.root)) {
      const f = this.cardFile(n.id);
      if (!f) continue;
      const had = this.bodies.get(n.id);
      if (had && had.mtime === f.stat.mtime) continue;
      const text = await this.app.vault.cachedRead(f);
      this.bodies.set(n.id, {
        mtime: f.stat.mtime,
        body: core.splitFrontmatter(text).body
      });
    }
    const out = /* @__PURE__ */ new Map();
    for (const [id, b] of this.bodies) out.set(id, b.body);
    return out;
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
    const ms = this.manuscript();
    const text = core.exportMarkdown(
      scope,
      (id) => bodies.get(id),
      ms.headingTop,
      this.numbers()
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
function quotaSetting(container, name, desc, current, required, draft) {
  let amount = current ? core.fmtNum(current.amount) : "";
  let unit = current ? current.unit : "words";
  let req = !!required;
  const emit = () => {
    const n = core.parseAmount(amount);
    const ok = amount.trim() && n > 0;
    draft.dendrite_limit = ok ? core.formatLimit({ amount: n, unit }) : null;
    draft.dendrite_limit_required = ok && req ? true : null;
  };
  new Setting(container).setName(name).setDesc(desc).addText((t) => t.setPlaceholder("none, or 500, or 1/4").setValue(amount).onChange((v) => {
    amount = v;
    emit();
  })).addDropdown((d) => d.addOption("words", "words").addOption("characters", "characters").addOption("pages", "pages").setValue(unit).onChange((v) => {
    unit = v;
    emit();
  }));
  new Setting(container).setName("Required by the call").setDesc("On: a limit the call sets, shown red when exceeded. Off: your own allocation, shown amber.").addToggle((tg) => tg.setValue(req).onChange((v) => {
    req = v;
    emit();
  }));
}
var ManuscriptModal = class extends Modal {
  constructor(view) {
    super(view.app);
    this.view = view;
  }
  onOpen() {
    const { contentEl } = this;
    const view = this.view;
    const ms = view.manuscript();
    const draft = {};
    this.titleEl.setText(`${view.file.basename}: settings`);
    new Setting(contentEl).setName("Prefix").setDesc("Starts every card ID in this manuscript. Fixed once cards exist, since their file names carry it.").addText((t) => t.setValue(ms.prefix || "").setDisabled(true));
    quotaSetting(
      contentEl,
      "Total quota",
      "For the whole manuscript, shown in the top bar against what it uses and what its sections allocate.",
      ms.limit,
      ms.limitRequired,
      draft
    );
    new Setting(contentEl).setName("Count spaces in characters").setDesc("Funding portals differ; check the call.").addToggle((tg) => tg.setValue(ms.countSpaces).onChange((v) => {
      draft.dendrite_count_spaces = v;
    }));
    new Setting(contentEl).setName("Words per page").setDesc("Only for page estimates while writing. The real count depends on the final layout.").addText((t) => t.setValue(String(ms.wordsPerPage)).onChange((v) => {
      draft.dendrite_words_per_page = Number(v) > 0 ? Number(v) : null;
    }));
    new Setting(contentEl).setName("Characters per word").setDesc("Only for comparing quotas set in characters with quotas in words or pages, an estimate.").addText((t) => t.setValue(String(ms.charsPerWord)).onChange((v) => {
      draft.dendrite_chars_per_word = Number(v) > 0 ? Number(v) : null;
    }));
    new Setting(contentEl).setName("Number sections by position").setDesc("Write headings without numbers; sections are numbered from where they sit, and renumber when moved.").addToggle((tg) => tg.setValue(ms.number).onChange((v) => {
      draft.dendrite_number_sections = v;
    }));
    new Setting(contentEl).setName("Top section heading level").setDesc("Export writes top-level sections at this level.").addDropdown((d) => {
      for (let i = 1; i <= 4; i++) d.addOption(String(i), "H" + i);
      d.setValue(String(ms.headingTop)).onChange((v) => {
        draft.dendrite_heading_top = Number(v);
      });
    });
    new Setting(contentEl).addButton((b) => b.setButtonText("Save").setCta().onClick(async () => {
      await writeProps(view.app, view.file, draft);
      this.close();
    }));
  }
  onClose() {
    this.contentEl.empty();
  }
};
var CardModal = class extends Modal {
  constructor(view, id) {
    super(view.app);
    this.view = view;
    this.id = id;
  }
  onOpen() {
    const { contentEl } = this;
    const view = this.view;
    const fm = view.cardProps(this.id);
    const aliases = Array.isArray(fm.aliases) ? fm.aliases : fm.aliases ? [fm.aliases] : [];
    const draft = {};
    this.titleEl.setText("Card properties");
    new Setting(contentEl).setName("Label").setDesc("Shown in the index when the card does not open with a heading. Stored as the card's first alias.").addText((t) => t.setValue(aliases[0] || "").onChange((v) => {
      const rest = aliases.slice(1);
      draft.aliases = v.trim() ? [v.trim(), ...rest] : rest.length ? rest : null;
    }));
    quotaSetting(
      contentEl,
      "Quota",
      "For this card and everything under it, counted from what export would write. Quotas on cards below are allocations from it.",
      core.parseLimit(fm.dendrite_limit),
      fm.dendrite_limit_required === true,
      draft
    );
    new Setting(contentEl).addButton((b) => b.setButtonText("Save").setCta().onClick(async () => {
      const f = view.cardFile(this.id);
      if (f) await writeProps(view.app, f, draft);
      this.close();
    }));
  }
  onClose() {
    this.contentEl.empty();
  }
};
async function writeProps(app, file, draft) {
  if (!Object.keys(draft).length) return;
  await app.fileManager.processFrontMatter(file, (fm) => {
    for (const [k, v] of Object.entries(draft)) {
      if (v === null || v === void 0) delete fm[k];
      else fm[k] = v;
    }
  });
}
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
  // Linter's ignore list follows the writing folder once the settings
  // are closed, not on every keystroke while the folder is typed.
  hide() {
    this.plugin.syncLinter();
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
    new Setting(containerEl).setName("Keep Linter out of the writing folder").setDesc("Adds the writing folder to the Linter plugin's folders to ignore, so its rules never rewrite a card. Off removes the entry, if Dendrite added it.").addToggle((tg) => tg.setValue(s.manageLinter).onChange((v) => {
      s.manageLinter = v;
      save();
    }));
    new Setting(containerEl).setName("Clean up cards with Linter").setDesc(`When you leave a card you changed, run the Linter plugin's rules on it, except those that break cards, such as "File name heading".`).addToggle((tg) => tg.setValue(s.lintCards).onChange((v) => {
      s.lintCards = v;
      save();
    }));
    new Setting(containerEl).setName("Use Obsidian's editor in cards").setDesc("Live preview, link and citation suggestions, and editor commands inside a card. Off, or if Obsidian's editor cannot start, cards use a plain text box.").addToggle((tg) => tg.setValue(s.obsidianEditor).onChange((v) => {
      s.obsidianEditor = v;
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
    new Setting(containerEl).setName("Vim-style keys").setDesc("In normal mode: h j k l to move, i or a to edit, o and O for a new card below or above, n for a child, J and K to move a card, > and < to indent, dd to delete, u to undo, gg and G for the column's ends.").addToggle((tg) => tg.setValue(s.vimKeys).onChange((v) => {
      s.vimKeys = v;
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
      this.syncLinter();
    });
    const viewCommand = (id, name, needsEdit, run) => this.addCommand({
      id,
      name,
      checkCallback: (checking) => {
        const v = this.app.workspace.getActiveViewOfType(
          DendriteView
        );
        if (!v || (needsEdit ? !v.editing : !v.active)) return false;
        if (!checking) run(v);
        return true;
      }
    });
    viewCommand(
      "move-to-card-below",
      "Move selection, or the rest of the card, to a new card below",
      true,
      (v) => v.moveSelection("below")
    );
    viewCommand(
      "move-to-child-card",
      "Move selection, or the rest of the card, to a new child card",
      true,
      (v) => v.moveSelection("child")
    );
    viewCommand(
      "merge-into-above",
      "Merge card into the card above",
      false,
      (v) => v.merge("above")
    );
    viewCommand(
      "merge-into-parent",
      "Merge card into its parent",
      false,
      (v) => v.merge("parent")
    );
    this.registerEvent(this.app.workspace.on(
      "editor-menu",
      (menu, editor, info) => {
        const v = this.app.workspace.getLeavesOfType(VIEW).map((l) => l.view).find((x) => x.editing && info && info.file === x.editing.file);
        if (!v) return;
        const sel = editor.somethingSelected();
        const what = sel ? "selection" : "rest of the card";
        menu.addSeparator();
        menu.addItem((i) => i.setTitle(`Move ${what} to a new card below`).setIcon("arrow-down").onClick(() => v.moveSelection("below")));
        menu.addItem((i) => i.setTitle(`Move ${what} to a new child card`).setIcon("corner-down-right").onClick(() => v.moveSelection("child")));
      }
    ));
    this.registerEvent(this.app.workspace.on("file-menu", (menu, f) => {
      if (!isIndex(this.app, f)) return;
      menu.addItem((i) => i.setTitle("Open in Dendrite").setIcon("list-tree").onClick(() => this.openIndex(f)));
    }));
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  linter() {
    const p = this.app.plugins && this.app.plugins.plugins;
    return p && p[LINTER_ID] || null;
  }
  /**
   * Run Linter's clean-up on one card, as its lint on save would, with
   * the rules that break cards switched off for that run only. Linter's
   * own triggers skip the writing folder, so this is the only way a
   * card is linted. It calls Linter's runLinterFile, which is not public
   * API: if a Linter update removes it, cards are left unlinted.
   */
  async lintCard(file) {
    const linter = this.linter();
    if (!this.settings.lintCards || !linter) return;
    if (linter.isEnabled === false) return;
    if (typeof linter.runLinterFile !== "function") return;
    if (!linter.settings || !linter.settings.ruleConfigs) return;
    const original = linter.settings;
    const rules = Object.assign({}, original.ruleConfigs);
    for (const id of CARD_UNSAFE_RULES) {
      if (rules[id]) rules[id] = Object.assign(
        {},
        rules[id],
        { enabled: false }
      );
    }
    linter.settings = Object.assign({}, original, { ruleConfigs: rules });
    try {
      await linter.runLinterFile(file);
    } catch (err) {
      console.error("Dendrite: Linter clean-up failed", err);
    } finally {
      linter.settings = original;
    }
  }
  /**
   * Keep the writing folder in Linter's folders to ignore, so Linter's
   * rules, "File name heading" above all, never rewrite a card. Only an
   * entry Dendrite added is ever removed, and Linter's own settings
   * object is changed, so the change applies without a reload.
   */
  async syncLinter() {
    const linter = this.linter();
    const ls = linter && linter.settings;
    if (!ls || !Array.isArray(ls.foldersToIgnore)) return;
    const want = this.settings.manageLinter ? normalizePath(this.settings.writingFolder) : null;
    const list = ls.foldersToIgnore;
    const had = this.settings.linterAdded;
    let changed = false;
    if (had && had !== want && list.includes(had)) {
      list.splice(list.indexOf(had), 1);
      changed = true;
    }
    let added = had === want ? had : null;
    if (want && !list.includes(want)) {
      list.push(want);
      added = want;
      changed = true;
      new Notice(`Dendrite added ${want} to Linter's folders to ignore, so Linter does not rewrite cards. This is a setting in Dendrite.`);
    }
    if (changed) {
      if (typeof linter.saveSettings === "function") {
        await linter.saveSettings();
      } else {
        await linter.saveData(ls);
      }
    }
    if (added !== this.settings.linterAdded) {
      this.settings.linterAdded = added;
      await this.saveSettings();
    }
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
