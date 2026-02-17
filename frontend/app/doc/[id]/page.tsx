'use client';

import { useParams } from 'next/navigation';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import RichTextEditor from '@/app/components/RichTextEditor';
import EditorToolbar from '@/app/components/EditorToolbar';
import { Editor } from '@tiptap/react';
import { useAuthCheck } from '@/app/hooks/useAuthCheck';

// Define A4 dimensions for visual pagination (in pixels, assuming 96 DPI)
const A4_HEIGHT_PX = 1123; // A4 height is 297mm, approx 11.7 inches * 96 dpi

export default function DocEditorPage() {
  useAuthCheck();
  
  const params = useParams();
  const { id } = params;

  const [title, setTitle] = useState('Loading...');
  const [editablePages, setEditablePages] = useState<string[]>([]);
  const [pageHeights, setPageHeights] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // State to hold the currently focused editor instance
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const editorRefs = useRef<(Editor | null)[]>([]);
  const initialFocusDone = useRef(false);
  const titleInputRef = useRef<HTMLInputElement>(null);


  // Function to dynamically measure content height and paginate
  const paginateContent = useCallback((htmlContent: string): string[] => {
    const pageBreakMarker = '<!-- PAGE_BREAK -->';
    if (htmlContent.includes(pageBreakMarker)) {
      return htmlContent
        .split(pageBreakMarker)
        .map(page => page.trim())
        .filter(page => page.length > 0); // Filter out empty pages
    }
    return [htmlContent];
  }, []);

  useEffect(() => {
    if (!id) return;

    const fetchDocument = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`http://localhost:8080/docs/doc/${id}`, { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`Failed to fetch document. Status: ${response.status}`);
        }
        const data = await response.json();
        setTitle(data.title || 'Untitled Document');
        const paginatedContent = paginateContent(data.htmlContent || '');
        setEditablePages(paginatedContent);
        setPageHeights(new Array(paginatedContent.length).fill(0));
      } catch (err: any) {
        setError(err.message || 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocument();
  }, [id, paginateContent]);

  // Effect to focus the first editor when content is loaded
  useEffect(() => {
    if (!isLoading && editablePages.length > 0 && editorRefs.current[0] && !initialFocusDone.current) {
      const timer = setTimeout(() => {
        editorRefs.current[0]?.commands.focus();
        initialFocusDone.current = true; // Ensure this only runs once
      }, 100); // A small delay to ensure the editor is fully rendered

      return () => clearTimeout(timer);
    }
  }, [isLoading, editablePages]);
  
  // Effect to focus the title input when it appears
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleEditorReady = (index: number, editor: Editor | null) => {
    editorRefs.current[index] = editor;
  };

  const handleUpdatePageContent = useCallback((index: number, newHtml: string) => {
    setEditablePages(prevPages => {
      const newPages = [...prevPages];
      newPages[index] = newHtml;
      return newPages;
    });
    setSaveMessage(null); // Clear save message on update
  }, []);

  const handleHeightChange = useCallback((index: number, height: number) => {
    setPageHeights(prev => {
      const next = [...prev];
      next[index] = height;
      return next;
    });
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
        credentials: 'include',
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

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setIsEditingTitle(false);
    }
  };

  return (
    <div className="flex flex-col w-full h-screen bg-gray-100">
      <header className="flex-shrink-0 bg-white shadow-sm border-b border-gray-200">
        <div className="flex items-center p-2 sm:p-3">
          <Link href="/" className="p-2 rounded-md hover:bg-gray-100 transition-colors flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="ml-2 min-w-0 flex-grow">
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => setIsEditingTitle(false)}
                  onKeyDown={handleTitleKeyDown}
                  className="text-lg font-semibold text-gray-800 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-md px-2"
                />
              ) : (
                <span
                  onClick={() => setIsEditingTitle(true)}
                  className="text-lg font-semibold text-gray-800 truncate cursor-pointer rounded-md px-2 py-1"
                >
                  {title}
                </span>
              )}
            </div>
        </div>
      </header>
      {/* Sticky Toolbar */}
      <div className="sticky top-0 z-10 w-full bg-white shadow-md">
        <div className="flex flex-col items-center gap-2 p-2">
          <EditorToolbar editor={activeEditor} onSave={handleSaveDocument} isSaving={isSaving} />
          {saveMessage && (
            <div
              className={`w-full max-w-4xl text-center p-2 rounded-md text-sm ${
                saveMessage.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
              }`}
              role="alert"
            >
              {saveMessage}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center w-full p-4 sm:p-8 overflow-y-auto">
        {isLoading && <p className="p-4 text-gray-500">Loading document...</p>}
        {error && <p className="p-4 text-red-500">Error: {error}</p>}

        {!isLoading && !error && (
          <div className="flex-grow w-full max-w-[210mm] pb-20">
            {editablePages.map((pageContent, index) => {
              const contentHeight = pageHeights[index] || 0;
              const paddingY = 192; // 2.54cm top + 2.54cm bottom approx 192px
              const totalHeight = contentHeight + paddingY;
              const isApproachingLimit = totalHeight > A4_HEIGHT_PX * 0.9;
              const isOverLimit = totalHeight > A4_HEIGHT_PX;

              return (
                <div
                  key={index}
                  className="relative bg-white shadow-2xl mx-auto mb-16 border border-gray-200 group transition-all duration-300"
                  style={{ minHeight: `${A4_HEIGHT_PX}px`, width: '210mm' }}
                >
                  {/* Page Number Indicator */}
                  <div className="absolute -left-16 top-0 h-full flex flex-col items-center pt-8 select-none">
                    <span className="text-gray-400 font-mono text-xs rotate-180 [writing-mode:vertical-lr]">
                      PAGE {index + 1}
                    </span>
                    <div className="w-px flex-grow bg-gray-200 my-4"></div>
                  </div>

                  <div className="h-full overflow-visible p-[2.54cm]"> {/* Standard 1 inch margin */}
                    <RichTextEditor
                      content={pageContent}
                      index={index}
                      onPageUpdate={handleUpdatePageContent}
                      onHeightChange={handleHeightChange}
                      onFocus={handleFocus}
                      onEditorReady={(editor) => handleEditorReady(index, editor)}
                    />
                  </div>

                  {/* Overflow Warning Line (Smart Visibility) */}
                  <div 
                    className={`absolute left-0 w-full h-px border-b-2 border-dashed pointer-events-none transition-all duration-500 ${
                      isOverLimit ? 'border-red-500 opacity-100' : 
                      isApproachingLimit ? 'border-red-300 opacity-60' : 
                      'border-gray-200 opacity-0 group-hover:opacity-20'
                    }`}
                    style={{ top: `${A4_HEIGHT_PX}px` }}
                  >
                    {(isApproachingLimit || isOverLimit) && (
                      <div className={`absolute right-4 -top-6 text-white text-[10px] px-2 py-0.5 rounded-t-md font-bold uppercase tracking-wider shadow-sm transition-colors duration-300 ${
                        isOverLimit ? 'bg-red-500' : 'bg-red-400'
                      }`}>
                        {isOverLimit ? 'Content Overflow' : 'Near Page Limit'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add Page Button */}
            <div className="flex justify-center mt-8">
              <button 
                onClick={() => {
                  setEditablePages(prev => [...prev, '<p>&nbsp;</p>']);
                  setPageHeights(prev => [...prev, 0]);
                }}
                className="group flex items-center gap-3 px-6 py-3 bg-white border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-all shadow-sm"
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 group-hover:bg-purple-100 flex items-center justify-center transition-colors">
                  <span className="text-xl font-bold">+</span>
                </div>
                <span className="font-semibold text-sm tracking-wide">Add New Page</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}