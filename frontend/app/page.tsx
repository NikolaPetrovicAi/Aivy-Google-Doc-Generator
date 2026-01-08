"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import ActionToolbar from "./components/ActionToolbar";
import DocumentGrid from "./components/DocumentGrid";
import { useRouter } from "next/navigation";
import { Plus, FilePlus } from "lucide-react";


interface Document {
  id: string;
  name: string;
  modifiedTime: string;
  mimeType: string;
  preview: string;
}

export default function Home() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const observer = useRef<IntersectionObserver>();
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const handleNewBlank = async () => {
    setIsCreating(true);
    try {
      const response = await fetch('http://localhost:8080/api/create-blank-doc', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to create new document');
      }
      const { documentId } = await response.json();
      router.push(`/doc/${documentId}`);
    } catch (error) {
      console.error(error);
      // Handle error user feedback
    } finally {
      setIsCreating(false);
    }
  };

  const fetchDocuments = useCallback(async (token?: string) => {
    setLoading(true);
    try {
      const url = `http://localhost:8080/api/google-docs?${token ? `nextPageToken=${token}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setDocuments(prevDocs => {
        const fetchedDocs = Array.isArray(data.documents) ? data.documents : [];
        const allDocs = token ? [...prevDocs, ...fetchedDocs] : fetchedDocs;
        const uniqueDocs = Array.from(new Map(allDocs.map(doc => [doc.id, doc])).values());
        return uniqueDocs;
      });
      setNextPageToken(data.nextPageToken);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments(null);
  }, [fetchDocuments]);

  const lastDocumentElementRef = useCallback(
    (node: HTMLDivElement) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && nextPageToken) {
          fetchDocuments(nextPageToken);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, nextPageToken, fetchDocuments]
  );

  return (
    <div className="flex flex-col flex-grow">
      <ActionToolbar />
      <div className="flex-1 py-4 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">My Documents</h2>
            <div className="flex items-center space-x-3 ml-4">
              {/* Generate new Doc Button */}
              <button
                onClick={() => router.push('/generate')}
                className="flex items-center px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
              >
                <Plus className="mr-2 h-4 w-4" />
                Generate new Doc
              </button>

              {/* New blank Button */}
              <button
                onClick={handleNewBlank}
                disabled={isCreating}
                className="flex items-center px-4 py-2 rounded-md bg-white text-gray-700 border border-blue-600 hover:bg-gray-100 text-sm font-medium disabled:opacity-50"
              >
                <FilePlus className="mr-2 h-4 w-4" />
                {isCreating ? 'Creating...' : 'New Document'}
              </button>
            </div>
          </div>
          <DocumentGrid documents={documents} lastDocumentElementRef={lastDocumentElementRef} />
          {loading && <p>Loading...</p>}
        </div>
      </div>
    </div>
  );
}
