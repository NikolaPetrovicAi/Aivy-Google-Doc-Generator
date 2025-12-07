"use client";

import { fonts } from '../lib/fonts';

interface Plan {
  pages: Array<{ 
    page: number;
    title: string;
    summary: string;
  }>;
}

interface PlanPreviewProps {
  plan: Plan | null;
  isLoading: boolean;
  fontName?: string;
}

export default function PlanPreview({ plan, isLoading, fontName }: PlanPreviewProps) {
  const selectedFont = fonts.find(f => f.name === fontName);
  const fontClass = selectedFont ? selectedFont.className : '';

  if (isLoading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md text-center text-gray-500">
        <p>The generated plan will appear here as you type.</p>
      </div>
    );
  }

  return (
    <div className={`p-6 bg-white rounded-lg shadow-md ${fontClass}`}>
      <h2 className="text-xl font-bold mb-4">Document Plan</h2>
      <div className="space-y-4">
        {plan.pages.map((page) => (
          <div key={page.page}>
            <h3 className="font-semibold text-gray-800">Page {page.page}: {page.title}</h3>
            <p className="text-sm text-gray-600 ml-2">- {page.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
