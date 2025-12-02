// aivy-web/app/components/RichTextEditor.tsx
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import React from 'react';
import EditorToolbar from './EditorToolbar';

// Define a simple component for the TipTap editor
const RichTextEditor = ({ content }: { content: string }) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content,
    editable: true, // We'll make it editable for now
  });

  return (
    <div>
      <EditorToolbar editor={editor} />
      <div className="prose dark:prose-invert max-w-none prose-sm sm:prose-base lg:prose-lg xl:prose-2xl m-5 focus:outline-none">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default RichTextEditor;
