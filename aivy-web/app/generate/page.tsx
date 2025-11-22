"use client";

import { useState, useEffect, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import PlanPreview from '../components/PlanPreview';

// Define the types for the form state and the plan
interface FormState {
  docType: 'doc' | 'presentation' | 'sheet' | '';
  topic: string;
  pages: string; // Use string for select value
  language: string;
  detailLevel: 'Minimal' | 'Concise' | 'Detailed' | 'Extensive' | '';
}

interface Plan {
  pages: Array<{
    page: number;
    title: string;
    summary: string;
  }>;
}

export default function GenerateDocumentPage() {
  const [formState, setFormState] = useState<FormState>({
    docType: '',
    topic: '',
    pages: '1',
    language: 'English',
    detailLevel: 'Detailed',
  });
  const [plan, setPlan] = useState<Plan | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

      const mockPlan: Plan = {
        pages: Array.from({ length: parseInt(formState.pages) }, (_, i) => ({
          page: i + 1,
          title: `Page ${i + 1}: Title for ${formState.topic}`,
          summary: `Summary for page ${i + 1} with ${formState.detailLevel} detail, in ${formState.language}.`,
        })),
      };
      
      setPlan(mockPlan);
      setIsLoading(false);
    };

    generatePlan();
  }, [isSectionOneComplete, debouncedTopic, formState.pages, formState.language, formState.detailLevel, formState.docType]); // Add all relevant dependencies

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
              <p className="text-center font-medium text-gray-700">Theme</p>
              <div className="flex justify-center space-x-4">
                <button className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-400 to-indigo-500 shadow-md hover:opacity-90 transition-opacity"></button>
                <button className="w-16 h-16 rounded-lg bg-gradient-to-br from-green-400 to-teal-500 shadow-md hover:opacity-90 transition-opacity"></button>
                <button className="w-16 h-16 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 shadow-md hover:opacity-90 transition-opacity"></button>
              </div>
            </div>
          </fieldset>
        </div>
      </div>

      {/* Right Column: Plan Preview */}
      <div className="w-1/2 p-6 bg-gray-100 overflow-y-auto">
        <PlanPreview plan={plan} isLoading={isLoading} />
      </div>
    </div>
  );
}
