import Link from 'next/link';
import { Home, Folder, FileText, LayoutGrid, Presentation, Mail, CalendarDays, Settings, User, Sparkles } from 'lucide-react';

export default function Sidebar() {
  return (
    <div className="w-64 bg-white shadow-md flex flex-col">
      {/* Logo */}
      <div className="p-4 text-lg font-bold text-gray-800 flex items-center">
        <Sparkles className="h-5 w-5 mr-2 text-blue-500" />
        Aivy Workspace
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-2 py-4">
        <NavLink href="#" icon={Home} label="Main" />
        <NavLink href="#" icon={Folder} label="Drive" />
        <NavLink href="#" icon={FileText} label="Docs" active />
        <NavLink href="#" icon={LayoutGrid} label="Sheets" />
        <NavLink href="#" icon={Presentation} label="Slides" />
        <NavLink href="#" icon={Mail} label="Gmail" />
        <NavLink href="#" icon={CalendarDays} label="Calendar" />
      </nav>

      {/* Bottom Navigation */}
      <div className="mt-auto px-2 py-4 border-t border-gray-200">
        <NavLink href="#" icon={Sparkles} label="Workspace AI" />
        <NavLink href="#" icon={Settings} label="Settings" />
        <NavLink href="#" icon={User} label="Profile" />
      </div>
    </div>
  );
}

// Helper component for navigation links
function NavLink({ href, icon: Icon, label, active }: { href: string; icon: any; label: string; active?: boolean }) {
  return (
    <Link href={href} className={`flex items-center px-2 py-2.5 rounded-md text-sm font-medium ${active ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-700 hover:bg-gray-200'}`}>
      <Icon className="h-5 w-5 mr-3" />
      {label}
    </Link>
  );
}
