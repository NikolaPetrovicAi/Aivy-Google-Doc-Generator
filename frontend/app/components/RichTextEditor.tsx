import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import React, { useEffect, useState, useCallback } from 'react';
import { Sparkles, Type, AlignLeft, Scissors, ArrowRightLeft } from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  index: number;
  onPageUpdate: (index: number, html: string) => void;
  onFocus: (editor: Editor) => void;
  onEditorReady: (editor: Editor | null) => void;
  editable?: boolean;
}

const RichTextEditor = ({
  content,
  index,
  onPageUpdate,
  onFocus,
  onEditorReady,
  editable = true,
}: RichTextEditorProps) => {
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({}),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: content,
    editable,
    onUpdate: ({ editor }) => {
      onPageUpdate(index, editor.getHTML());
    },
    onFocus: ({ editor }) => {
      onFocus(editor);
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from === to) {
        setMenuPos(null);
        return;
      }

      // Calculate position for custom bubble menu
      const { view } = editor;
      const start = view.coordsAtPos(from);
      const end = view.coordsAtPos(to);
      
      const left = (start.left + end.left) / 2;
      const top = start.top - 40; // Position above the text

      setMenuPos({ top, left });
    },
  });

  const handleAiAction = useCallback(async (command: string) => {
    if (!editor || isAiProcessing) return;

    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');

    if (!selectedText) return;

    setIsAiProcessing(true);
    try {
      const response = await fetch('http://localhost:8080/api/ai/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selectedText, command }),
        credentials: 'include',
      });

      if (!response.ok) throw new Error('AI request failed');
      const data = await response.json();
      
      if (data.result) {
        editor.chain().focus().insertContentAt({ from, to }, data.result).run();
        setMenuPos(null);
      }
    } catch (error) {
      console.error('Error calling AI:', error);
      alert('Failed to process text with AI.');
    } finally {
      setIsAiProcessing(false);
    }
  }, [editor, isAiProcessing]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor) {
      onEditorReady(editor);
    }
    return () => {
      onEditorReady(null);
    }
  }, [editor, onEditorReady]);

  return (
    <div className="max-w-none flex-grow overflow-y-auto p-4 relative min-h-[50px]">
      {/* Custom AI Bubble Menu */}
      {menuPos && editable && !isAiProcessing && (
        <div 
          className="fixed z-[9999] flex items-center gap-1 bg-white border border-gray-200 shadow-2xl rounded-lg p-1 animate-in fade-in zoom-in duration-200"
          style={{ 
            top: `${menuPos.top}px`, 
            left: `${menuPos.left}px`,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="flex items-center border-r border-gray-100 pr-1 mr-1">
             <button
              onClick={() => handleAiAction('improve')}
              className="flex items-center gap-1 px-2 py-1.5 hover:bg-purple-50 text-purple-700 rounded-md text-xs font-semibold transition-colors"
            >
              <Sparkles size={14} />
              AI Improve
            </button>
          </div>
          
          <button
            onClick={() => handleAiAction('fix_grammar')}
            className="p-1.5 hover:bg-gray-100 text-gray-700 rounded-md transition-colors"
            title="Fix Grammar"
          >
            <Type size={14} />
          </button>
          
          <button
            onClick={() => handleAiAction('shorten')}
            className="p-1.5 hover:bg-gray-100 text-gray-700 rounded-md transition-colors"
            title="Make Shorter"
          >
            <Scissors size={14} />
          </button>
          
          <button
            onClick={() => handleAiAction('tone_professional')}
            className="p-1.5 hover:bg-gray-100 text-gray-700 rounded-md transition-colors"
            title="Make Professional"
          >
            <AlignLeft size={14} />
          </button>

          <button
            onClick={() => handleAiAction('tone_casual')}
            className="p-1.5 hover:bg-gray-100 text-gray-700 rounded-md transition-colors"
            title="Make Casual"
          >
            <ArrowRightLeft size={14} />
          </button>
        </div>
      )}

      <EditorContent editor={editor} />
      
      {isAiProcessing && (
        <div className="fixed top-24 right-8 z-50 flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-2xl animate-bounce border-2 border-white">
          <Sparkles size={16} className="animate-spin" />
          AI is working...
        </div>
      )}
    </div>
  );
};

export default RichTextEditor;