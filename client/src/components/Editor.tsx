import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, highlightActiveLineGutter, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { slashCommands } from '../lib/markdownActions';

interface EditorProps {
  initialValue: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  onReady?: () => void;
}

export interface EditorHandle {
  getView: () => EditorView | null;
}

/** Slash command completions triggered by "/" */
function slashCompletions(context: CompletionContext): CompletionResult | null {
  // Match "/" at start of line or after whitespace
  const match = context.matchBefore(/(?:^|\s)\//);
  if (!match) return null;

  // The slash position
  const slashPos = match.from + (match.text.startsWith('/') ? 0 : 1);

  return {
    from: slashPos,
    options: slashCommands.map(cmd => ({
      label: `/ ${cmd.label}`,
      detail: cmd.detail,
      apply: (view: EditorView, _completion: any, from: number, to: number) => {
        view.dispatch({
          changes: { from, to, insert: cmd.apply },
        });
      },
    })),
    filter: true,
  };
}

const Editor = forwardRef<EditorHandle, EditorProps>(
  ({ initialValue, onChange, readOnly = false, onReady }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

    useImperativeHandle(ref, () => ({
      getView: () => viewRef.current,
    }));

    useEffect(() => {
      if (!editorRef.current) return;

      const customTheme = EditorView.theme({
        "&": {
          backgroundColor: "var(--bg)",
          color: "var(--text)",
          height: "100%",
          fontFamily: "var(--font-mono)",
        },
        ".cm-content": {
          caretColor: "var(--text)",
        },
        "&.cm-focused .cm-cursor": {
          borderLeftColor: "var(--text)",
        },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
          backgroundColor: "var(--lavender) !important",
        },
        ".cm-panels": {
          backgroundColor: "var(--bg-secondary)",
          color: "var(--text)",
        },
        ".cm-panels.cm-panels-top": {
          borderBottom: "2px solid var(--border)",
        },
        ".cm-panels.cm-panels-bottom": {
          borderTop: "2px solid var(--border)",
        },
        ".cm-activeLine": {
          backgroundColor: "rgba(186,225,255,0.2)",
        },
        // Style the autocomplete tooltip for slash commands
        ".cm-tooltip.cm-tooltip-autocomplete": {
          background: "var(--bg-card)",
          border: "2.5px solid var(--border)",
          borderRadius: "8px",
          boxShadow: "4px 4px 0px var(--border)",
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          overflow: "hidden",
        },
        ".cm-tooltip.cm-tooltip-autocomplete ul": {
          maxHeight: "260px",
        },
        ".cm-tooltip.cm-tooltip-autocomplete ul li": {
          padding: "6px 12px",
          borderBottom: "1px solid #eee",
        },
        ".cm-tooltip.cm-tooltip-autocomplete ul li[aria-selected]": {
          background: "var(--yellow)",
          color: "var(--text)",
        },
        ".cm-completionLabel": {
          fontWeight: "600",
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
        },
        ".cm-completionDetail": {
          color: "var(--text-muted)",
          fontSize: "11px",
          fontStyle: "normal",
          marginLeft: "8px",
        },
      });

      // Keybindings for bold/italic
      const markdownKeymap = keymap.of([
        {
          key: "Mod-b",
          run: (view) => {
            const { from, to } = view.state.selection.main;
            const sel = view.state.sliceDoc(from, to) || 'bold text';
            view.dispatch({
              changes: { from, to, insert: `**${sel}**` },
              selection: { anchor: from + 2, head: from + 2 + sel.length },
            });
            return true;
          },
        },
        {
          key: "Mod-i",
          run: (view) => {
            const { from, to } = view.state.selection.main;
            const sel = view.state.sliceDoc(from, to) || 'italic text';
            view.dispatch({
              changes: { from, to, insert: `*${sel}*` },
              selection: { anchor: from + 1, head: from + 1 + sel.length },
            });
            return true;
          },
        },
      ]);

      const state = EditorState.create({
        doc: initialValue,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          history(),
          closeBrackets(),
          autocompletion({
            override: [slashCompletions],
            activateOnTyping: true,
          }),
          highlightActiveLine(),
          highlightSelectionMatches(),
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          customTheme,
          EditorView.lineWrapping,
          EditorState.readOnly.of(readOnly),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChange(update.state.doc.toString());
            }
          }),
          markdownKeymap,
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...completionKeymap,
          ]),
        ],
      });

      const view = new EditorView({
        state,
        parent: editorRef.current,
      });
      
      viewRef.current = view;
      if (onReady) onReady();

      return () => {
        view.destroy();
      };
    }, []); // Initialize once

    // Update content if initialValue changes (e.g., switching tabs)
    useEffect(() => {
      if (viewRef.current) {
        const currentValue = viewRef.current.state.doc.toString();
        if (initialValue !== currentValue) {
          viewRef.current.dispatch({
            changes: { from: 0, to: currentValue.length, insert: initialValue }
          });
        }
      }
    }, [initialValue]);

    return <div ref={editorRef} className="editor-pane" />;
  }
);

Editor.displayName = 'Editor';
export default Editor;
