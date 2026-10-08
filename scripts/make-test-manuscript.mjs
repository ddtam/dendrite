// Write a thesis-scale test manuscript for profiling Dendrite: 6 chapters
// of 40 sections of 10 paragraphs, 2,646 cards. The size is chosen for the
// test, not measured from a real thesis.
//
// Usage: node scripts/make-test-manuscript.mjs <folder inside a vault>
// Creates <folder>/Dendrite thesis test/ with its index and cards/.
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const target = process.argv[2];
if (!target) {
    console.error('usage: node scripts/make-test-manuscript.mjs <folder>');
    process.exit(1);
}
const dir = join(target, 'Dendrite thesis test');
try {
    await access(dir);
    console.error(`${dir} exists; remove it first.`);
    process.exit(1);
} catch { /* absent, as wanted */ }
await mkdir(join(dir, 'cards'), { recursive: true });

const PREFIX = 'DTEST';
const words = ('lorem ipsum dolor sit amet consectetur adipiscing elit ' +
    'sed do eiusmod tempor incididunt ut labore et dolore magna ' +
    'aliqua enim').split(' ');
let n = 0;
const id = () => `${PREFIX}-${(n++).toString(36).padStart(5, '0')}`;
const prose = (k) => {
    const out = [];
    for (let i = 0; i < 90; i++) out.push(words[(i * 7 + k) % words.length]);
    return out.join(' ') + '.';
};

const lines = [];
const cards = [];
for (let c = 0; c < 6; c++) {
    const cid = id();
    lines.push(`- [[${cid}|Chapter ${c + 1}]]`);
    cards.push([cid, `# Chapter ${c + 1}\nWhat this chapter argues.`]);
    for (let s = 0; s < 40; s++) {
        const sid = id();
        lines.push(`    - [[${sid}|Section ${c + 1}.${s + 1}]]`);
        cards.push([sid, `## Section ${c + 1}.${s + 1}\nPlanning.`]);
        for (let p = 0; p < 10; p++) {
            const pid = id();
            const text = prose(c * 400 + s * 10 + p);
            lines.push(`        - [[${pid}|${text.split(' ')
                .slice(0, 8).join(' ')}…]]`);
            cards.push([pid, text]);
        }
    }
}
await writeFile(join(dir, 'Dendrite thesis test.md'),
                `---\ndendrite_prefix: ${PREFIX}\n---\n${lines.join('\n')}\n`);
for (const [cid, text] of cards) {
    await writeFile(join(dir, 'cards', `${cid}.md`), text + '\n');
}
console.log(`wrote ${cards.length} cards and the index to ${dir}`);
