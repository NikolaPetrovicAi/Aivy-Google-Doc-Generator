// aivy-web/app/doc/[id]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import RichTextEditor from '@/app/components/RichTextEditor';

export default function DocEditorPage() {
  const params = useParams();
  const { id } = params;

  const [title, setTitle] = useState('Loading...');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setContent(data.htmlContent || '');
      } catch (err: any) {
        setError(err.message || 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocument();
  }, [id]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">{title}</h1>
      <div className="border rounded-lg bg-white min-h-[500px]">
        {isLoading && <p className="p-4 text-gray-500">Loading document...</p>}
        {error && <p className="p-4 text-red-500">Error: {error}</p>}
        {!isLoading && !error && <RichTextEditor content={content} />}
      </div>
    </div>
  );
}
