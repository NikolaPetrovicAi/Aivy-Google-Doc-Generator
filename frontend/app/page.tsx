"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import ActionToolbar from "./components/ActionToolbar";
import DocumentGrid from "./components/DocumentGrid";

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
      <div className="flex-1 p-4 overflow-y-auto">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Docs</h2>
        <DocumentGrid documents={documents} lastDocumentElementRef={lastDocumentElementRef} />
        {loading && <p>Loading...</p>}
      </div>
    </div>
  );
}
