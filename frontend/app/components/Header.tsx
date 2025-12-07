import { Search } from 'lucide-react';

export default function Header() {
  return (
    <header className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
      {/* Search Bar */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search files or commands..."
          className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-100 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* User Avatar */}
      <div className="ml-4 flex items-center">
        <div className="h-9 w-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
          AW
        </div>
      </div>
    </header>
  );
}
