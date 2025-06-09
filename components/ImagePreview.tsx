
import React from 'react';
import { XCircle } from 'lucide-react';

interface ImagePreviewProps {
  src: string;
  alt: string;
  onRemove: () => void;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ src, alt, onRemove }) => {
  return (
    <div className="relative flex-shrink-0 w-24 h-24 border border-gray-600 rounded-md overflow-hidden group">
      <img src={src} alt={alt} className="w-full h-full object-cover" />
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Remove image"
      >
        <XCircle size={18} />
      </button>
    </div>
  );
};

export default ImagePreview;
