import React from 'react';
import { XCircle, FileText } from 'lucide-react';

interface ImagePreviewProps {
  src?: string; // src is optional for PDF
  alt: string;
  onRemove?: () => void; // Make optional
  mimeType?: string; // Add mimeType to distinguish PDF
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ src, alt, onRemove, mimeType }) => {
  // If it's a PDF, show an icon and filename instead of an image
  if (mimeType === 'application/pdf') {
    return (
      <div className="relative flex-shrink-0 w-24 h-24 border border-gray-600 rounded-md overflow-hidden flex flex-col items-center justify-center bg-gray-900">
        <FileText className="text-red-500 mb-2" size={32} />
        <span className="text-xs text-gray-200 text-center px-1 break-all">{alt}</span>
        {onRemove && (
          <button
            onClick={onRemove}
            className="absolute top-1 right-1 bg-black/50 text-red-500 rounded-full p-0.5 opacity-80 hover:opacity-100 transition-opacity"
            aria-label="Remove file"
          >
            <XCircle size={18} />
          </button>
        )}
      </div>
    );
  }

  // Default image preview
  return (
    <div className="relative flex-shrink-0 w-24 h-24 border border-gray-600 rounded-md overflow-hidden group">
      <img src={src} alt={alt} className="w-full h-full object-cover" />
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-1 right-1 bg-black/50 text-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Remove image"
        >
          <XCircle size={18} />
        </button>
      )}
    </div>
  );
};

export default ImagePreview;
