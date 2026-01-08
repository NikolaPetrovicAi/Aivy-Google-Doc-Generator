
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
    <div className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-4">
      {documents.map((doc, index) => {
        if (documents.length === index + 1) {
          return (
            <DocumentCard
              ref={lastDocumentElementRef}
              key={doc.id}
              id={doc.id}
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
              id={doc.id}
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

