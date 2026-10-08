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

To reopen a manuscript, open its index note and run **Dendrite: Open the current index note in Dendrite**, or use the file's context menu.

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
