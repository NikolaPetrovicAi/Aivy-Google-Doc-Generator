import { Editor } from '@tiptap/react';
import React from 'react';

interface EditorToolbarProps {
  editor: Editor | null;
  onSave: () => void; // Added onSave prop
  isSaving: boolean; // To disable button during saving
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor, onSave, isSaving }) => {

  // A helper function to generate class names for buttons
  const getButtonClass = (isActive: boolean) => {
    return `px-3 py-1 rounded-md text-sm font-medium ${
      isActive ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed'
    }`;
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 p-2 rounded-lg border border-gray-200 bg-white shadow-sm">
      <button
        onClick={() => editor?.chain().focus().toggleBold().run()}
        disabled={!editor || !editor.can().chain().focus().toggleBold().run()}
        className={getButtonClass(!!editor?.isActive('bold'))}
      >
        Bold
      </button>
      <button
        onClick={() => editor?.chain().focus().toggleItalic().run()}
        disabled={!editor || !editor.can().chain().focus().toggleItalic().run()}
        className={getButtonClass(!!editor?.isActive('italic'))}
      >
        Italic
      </button>
      <button
        onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        disabled={!editor || !editor.can().chain().focus().toggleHeading({ level: 1 }).run()}
        className={getButtonClass(!!editor?.isActive('heading', { level: 1 }))}
      >
        H1
      </button>
      <button
        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        disabled={!editor || !editor.can().chain().focus().toggleHeading({ level: 2 }).run()}
        className={getButtonClass(!!editor?.isActive('heading', { level: 2 }))}
      >
        H2
      </button>
      <button
        onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        disabled={!editor || !editor.can().chain().focus().toggleHeading({ level: 3 }).run()}
        className={getButtonClass(!!editor?.isActive('heading', { level: 3 }))}
      >
        H3
      </button>
      <button
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
        disabled={!editor || !editor.can().chain().focus().toggleBulletList().run()}
        className={getButtonClass(!!editor?.isActive('bulletList'))}
      >
        Bullet List
      </button>
      <button
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        disabled={!editor || !editor.can().chain().focus().toggleOrderedList().run()}
        className={getButtonClass(!!editor?.isActive('orderedList'))}
      >
        Ordered List
      </button>
      {/* Save Button */}
      <button
        onClick={onSave}
        disabled={isSaving}
        className={`px-3 py-1 rounded-md text-sm font-medium ml-4 ${
          isSaving ? 'bg-gray-400 text-gray-700' : 'bg-green-500 text-white hover:bg-green-600'
        }`}
      >
        {isSaving ? 'Saving...' : 'Save Document'}
      </button>
    </div>
  );
};

export default EditorToolbar;
