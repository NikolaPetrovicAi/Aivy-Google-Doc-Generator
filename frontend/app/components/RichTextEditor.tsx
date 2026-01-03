import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import React, { useEffect } from 'react';

interface RichTextEditorProps {
  content: string;
  onUpdate: (html: string) => void;
  onFocus: (editor: Editor) => void; // Prop to notify parent with editor instance
  editable?: boolean;
}

const RichTextEditor = ({
  content,
  onUpdate,
  onFocus,
  editable = true,
}: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content,
    editable,
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML());
    },
    onFocus: ({ editor }) => {
      onFocus(editor); // Pass the editor instance up on focus
    },
  });

  // Effect to update editor content when the `content` prop changes,
  // but only if the editor is not focused, to avoid disrupting user input.
  useEffect(() => {
    if (editor && !editor.isFocused && content !== editor.getHTML()) {
      editor.commands.setContent(content, false, { preserveCursor: true });
    }
  }, [content, editor]);

  return (
    <div className="prose dark:prose-invert max-w-none flex-grow overflow-y-auto p-4">
      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
