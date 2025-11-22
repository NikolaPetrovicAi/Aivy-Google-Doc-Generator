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

  const fetchDocuments = useCallback(async (token: string | null) => {
    setLoading(true);
    try {
      const url = token
        ? `http://localhost:8080/drive/list?pageToken=${token}`
        : "http://localhost:8080/drive/list";
      const res = await fetch(url);
      const data = await res.json();
      if (data.files) {
        const formattedDocuments = data.files.map((file: any) => ({
          id: file.id,
          name: file.name,
          modifiedTime: file.modifiedTime,
          mimeType: file.mimeType,
          preview: file.preview,
        }));
        setDocuments((prev) => [...prev, ...formattedDocuments]);
        setNextPageToken(data.nextPageToken);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
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
