import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
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
  const [customInstruction, setCustomInstruction] = useState('');

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        trailingNode: {},
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph', 'tableCell', 'tableHeader'],
      }),
      TextStyle,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      Table.configure({
        resizable: true,
      }).extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            class: {
              default: 'border-none', // Force border-none by default
              parseHTML: element => element.getAttribute('class') || 'border-none',
              renderHTML: attributes => {
                return { class: attributes.class || 'border-none' };
              },
            },
            style: {
              default: null,
            },
          };
        },
      }),
      TableRow,
      TableHeader,
      TableCell.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            style: {
              default: null,
              parseHTML: element => element.getAttribute('style'),
              renderHTML: attributes => {
                if (!attributes.style) return {};
                return { style: attributes.style };
              },
            },
            class: {
              default: null,
              parseHTML: element => element.getAttribute('class'),
              renderHTML: attributes => {
                if (!attributes.class) return {};
                return { class: attributes.class };
              },
            },
          };
        },
      }),
    ],
    content: content,
    editable,
    onUpdate: ({ editor }) => {
      // Skip frequent parent updates during AI streaming to prevent performance bottlenecks
      if (!isAiProcessing) {
        onPageUpdate(index, editor.getHTML());
      }
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
      const top = start.top - 140; // Position above the text

      setMenuPos({ top, left });
    },
  });

  const handleAiAction = useCallback(async (command: string, instruction: string = '') => {
    if (!editor || isAiProcessing) return;

    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');

    if (!selectedText) return;

    setIsAiProcessing(true);
    setMenuPos(null); // Hide menu during processing
    
    // Determine the actual command to send to the backend
    const finalCommand = instruction || command;
    const fullContext = editor.getText();

    try {
      const response = await fetch('http://localhost:8080/api/ai/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: selectedText, 
          command: finalCommand,
          context: fullContext
        }),
        credentials: 'include',
      });

      if (!response.ok) throw new Error('AI request failed');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Response body is null');

      const decoder = new TextDecoder();
      let isFirstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        if (isFirstChunk) {
          editor.chain().focus().insertContentAt({ from, to }, chunk).run();
          isFirstChunk = false;
        } else {
          editor.commands.insertContent(chunk);
        }
      }

      // Flush any remaining characters from the decoder
      const finalChunk = decoder.decode();
      if (finalChunk) {
        if (isFirstChunk) {
           editor.chain().focus().insertContentAt({ from, to }, finalChunk).run();
        } else {
           editor.commands.insertContent(finalChunk);
        }
      }
      
      onPageUpdate(index, editor.getHTML());
      
    } catch (error) {
      console.error('Error calling AI:', error);
      alert('Failed to process text with AI.');
    } finally {
      setIsAiProcessing(false);
      setCustomInstruction(''); // Clear custom instruction after use
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
          className="fixed z-[9999] flex flex-col gap-2 bg-white border border-gray-200 shadow-2xl rounded-lg p-2 animate-in fade-in zoom-in duration-200"
          style={{ 
            top: `${menuPos.top}px`, 
            left: `${menuPos.left}px`,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="flex items-center gap-2 w-full">
            <textarea
              className="flex-grow p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Enter your custom AI instruction..."
              rows={2}
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAiAction('custom_instruction', customInstruction);
                }
              }}
            />
            <button
              onClick={() => handleAiAction('custom_instruction', customInstruction)}
              className="px-3 py-2 bg-purple-600 text-white rounded-md text-sm font-semibold hover:bg-purple-700 transition-colors h-full"
              disabled={!customInstruction.trim()}
            >
              Process
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1 w-full border-t border-gray-100 pt-2 -mb-1">
             <button
              onClick={() => handleAiAction('improve')}
              className="flex items-center gap-1 px-2 py-1.5 hover:bg-purple-50 text-purple-700 rounded-md text-xs font-semibold transition-colors"
            >
              <Sparkles size={14} />
              Improve
            </button>
            
            <button
              onClick={() => handleAiAction('shorten')}
              className="px-2 py-1.5 hover:bg-gray-100 text-gray-700 rounded-md text-xs transition-colors"
              title="Shorten"
            >
              Shorten
            </button>
            
            <button
              onClick={() => handleAiAction('extend')}
              className="px-2 py-1.5 hover:bg-gray-100 text-gray-700 rounded-md text-xs transition-colors"
              title="Extend"
            >
              Extend
            </button>

            <button
              onClick={() => handleAiAction('regenerate')}
              className="px-2 py-1.5 hover:bg-gray-100 text-gray-700 rounded-md text-xs transition-colors"
              title="Regenerate"
            >
              Regenerate
            </button>

            <button
              onClick={() => handleAiAction('fix_grammar')}
              className="px-2 py-1.5 hover:bg-gray-100 text-gray-700 rounded-md text-xs transition-colors"
              title="Fix Grammar"
            >
              Grammar
            </button>
            
            <button
              onClick={() => handleAiAction('tone_professional')}
              className="px-2 py-1.5 hover:bg-gray-100 text-gray-700 rounded-md text-xs transition-colors"
              title="Professional Tone"
            >
              Professional
            </button>

            <button
              onClick={() => handleAiAction('tone_casual')}
              className="px-2 py-1.5 hover:bg-gray-100 text-gray-700 rounded-md text-xs transition-colors"
              title="Casual Tone"
            >
              Casual
            </button>
          </div>
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