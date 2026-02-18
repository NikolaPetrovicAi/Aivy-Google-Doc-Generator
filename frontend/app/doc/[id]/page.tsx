'use client';

import { useParams } from 'next/navigation';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import RichTextEditor from '@/app/components/RichTextEditor';
import EditorToolbar from '@/app/components/EditorToolbar';
import PageSorter from '@/app/components/PageSorter';
import { Editor } from '@tiptap/react';
import { useAuthCheck } from '@/app/hooks/useAuthCheck';
import { arrayMove } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';

// Define A4 dimensions for visual pagination (in pixels, assuming 96 DPI)
const A4_HEIGHT_PX = 1123; // A4 height is 297mm, approx 11.7 inches * 96 dpi

interface EditablePage {
  id: string;
  content: string;
}

export default function DocEditorPage() {
  useAuthCheck();
  
  const params = useParams();
  const { id } = params;

  const [title, setTitle] = useState('Loading...');
  const [editablePages, setEditablePages] = useState<EditablePage[]>([]);
  const [pageHeights, setPageHeights] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // State to hold the currently focused editor instance
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const editorRefs = useRef<Record<string, Editor | null>>({});
  const pageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const initialFocusDone = useRef(false);
  const titleInputRef = useRef<HTMLInputElement>(null);


  // Function to dynamically measure content height and paginate
  const paginateContent = useCallback((htmlContent: string): EditablePage[] => {
    const pageBreakMarker = '<!-- PAGE_BREAK -->';
    let rawPages: string[] = [];
    if (htmlContent.includes(pageBreakMarker)) {
      rawPages = htmlContent
        .split(pageBreakMarker)
        .map(page => page.trim())
        .filter(page => page.length > 0);
    } else {
      rawPages = [htmlContent];
    }

    return rawPages.map(content => ({
        id: Math.random().toString(36).substring(2, 11),
        content
    }));
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
        
        const initialHeights: Record<string, number> = {};
        paginatedContent.forEach(p => initialHeights[p.id] = 0);
        setPageHeights(initialHeights);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocument();
  }, [id, paginateContent]);

  // Effect to focus the first editor when content is loaded
  useEffect(() => {
    if (!isLoading && editablePages.length > 0 && !initialFocusDone.current) {
      const firstPageId = editablePages[0].id;
      if (editorRefs.current[firstPageId]) {
        const timer = setTimeout(() => {
            editorRefs.current[firstPageId]?.commands.focus();
            initialFocusDone.current = true;
          }, 100);
          return () => clearTimeout(timer);
      }
    }
  }, [isLoading, editablePages]);
  
  // Effect to focus the title input when it appears
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleEditorReady = (pageId: string, editor: Editor | null) => {
    editorRefs.current[pageId] = editor;
  };

  const handleUpdatePageContent = useCallback((pageId: string, newHtml: string) => {
    setEditablePages(prevPages => {
      return prevPages.map(p => p.id === pageId ? { ...p, content: newHtml } : p);
    });
    setSaveMessage(null); // Clear save message on update
  }, []);

  const handleHeightChange = useCallback((pageId: string, height: number) => {
    setPageHeights(prev => ({
      ...prev,
      [pageId]: height
    }));
  }, []);

  const handleFocus = useCallback((editor: Editor) => {
    setActiveEditor(editor);
  }, []);

  const handleReorderPages = (oldIndex: number, newIndex: number) => {
    const movedPageId = editablePages[oldIndex].id;
    
    setEditablePages((prev) => arrayMove(prev, oldIndex, newIndex));
    setSaveMessage(null);

    // Smooth scroll to the moved page after a short delay to allow re-render
    setTimeout(() => {
      const movedPageElement = pageRefs.current[movedPageId];
      if (movedPageElement && scrollContainerRef.current) {
        // Calculate position to scroll to with a 100px offset from the top
        const containerTop = scrollContainerRef.current.getBoundingClientRect().top;
        const elementTop = movedPageElement.getBoundingClientRect().top;
        const currentScroll = scrollContainerRef.current.scrollTop;
        const targetScroll = currentScroll + elementTop - containerTop - 40; // 40px padding from top

        scrollContainerRef.current.scrollTo({
          top: targetScroll,
          behavior: 'smooth'
        });
        
        // Brief visual highlight of the moved page
        movedPageElement.classList.add('ring-4', 'ring-purple-400', 'ring-opacity-50');
        setTimeout(() => {
          movedPageElement.classList.remove('ring-4', 'ring-purple-400', 'ring-opacity-50');
        }, 1500);
      }
    }, 100);
  };

  const handleSaveDocument = useCallback(async () => {
    if (!id) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const fullHtmlToSave = editablePages.map(p => p.content).join('<!-- PAGE_BREAK -->');

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
    } catch (err: unknown) {
      console.error('Save failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setSaveMessage(`Error: ${errorMessage}`);
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
    <div className="flex flex-col w-full h-screen bg-gray-100 overflow-hidden">
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
      <div className="flex-shrink-0 sticky top-0 z-10 w-full bg-white shadow-md">
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
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Page Sorter */}
        {!isLoading && !error && (
            <PageSorter 
                pages={editablePages} 
                onReorder={handleReorderPages} 
            />
        )}

        <div 
          ref={scrollContainerRef}
          className="flex-1 flex flex-col items-center w-full p-4 sm:p-8 overflow-y-auto scroll-smooth"
        >
            {isLoading && <p className="p-4 text-gray-500">Loading document...</p>}
            {error && <p className="p-4 text-red-500">Error: {error}</p>}

            {!isLoading && !error && (
            <div className="flex-grow w-full max-w-[210mm] pb-20">
                <AnimatePresence mode="popLayout">
                {editablePages.map((page, index) => {
                const contentHeight = pageHeights[page.id] || 0;
                const paddingY = 192; // 2.54cm top + 2.54cm bottom approx 192px
                const totalHeight = contentHeight + paddingY;
                const isApproachingLimit = totalHeight > A4_HEIGHT_PX * 0.9;
                const isOverLimit = totalHeight > A4_HEIGHT_PX;

                return (
                    <motion.div
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 300, 
                      damping: 30,
                      layout: { duration: 0.4 }
                    }}
                    key={page.id}
                    ref={(el) => { pageRefs.current[page.id] = el; }}
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
                        content={page.content}
                        index={index}
                        onPageUpdate={(idx, html) => handleUpdatePageContent(page.id, html)}
                        onHeightChange={(idx, height) => handleHeightChange(page.id, height)}
                        onFocus={handleFocus}
                        onEditorReady={(editor) => handleEditorReady(page.id, editor)}
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
                    </motion.div>
                );
                })}
                </AnimatePresence>

                {/* Add Page Button */}
                <div className="flex justify-center mt-8">
                <button 
                    onClick={() => {
                      const newPageId = Math.random().toString(36).substring(2, 11);
                      setEditablePages(prev => [...prev, { id: newPageId, content: '<p>&nbsp;</p>' }]);
                      setPageHeights(prev => ({ ...prev, [newPageId]: 0 }));
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
    </div>
  );
}