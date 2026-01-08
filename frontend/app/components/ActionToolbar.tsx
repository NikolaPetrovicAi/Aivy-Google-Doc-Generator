'use client';
import { Plus, FilePlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ActionToolbar() {
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

  return (
    <div className="flex items-center justify-center p-4 bg-white border-b border-gray-200">
      <h1 className="text-xl font-semibold text-gray-800">Aivy Workspace</h1>
    </div>
  );
}
