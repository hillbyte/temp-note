import { EditorView } from '@codemirror/view';

export interface MarkdownAction {
  label: string;
  icon: string;
  shortcut?: string;
  action: (view: EditorView) => void;
}

/** Wraps selected text with prefix/suffix, or inserts placeholder */
function wrapSelection(view: EditorView, prefix: string, suffix: string, placeholder: string) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const text = selected || placeholder;
  const wrapped = `${prefix}${text}${suffix}`;

  view.dispatch({
    changes: { from, to, insert: wrapped },
    selection: {
      anchor: from + prefix.length,
      head: from + prefix.length + text.length,
    },
  });
  view.focus();
}

/** Inserts text at cursor, then places cursor at offset from start of insert */
function insertAt(view: EditorView, text: string, cursorOffset?: number) {
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + (cursorOffset ?? text.length) },
  });
  view.focus();
}

/** Toggles a line prefix (e.g. "## ") on the current line */
function toggleLinePrefix(view: EditorView, prefix: string) {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const lineText = line.text;

  if (lineText.startsWith(prefix)) {
    // Remove prefix
    view.dispatch({
      changes: { from: line.from, to: line.from + prefix.length, insert: '' },
    });
  } else {
    // Add prefix
    view.dispatch({
      changes: { from: line.from, insert: prefix },
    });
  }
  view.focus();
}

export const markdownActions: MarkdownAction[] = [
  {
    label: 'Bold',
    icon: 'B',
    shortcut: 'Ctrl+B',
    action: (view) => wrapSelection(view, '**', '**', 'bold text'),
  },
  {
    label: 'Italic',
    icon: 'I',
    shortcut: 'Ctrl+I',
    action: (view) => wrapSelection(view, '*', '*', 'italic text'),
  },
  {
    label: 'Strikethrough',
    icon: 'S̶',
    action: (view) => wrapSelection(view, '~~', '~~', 'strikethrough'),
  },
  {
    label: 'Heading 1',
    icon: 'H1',
    action: (view) => toggleLinePrefix(view, '# '),
  },
  {
    label: 'Heading 2',
    icon: 'H2',
    action: (view) => toggleLinePrefix(view, '## '),
  },
  {
    label: 'Heading 3',
    icon: 'H3',
    action: (view) => toggleLinePrefix(view, '### '),
  },
  {
    label: 'Bullet List',
    icon: '•',
    action: (view) => toggleLinePrefix(view, '- '),
  },
  {
    label: 'Numbered List',
    icon: '1.',
    action: (view) => toggleLinePrefix(view, '1. '),
  },
  {
    label: 'Task List',
    icon: '☐',
    action: (view) => toggleLinePrefix(view, '- [ ] '),
  },
  {
    label: 'Blockquote',
    icon: '❝',
    action: (view) => toggleLinePrefix(view, '> '),
  },
  {
    label: 'Inline Code',
    icon: '</>',
    action: (view) => wrapSelection(view, '`', '`', 'code'),
  },
  {
    label: 'Code Block',
    icon: '{ }',
    action: (view) => {
      const { from, to } = view.state.selection.main;
      const selected = view.state.sliceDoc(from, to);
      const block = `\`\`\`\n${selected || 'code here'}\n\`\`\``;
      view.dispatch({
        changes: { from, to, insert: block },
        selection: { anchor: from + 4, head: from + 4 + (selected || 'code here').length },
      });
      view.focus();
    },
  },
  {
    label: 'Link',
    icon: '🔗',
    action: (view) => {
      const { from, to } = view.state.selection.main;
      const selected = view.state.sliceDoc(from, to);
      const text = selected || 'link text';
      const insert = `[${text}](url)`;
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + text.length + 3, head: from + text.length + 6 },
      });
      view.focus();
    },
  },
  {
    label: 'Horizontal Rule',
    icon: '—',
    action: (view) => insertAt(view, '\n---\n'),
  },
  {
    label: 'Table',
    icon: '▦',
    action: (view) => insertAt(view, '\n| Header | Header |\n| ------ | ------ |\n| Cell   | Cell   |\n', 9),
  },
];

/** Slash command definitions for the "/" autocomplete menu */
export interface SlashCommand {
  label: string;
  detail: string;
  apply: string;
}

export const slashCommands: SlashCommand[] = [
  { label: 'Heading 1', detail: 'Large heading', apply: '# ' },
  { label: 'Heading 2', detail: 'Medium heading', apply: '## ' },
  { label: 'Heading 3', detail: 'Small heading', apply: '### ' },
  { label: 'Bold', detail: 'Bold text', apply: '**bold text**' },
  { label: 'Italic', detail: 'Italic text', apply: '*italic text*' },
  { label: 'Strikethrough', detail: 'Crossed out text', apply: '~~strikethrough~~' },
  { label: 'Bullet List', detail: 'Unordered list item', apply: '- ' },
  { label: 'Numbered List', detail: 'Ordered list item', apply: '1. ' },
  { label: 'Task', detail: 'Checkbox item', apply: '- [ ] ' },
  { label: 'Blockquote', detail: 'Quoted text', apply: '> ' },
  { label: 'Code Inline', detail: 'Inline code', apply: '`code`' },
  { label: 'Code Block', detail: 'Fenced code block', apply: '```\ncode here\n```' },
  { label: 'Link', detail: 'Hyperlink', apply: '[text](url)' },
  { label: 'Table', detail: '2x2 table', apply: '| Header | Header |\n| ------ | ------ |\n| Cell   | Cell   |' },
  { label: 'Horizontal Rule', detail: 'Divider line', apply: '---' },
  { label: 'Callout', detail: 'Info callout', apply: '> **Note:** ' },
  { label: 'Footnote', detail: 'Add footnote', apply: '[^1]: ' },
];
