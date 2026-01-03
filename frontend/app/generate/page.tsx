"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation'; // Import the router
import { useDebounce } from '../hooks/useDebounce';
import PlanPreview from '../components/PlanPreview';
import { fonts } from '../lib/fonts';

// Define the types for the form state and the plan
interface FormState {
  docType: 'doc' | 'presentation' | 'sheet' | '';
  topic: string;
  pages: string; // Use string for select value
  language: string;
  detailLevel: 'Minimal' | 'Concise' | 'Detailed' | 'Extensive' | '';
  font: string;
}

interface Plan {
  pages: Array<{
    page: number;
    title: string;
    summary: string;
  }>;
}

export default function GenerateDocumentPage() {
  const router = useRouter(); // Instantiate the router
  const [formState, setFormState] = useState<FormState>({
    docType: '',
    topic: '',
    pages: '1',
    language: 'English',
    detailLevel: 'Detailed',
    font: 'Lato',
  });
  const [plan, setPlan] = useState<Plan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false); // New state for doc generation

  const debouncedTopic = useDebounce(formState.topic, 750);

  const isSectionOneComplete = useMemo(() => {
    return formState.docType !== '' && formState.topic.trim() !== '' && formState.pages !== '' && formState.language !== '';
  }, [formState.docType, formState.topic, formState.pages, formState.language]);

  useEffect(() => {
    if (!isSectionOneComplete || !debouncedTopic) {
      setPlan(null);
      return;
    }

    const generatePlan = async () => {
      setIsLoading(true);
      console.log("Generating plan for:", formState);
      
      try {
        const response = await fetch('http://localhost:8080/api/generate-plan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formState),
        });

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const data = await response.json();
        setPlan(data.plan ? { pages: data.plan } : data);
      } catch (error) {
        console.error("Failed to generate plan:", error);
        setPlan(null); // Clear plan on error
      } finally {
        setIsLoading(false);
      }
    };

    generatePlan();
  }, [isSectionOneComplete, debouncedTopic, formState.pages, formState.language, formState.detailLevel, formState.docType, formState.font]);

  // Function to handle the final document generation
  const handleGenerateDocument = async () => {
    if (!plan) return;

    setIsGeneratingDoc(true);
    try {
      const response = await fetch('http://localhost:8080/api/create-google-doc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan: plan.pages, formData: formState }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create Google Doc');
      }

      const { documentId } = await response.json();
      if (documentId) {
        router.push(`/doc/${documentId}`); // Navigate to the internal editor
      }
    } catch (error) {
      console.error("Error creating document:", error);
      // You might want to show an error message to the user here
      alert(`Error: ${error instanceof Error ? error.message : "An unknown error occurred."}`);
    } finally {
      setIsGeneratingDoc(false);
    }
  };

  return (
    <div className="flex flex-grow bg-gray-50">
      {/* Left Column: Form */}
      <div className="w-1/2 p-6 flex justify-center items-start overflow-y-auto">
        <div className="w-full max-w-md space-y-8">
          {/* Section 1 */}
          <div className="space-y-6">
            <div className="flex justify-center space-x-2">
              {(['doc', 'presentation', 'sheet'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFormState(s => ({ ...s, docType: type }))}
                  className={`px-6 py-2 rounded-md text-sm font-semibold capitalize transition-colors ${
                    formState.docType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border'
                  }`}>
                  {type}
                </button>
              ))}
            </div>
            <textarea
              value={formState.topic}
              onChange={(e) => setFormState(s => ({ ...s, topic: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="What is the document about?"
              rows={3}
            />
            <div className="flex space-x-4">
              <select
                value={formState.pages}
                onChange={(e) => setFormState(s => ({ ...s, pages: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1} Page(s)</option>
                ))}
              </select>
              <select
                value={formState.language}
                onChange={(e) => setFormState(s => ({ ...s, language: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                <option value="English">English</option>
                <option value="Serbian">Serbian</option>
              </select>
            </div>
          </div>

          {/* Section 2 */}
          <fieldset className="space-y-6 group" disabled={!isSectionOneComplete}>
            <div className="space-y-3 transition-opacity group-disabled:opacity-40">
              <p className="text-center font-medium text-gray-700">Text Content</p>
              <div className="flex justify-center space-x-2">
                {(['Minimal', 'Concise', 'Detailed', 'Extensive'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setFormState(s => ({ ...s, detailLevel: level }))}
                    className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                      formState.detailLevel === level
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border'
                    }`}>
                    {level}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3 transition-opacity group-disabled:opacity-40">
              <p className="text-center font-medium text-gray-700">Font</p>
              <div className="flex justify-center space-x-2">
                {fonts.map((font) => (
                  <button
                    key={font.name}
                    onClick={() => setFormState(s => ({ ...s, font: font.name }))}
                    className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                      formState.font === font.name
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border'
                    }`}
                  >
                    <span className={font.className}>{font.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </fieldset>
        </div>
      </div>

      {/* Right Column: Plan Preview */}
      <div className="w-1/2 p-6 bg-gray-100 overflow-y-auto flex flex-col">
        <PlanPreview plan={plan} isLoading={isLoading} fontName={formState.font} />

        {plan && !isLoading && (
          <div className="mt-6 text-center">
            <button
              onClick={handleGenerateDocument}
              disabled={isGeneratingDoc}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
            >
              {isGeneratingDoc ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                'Generate Document'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
