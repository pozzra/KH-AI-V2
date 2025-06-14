import React from 'react';
import { X, FileText, Image as ImageIcon } from 'lucide-react'; // Using lucide-react for icons

interface AttachmentPreviewProps {
  file: { data: string; mimeType: string; name: string };
  onRemove: () => void;
}

const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({ file, onRemove }) => {
  const isImage = file.mimeType.startsWith('image/');

  return (
    <div className="relative w-20 h-20 bg-gray-600 rounded-lg flex items-center justify-center overflow-hidden shadow-md flex-shrink-0">
      {isImage ? (
        // Display image preview
        <img
          src={`data:${file.mimeType};base64,${file.data}`}
          alt={file.name}
          className="w-full h-full object-cover"
        />
      ) : (
        // Display file name and icon for non-images
        <div className="flex flex-col items-center text-gray-300 p-1 text-center">
          {file.mimeType === 'application/pdf' ? (
            <FileText size={24} />
          ) : (
            <ImageIcon size={24} /> // Generic icon for other file types
          )}
          <span className="text-xs mt-1 truncate w-full px-1">{file.name}</span>
        </div>
      )}
      {/* Remove button */}
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 bg-black bg-opacity-50 rounded-full p-0.5 text-white hover:bg-opacity-75 transition-colors"
        aria-label={`Remove ${file.name}`}
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default AttachmentPreview;