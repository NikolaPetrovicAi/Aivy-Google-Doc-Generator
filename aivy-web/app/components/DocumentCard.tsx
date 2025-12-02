import { FileText, Sheet, File } from 'lucide-react';
import { forwardRef } from 'react';
import Link from 'next/link';

interface DocumentCardProps {
  id: string;
  title: string;
  modifiedTime: string;
  mimeType: string;
  preview: string;
}

const DocumentCard = forwardRef<HTMLDivElement, DocumentCardProps>(
  ({ id, title, modifiedTime, mimeType, preview }, ref) => {
    const renderIcon = () => {
      switch (mimeType) {
        case 'application/vnd.google-apps.document':
          return <FileText className="h-12 w-12 text-blue-500 mb-2" />;
        case 'application/vnd.google-apps.spreadsheet':
          return <Sheet className="h-12 w-12 text-green-500 mb-2" />;
        default:
          return <File className="h-12 w-12 text-gray-400 mb-2" />;
      }
    };

    const formattedDate = new Date(modifiedTime).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    return (
      <Link href={`/doc/${id}`} key={id}>
        <div
          ref={ref}
          className="flex flex-col bg-white border border-gray-200 hover:shadow-md transition-shadow duration-200 h-80 w-48"
        >
          <div className="w-full h-64 bg-gray-100 overflow-hidden">
            {preview.startsWith('http') ? (
              <img src={preview} alt={title} className="w-full h-full object-cover" />
            ) : (
              <p className="text-xs text-gray-600 p-2">{preview}</p>
            )}
          </div>
          <div className="border-t border-gray-200 py-1 px-2 w-full">
            <div className="flex items-center justify-center w-full">
              {renderIcon()}
              <p className="text-sm font-medium text-gray-700 text-center truncate ml-2">
                {title}
              </p>
            </div>
            <p className="text-xs text-gray-500 text-center mt-1">{formattedDate}</p>
          </div>
        </div>
      </Link>
    );
  }
);

DocumentCard.displayName = 'DocumentCard';

export default DocumentCard;
