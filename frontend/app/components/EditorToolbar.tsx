import { Editor } from '@tiptap/react';
import React, { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '../hooks/useDebounce';

interface EditorToolbarProps {
  editor: Editor | null;
  onSave: () => void;
  isSaving: boolean;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor, onSave, isSaving }) => {
  const [textColor, setTextColor] = useState('#000000');
  const [highlightColor, setHighlightColor] = useState('#ffffff');

  const debouncedTextColor = useDebounce(textColor, 500);
  const debouncedHighlightColor = useDebounce(highlightColor, 500);

  // Function to convert rgb/rgba to hex. Handles passthrough of hex colors.
  const toHex = (colorStr: string): string => {
    if (colorStr.startsWith('#')) {
      return colorStr;
    }
    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) {
      return '#000000'; // Default to black on parse error
    }
    const [, r, g, b] = match.map(Number);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toLowerCase();
  };


  // Function to update color swatches based on editor state
  const updateColorSwatches = useCallback(() => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;

    let textColor: string | undefined = undefined;
    let highlightColor: string | undefined = undefined;

    if (empty) { // It's a cursor
      const marks = editor.getAttributes('textStyle');
      textColor = marks.color;
      highlightColor = marks.backgroundColor;
    } else { // It's a selection
      const textColors = new Set<string>();
      const highlightColors = new Set<string>();

      editor.state.doc.nodesBetween(from, to, (node) => {
        if (node.isText) {
          node.marks.forEach((mark) => {
            if (mark.type.name === 'textStyle') {
              if (mark.attrs.color) {
                textColors.add(mark.attrs.color);
              }
              if (mark.attrs.backgroundColor) {
                highlightColors.add(mark.attrs.backgroundColor);
              }
            }
          });
        }
      });

      if (textColors.size === 1) {
        textColor = textColors.values().next().value;
      }
      if (highlightColors.size === 1) {
        highlightColor = highlightColors.values().next().value;
      }
    }
    
    // Convert to hex before setting state for the color input
    const finalTextColor = textColor ? toHex(textColor) : '#000000';
    const finalHighlightColor = highlightColor ? toHex(highlightColor) : '#ffffff';

    setTextColor(finalTextColor);
    // For highlight, if the color is white, we might want to show white, but if it's undefined, also white.
    // The input doesn't support transparency, so we just use white.
    setHighlightColor(finalHighlightColor === '#ffffff' ? '#ffffff' : finalHighlightColor);

  }, [editor]);

  // Effect to apply text color once debounced
  useEffect(() => {
    if (editor && debouncedTextColor) {
      editor.chain().focus().setColor(debouncedTextColor).run();
    }
  }, [debouncedTextColor, editor]);

  // Effect to apply highlight color once debounced
  useEffect(() => {
    if (editor && debouncedHighlightColor) {
      // Set the background color using the 'textStyle' mark
      editor.chain().focus().setMark('textStyle', { backgroundColor: debouncedHighlightColor }).run();
    }
  }, [debouncedHighlightColor, editor]);

  // Update swatches on selection or content change
  useEffect(() => {
    if (editor) {
      const handleInitialUpdate = () => {
        updateColorSwatches();
        // Remove this listener so it only runs once after the first content update
        editor.off('update', handleInitialUpdate);
      };

      // Listen for the first update, which happens after initial content is set
      editor.on('update', handleInitialUpdate);
      // Still listen for selection changes for subsequent user actions
      editor.on('selectionUpdate', updateColorSwatches);
      
      return () => {
        editor.off('update', handleInitialUpdate);
        editor.off('selectionUpdate', updateColorSwatches);
      };
    }
  }, [editor, updateColorSwatches]);


  const getButtonClass = useCallback((isActive: boolean) => {
    return `px-3 py-1 rounded-md text-sm font-medium ${
      isActive ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed'
    }`;
  }, []);

  if (!editor) {
    // Render a disabled-like state or nothing if the editor is not available
    return (
      <div className="flex flex-wrap items-center justify-center gap-2 p-2 rounded-lg border border-gray-200 bg-white shadow-sm opacity-50">
        {/* Simplified disabled view */}
        <span className="text-sm text-gray-400">Editor loading...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 p-2 rounded-lg border border-gray-200 bg-white shadow-sm">
      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className={getButtonClass(false)}
      >
        Undo
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className={getButtonClass(false)}
      >
        Redo
      </button>

      <div className="h-5 w-px bg-gray-300 mx-2"></div>

      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={getButtonClass(editor.isActive('bold'))}
      >
        Bold
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={getButtonClass(editor.isActive('italic'))}
      >
        Italic
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        className={getButtonClass(editor.isActive('strike'))}
      >
        Strike
      </button>

      <div className="h-5 w-px bg-gray-300 mx-2"></div>
      
      <div className="flex items-center gap-2">
        <label htmlFor="text-color" className="text-sm font-medium text-gray-700">Text</label>
        <input
          id="text-color"
          type="color"
          onInput={(e) => setTextColor((e.target as HTMLInputElement).value)}
          value={textColor}
          className="w-8 h-8 p-0 border-none rounded-md cursor-pointer"
          title="Set text color"
        />
         <button onClick={() => editor.chain().focus().unsetColor().run()} className={getButtonClass(false)}>
          x
        </button>
      </div>

       <div className="flex items-center gap-2">
        <label htmlFor="highlight-color" className="text-sm font-medium text-gray-700">Highlight</label>
        <input
          id="highlight-color"
          type="color"
          onInput={(e) => setHighlightColor((e.target as HTMLInputElement).value)}
          value={highlightColor}
          className="w-8 h-8 p-0 border-none rounded-md cursor-pointer"
          title="Set highlight color"
        />
        <button onClick={() => editor.chain().focus().setMark('textStyle', { backgroundColor: null }).run()} className={getButtonClass(false)}>
          x
        </button>
      </div>

      <div className="h-5 w-px bg-gray-300 mx-2"></div>

      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        disabled={!editor.can().chain().focus().toggleHeading({ level: 1 }).run()}
        className={getButtonClass(editor.isActive('heading', { level: 1 }))}
      >
        H1
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        disabled={!editor.can().chain().focus().toggleHeading({ level: 2 }).run()}
        className={getButtonClass(editor.isActive('heading', { level: 2 }))}
      >
        H2
      </button>
       <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        disabled={!editor.can().chain().focus().toggleHeading({ level: 3 }).run()}
        className={getButtonClass(editor.isActive('heading', { level: 3 }))}
      >
        H3
      </button>

      <div className="h-5 w-px bg-gray-300 mx-2"></div>

      <button
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        disabled={!editor.can().chain().setTextAlign('left').run()}
        className={getButtonClass(editor.isActive({ textAlign: 'left' }))}
      >
        Left
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        disabled={!editor.can().chain().setTextAlign('center').run()}
        className={getButtonClass(editor.isActive({ textAlign: 'center' }))}
      >
        Center
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        disabled={!editor.can().chain().setTextAlign('right').run()}
        className={getButtonClass(editor.isActive({ textAlign: 'right' }))}
      >
        Right
      </button>

      <div className="h-5 w-px bg-gray-300 mx-2"></div>

      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        disabled={!editor.can().chain().focus().toggleBulletList().run()}
        className={getButtonClass(editor.isActive('bulletList'))}
      >
        Bullet List
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        disabled={!editor.can().chain().focus().toggleOrderedList().run()}
        className={getButtonClass(editor.isActive('orderedList'))}
      >
        Ordered List
      </button>
      
      <div className="flex-grow"></div>

      {/* Save Button */}
      <button
        onClick={onSave}
        disabled={isSaving}
        className={`px-3 py-1 rounded-md text-sm font-medium ${
          isSaving ? 'bg-gray-400 text-gray-700' : 'bg-green-500 text-white hover:bg-green-600'
        }`}
      >
        {isSaving ? 'Saving...' : 'Save Document'}
      </button>
    </div>
  );
};

export default EditorToolbar;
