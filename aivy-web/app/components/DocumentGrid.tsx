
import DocumentCard from "./DocumentCard";

interface Document {
  id: string;
  name: string;
  modifiedTime: string;
  mimeType: string;
  preview: string;
}

interface DocumentGridProps {
  documents: Document[];
  lastDocumentElementRef: (node: HTMLDivElement) => void;
}

export default function DocumentGrid({ documents, lastDocumentElementRef }: DocumentGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
      {documents.map((doc, index) => {
        if (documents.length === index + 1) {
          return (
            <DocumentCard
              ref={lastDocumentElementRef}
              key={doc.id}
              title={doc.name}
              modifiedTime={doc.modifiedTime}
              mimeType={doc.mimeType}
              preview={doc.preview}
            />
          );
        } else {
          return (
            <DocumentCard
              key={doc.id}
              title={doc.name}
              modifiedTime={doc.modifiedTime}
              mimeType={doc.mimeType}
              preview={doc.preview}
            />
          );
        }
      })}
    </div>
  );
}

