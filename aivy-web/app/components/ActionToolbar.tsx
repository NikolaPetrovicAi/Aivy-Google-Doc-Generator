import { ChevronDown, Plus, FilePlus, MessageSquareMore, MoreHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ActionToolbar() {
  const router = useRouter();
  return (
    <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
      {/* Left side: Sort and Generate buttons */}
      <div className="flex items-center space-x-3">
        {/* Sort Dropdown */}
        <button className="flex items-center px-4 py-2 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 text-sm font-medium">
          Sort
          <ChevronDown className="ml-2 h-4 w-4" />
        </button>

        {/* Generate new Doc Button */}
        <button
          onClick={() => router.push('/generate')}
          className="flex items-center px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="mr-2 h-4 w-4" />
          Generate new Doc
        </button>

        {/* New blank Button */}
        <button className="flex items-center px-4 py-2 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 text-sm font-medium">
          <FilePlus className="mr-2 h-4 w-4" />
          New blank
        </button>

        {/* AI Chat Button */}
        <button className="flex items-center px-4 py-2 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 text-sm font-medium">
          <MessageSquareMore className="mr-2 h-4 w-4" />
          AI Chat
        </button>
      </div>

      {/* Right side: More options (ellipsis) */}
      <div>
        <button className="p-2 rounded-md hover:bg-gray-200">
          <MoreHorizontal className="h-5 w-5 text-gray-600" />
        </button>
      </div>
    </div>
  );
}
