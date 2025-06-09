
import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string; // For accessibility
}

const IconButton: React.FC<IconButtonProps> = ({ icon, label, className, ...props }) => {
  return (
    <button
      {...props}
      aria-label={label}
      className={`p-2 text-gray-400 hover:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 rounded-full transition-colors ${className}`}
    >
      {icon}
    </button>
  );
};

export default IconButton;
