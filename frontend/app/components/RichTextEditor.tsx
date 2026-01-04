import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Extension } from '@tiptap/core';
import React, { useEffect } from 'react';

// Custom extension to add background-color support to TextStyle
const BackgroundColorExtension = Extension.create({
  name: 'backgroundColor',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          backgroundColor: {
            default: null,
            parseHTML: element => element.style.backgroundColor,
            renderHTML: attributes => {
              if (!attributes.backgroundColor) {
                return {};
              }
              return {
                style: `background-color: ${attributes.backgroundColor}`,
              };
            },
          },
        },
      },
    ];
  },
});

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
      BackgroundColorExtension, // Add our custom extension
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
    if (editor) {
      onEditorReady(editor);
    }
    return () => {
      onEditorReady(null);
    }
  }, [editor, onEditorReady]);

  return (
    <div className="prose dark:prose-invert max-w-none flex-grow overflow-y-auto p-4">
      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;

