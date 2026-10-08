# Dendrite

Column-and-card writing in Obsidian, in the style of [Gingko Writer](https://gingkowriter.com/), for manuscripts, grants and long documents. The argument sits in the left columns and the prose in the right, and export assembles the manuscript from the cards.

Dendrite keeps everything in plain notes:

- **Each card is an ordinary note**, named by an ID such as `GRANT-2026-k3f9q`.
- **A manuscript's index note holds the tree** as a nested list of links:

  ```markdown
  - [[GRANT-2026-7kq2m|Specific Aims]]
      - [[GRANT-2026-c4x9p|Aim 1]]
          - [[GRANT-2026-f81rw|Aim 1 rationale]]
  ```

Without the plugin, the index still reads as a clickable outline and every card as a note. Dendrite stores nothing about a document anywhere else.

## Install

Through [BRAT](https://github.com/TfTHacker/obsidian42-brat): add `ddtam/dendrite` as a beta plugin.

## Use

Run **Dendrite: New manuscript**, give it a title and a prefix, and it creates:

```text
<writing folder>/<title>/
    <title>.md     the index note, with dendrite_prefix in its properties
    cards/         one note per card
```

Opening an index note shows it in Dendrite; **Index** in the view's bar opens its markdown instead. A card or index note open as markdown has a Dendrite button in its tab header, which opens the manuscript at that card.

## Writing a card

A **section card** starts with a heading line, `# Research Outline`. The `#` marks the line as a heading; its level comes from the card's depth, so you never choose it. Write numbers into headings yourself, or turn on **Number sections by position** in the manuscript's settings and leave them out: sections are then numbered from where they sit, `1.`, `1.2`, in the view and in export, and renumber when moved. The numbers are never written into your notes.

In the editor:

| Key | Action |
| --- | --- |
| Ctrl+B / Ctrl+I | Bold / italic the selection |
| Tab / Shift+Tab | Indent / outdent the line, or every selected line |
| Enter in a list | Continue the list; on an empty item, end it |

| Key | Action |
| --- | --- |
| Arrow keys | Move between cards: up and down within a column, left to the parent, right to a child |
| Enter, or double-click | Edit the card |
| Escape, or Ctrl+Enter | Save and leave the editor |
| Ctrl+↓ / Ctrl+↑ (or Ctrl+J / Ctrl+K) | New card below / above |
| Ctrl+→ (or Ctrl+L) | New child card |
| Alt+↑ / Alt+↓ | Move the card among its siblings |
| Alt+→ / Alt+← | Indent under the card above / outdent |
| Ctrl+Backspace | Delete the card and its children |
| Ctrl+Z | Undo the last structural change |

On a phone, the active card's toolbar offers the same actions.

**Text is never discarded.** A card saves while you type and again whenever you leave it, Escape included. Deleted cards go to Obsidian's trash, and Ctrl+Z restores them.

## Manuscript settings and card properties

**Settings** in the bar edits the manuscript's properties on its index note: a total limit, whether characters count spaces, words per page for page estimates, numbering, and the top heading level for export. The **sliders** button on a card edits its label and its limit.

A limit is in words, characters or pages, and is counted from what export would write for that card's branch, so planning text and comments never count. Pages are an estimate from words per page. The bar shows the manuscript's total, and warns when the sections' limits add up to more than the total.

| Property | Where | Holds |
| --- | --- | --- |
| `dendrite_prefix` | index | the card ID prefix |
| `dendrite_limit` | index or card | `500 words`, `2000 characters`, `1 page` |
| `dendrite_count_spaces` | index | `false` to count characters without spaces |
| `dendrite_words_per_page` | index | for page estimates, default 500 |
| `dendrite_number_sections` | index | `true` to number sections by position |
| `dendrite_heading_top` | index | the heading level of a top-level section |

## Labels

The index shows each card by a label: the card's heading line if it starts with one, else the first of its `aliases`, else its first words. Dendrite keeps the index's labels in step with the cards, so edit a label in the card, not in the index.

## Export

**Export** in the view's toolbar, or **Export this branch** in a card's menu, writes markdown to `exports/` beside the index:

- **A card with children is a section.** Its heading line becomes a heading at the level its depth gives. Its other text is planning and is left out.
- **A card with no children is prose** and is exported whole.
- **`%% comments %%` are left out** everywhere, so planning can sit beside prose.

## Development

```bash
npm install
npm test          # core and view tests against an in-memory vault
npm run build     # bundles src/ into main.js
```

## Acknowledgements

Inspired by [Gingko Writer](https://gingkowriter.com/) and by [Lineage](https://github.com/ycnmhd/obsidian-lineage) by ycnmhd, which brought the Gingko model to Obsidian.
