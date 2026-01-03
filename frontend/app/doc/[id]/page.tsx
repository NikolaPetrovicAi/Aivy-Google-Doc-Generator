'use client';

import { useParams } from 'next/navigation';
import React, { useEffect, useState, useCallback } from 'react';
import RichTextEditor from '@/app/components/RichTextEditor';
import EditorToolbar from '@/app/components/EditorToolbar';
import { Editor } from '@tiptap/react';

// Define A4 dimensions for visual pagination (in pixels, assuming 96 DPI)
const A4_HEIGHT_PX = 1123; // A4 height is 297mm, approx 11.7 inches * 96 dpi

export default function DocEditorPage() {
  const params = useParams();
  const { id } = params;

  const [title, setTitle] = useState('Loading...');
  const [editablePages, setEditablePages] = useState<string[]>(['']);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // State to hold the currently focused editor instance
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);

  // Function to dynamically measure content height and paginate
  const paginateContent = useCallback((htmlContent: string): string[] => {
    const pageBreakMarker = '<!-- PAGE_BREAK -->';
    if (htmlContent.includes(pageBreakMarker)) {
      return htmlContent.split(pageBreakMarker).map(page => page.trim());
    }
    return [htmlContent];
  }, []);

  useEffect(() => {
    if (!id) return;

    const fetchDocument = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`http://localhost:8080/docs/doc/${id}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch document. Status: ${response.status}`);
        }
        const data = await response.json();
        setTitle(data.title || 'Untitled Document');
        const paginatedContent = paginateContent(data.htmlContent || '');
        setEditablePages(paginatedContent);
      } catch (err: any) {
        setError(err.message || 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocument();
  }, [id, paginateContent]);

  const handleUpdatePageContent = useCallback((index: number, newHtml: string) => {
    setEditablePages(prevPages => {
      const newPages = [...prevPages];
      newPages[index] = newHtml;
      return newPages;
    });
    setSaveMessage(null); // Clear save message on update
  }, []);

  const handleFocus = useCallback((editor: Editor) => {
    setActiveEditor(editor);
  }, []);

  const handleSaveDocument = useCallback(async () => {
    if (!id) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const fullHtmlToSave = editablePages.join('<!-- PAGE_BREAK -->');

      const response = await fetch(`http://localhost:8080/docs/save-document/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ htmlContent: fullHtmlToSave, title }),
      });

      if (!response.ok) {
        // Get the raw response text to see the actual server error (e.g., HTML stack trace)
        const errorText = await response.text();
        throw new Error(errorText || `Failed to save document. Status: ${response.status}`);
      }

      setSaveMessage('Document saved successfully!');
    } catch (err: any) {
      console.error('Save failed:', err);
      setSaveMessage(`Error: ${err.message || 'An unknown error occurred'}`);
    } finally {
      setIsSaving(false);
    }
  }, [id, editablePages, title]);

  return (
    <div className="flex flex-col items-center w-full p-4 sm:p-8 bg-gray-50 dark:bg-gray-900">
      {/* Header section for Toolbar and Title */}
      <div className="w-full max-w-4xl mb-4">
        <div className="flex flex-col items-center gap-4">
          {/* Centralized toolbar is always visible, centered */}
          <EditorToolbar editor={activeEditor} onSave={handleSaveDocument} isSaving={isSaving} />
          
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent text-center text-3xl md:text-4xl font-bold focus:outline-none p-2 dark:text-white"
            placeholder="Document Title"
          />

          {saveMessage && (
            <div
              className={`w-full text-center p-2 rounded-md text-sm ${
                saveMessage.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
              }`}
              role="alert"
            >
              {saveMessage}
            </div>
          )}
        </div>
      </div>


      {isLoading && <p className="p-4 text-gray-500">Loading document...</p>}
      {error && <p className="p-4 text-red-500">Error: {error}</p>}

      {!isLoading && !error && (
        <div className="flex-grow overflow-y-auto w-full">
          {editablePages.map((pageContent, index) => (
            <div
              key={index}
              className="paginated-editor bg-white shadow-md mx-auto mb-6 p-8 relative dark:bg-gray-800 border dark:border-gray-700"
              style={{ minHeight: `${A4_HEIGHT_PX}px`, width: '210mm' }} // A4 width
            >
              <RichTextEditor
                content={pageContent}
                index={index}
                onPageUpdate={handleUpdatePageContent}
                onFocus={handleFocus} // Set the active editor on focus
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}