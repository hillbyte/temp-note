import { EditorView } from '@codemirror/view';
import { markdownActions } from '../lib/markdownActions';

interface MarkdownToolbarProps {
  editorView: EditorView | null;
}

export default function MarkdownToolbar({ editorView }: MarkdownToolbarProps) {
  if (!editorView) return null;

  // Group actions for visual separation
  const textGroup = markdownActions.slice(0, 3);   // Bold, Italic, Strikethrough
  const headingGroup = markdownActions.slice(3, 6); // H1, H2, H3
  const listGroup = markdownActions.slice(6, 10);   // Bullet, Numbered, Task, Blockquote
  const codeGroup = markdownActions.slice(10, 12);  // Inline Code, Code Block
  const insertGroup = markdownActions.slice(12);     // Link, Image, HR, Table

  const renderGroup = (group: typeof markdownActions, key: string) => (
    <div className="md-toolbar-group" key={key}>
      {group.map(action => (
        <button
          key={action.label}
          className="md-toolbar-btn"
          title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
          onClick={() => action.action(editorView)}
          onMouseDown={e => e.preventDefault()} // Prevent editor blur
        >
          {action.icon}
        </button>
      ))}
    </div>
  );

  return (
    <div className="md-toolbar">
      {renderGroup(textGroup, 'text')}
      <div className="md-toolbar-sep" />
      {renderGroup(headingGroup, 'heading')}
      <div className="md-toolbar-sep" />
      {renderGroup(listGroup, 'list')}
      <div className="md-toolbar-sep" />
      {renderGroup(codeGroup, 'code')}
      <div className="md-toolbar-sep" />
      {renderGroup(insertGroup, 'insert')}
      <div style={{ flex: 1 }} />
      <div className="md-toolbar-hint">
        Type <kbd>/</kbd> for commands
      </div>
    </div>
  );
}
