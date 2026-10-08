'use strict';
/*
 * Editing commands for the card editor, as pure functions. Each takes the
 * text and the selection and returns the edit to make, as a range to
 * replace and the selection afterwards, or null to let the key through.
 * main.js applies the edit with the browser's insertText, which keeps the
 * text area's own undo history.
 */

const INDENT = '    ';
const LIST = /^(\s*)([-*+]|(\d+)([.)]))(\s+)(\[.\]\s+)?/;

function lineStart(text, i) {
    return text.lastIndexOf('\n', i - 1) + 1;
}

function lineEnd(text, i) {
    const j = text.indexOf('\n', i);
    return j < 0 ? text.length : j;
}

/** Wrap the selection in a marker, or unwrap it if already wrapped. */
function wrap(text, s, e, mark) {
    const sel = text.slice(s, e);
    const n = mark.length;
    if (text.slice(s - n, s) === mark && text.slice(e, e + n) === mark) {
        return { start: s - n, end: e + n, text: sel,
                 selStart: s - n, selEnd: e - n };
    }
    return { start: s, end: e, text: mark + sel + mark,
             selStart: s + n, selEnd: e + n };
}

/** Indent, or outdent, every line the selection touches. */
function shiftLines(text, s, e, outdent) {
    const a = lineStart(text, s);
    const b = lineEnd(text, e > s && text[e - 1] === '\n' ? e - 1 : e);
    const lines = text.slice(a, b).split('\n');
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
        start: a, end: b, text: out.join('\n'),
        selStart: Math.max(a, s + firstDelta),
        selEnd: Math.max(a, e + total),
    };
}

/**
 * Enter inside a list item continues the list; on an empty item it ends
 * the list instead. Anywhere else the key goes through.
 */
function enter(text, s, e) {
    if (s !== e) return null;
    const a = lineStart(text, s);
    const line = text.slice(a, lineEnd(text, s));
    const m = LIST.exec(line);
    if (!m) return null;
    if (line.trim() === m[0].trim()) {
        return { start: a, end: a + line.length, text: '',
                 selStart: a, selEnd: a };
    }
    const marker = m[3] ? String(Number(m[3]) + 1) + m[4] : m[2];
    const task = m[6] ? '[ ] ' : '';
    const insert = '\n' + m[1] + marker + m[5] + task;
    return { start: s, end: s, text: insert,
             selStart: s + insert.length, selEnd: s + insert.length };
}

module.exports = { wrap, shiftLines, enter };
