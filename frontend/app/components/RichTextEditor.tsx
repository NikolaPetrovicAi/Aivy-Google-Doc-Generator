import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import React, { useEffect } from 'react';

interface RichTextEditorProps {
  content: string;
  index: number;
  onPageUpdate: (index: number, html: string) => void;
  onFocus: (editor: Editor) => void; // Prop to notify parent with editor instance
  editable?: boolean;
}

const RichTextEditor = ({
  content,
  index,
  onPageUpdate,
  onFocus,
  editable = true,
}: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: {
          depth: 100,
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: content,
    editable,
    onUpdate: ({ editor }) => {
      onPageUpdate(index, editor.getHTML());
    },
    onFocus: ({ editor }) => {
      onFocus(editor); // Pass the editor instance up on focus
    },
  });

  return (
    <div className="prose dark:prose-invert max-w-none flex-grow overflow-y-auto p-4">
      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
