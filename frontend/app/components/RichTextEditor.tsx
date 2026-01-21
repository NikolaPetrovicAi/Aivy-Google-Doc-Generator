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
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        history: {
          depth: 100,
        },
        // Enable trailing node to fix list editing UX
        trailingNode: true,
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

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false); // false prevents triggering an update loop
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
    <div className="max-w-none flex-grow overflow-y-auto p-4">
      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;