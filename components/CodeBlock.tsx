
import React, { useState, useEffect } from 'react';
import hljs from 'highlight.js';
import { ClipboardCopyIcon, CheckIcon, PlayIcon, ChevronDownIcon, ChevronUpIcon } from './IconComponents';
import { Theme } from '../types';

interface CodeBlockProps {
  code: string;
  language: string | undefined;
  currentAppTheme: Theme;
  onRunCode: (code: string, language: string | undefined) => void;
}

const MAX_LINES_COLLAPSED = 10;
const RUNNABLE_LANGUAGES = ['html', 'javascript', 'js', 'css'];

// Simple HTML escaping utility
const escapeHtml = (unsafeText: string): string => {
  const text = String(unsafeText); // Ensure it's a string
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language, currentAppTheme, onRunCode }) => {
  const [highlightedHTML, setHighlightedHTML] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCopiedFeedback, setShowCopiedFeedback] = useState(false);
  const [lineCount, setLineCount] = useState(0);

  useEffect(() => {
    setLineCount(code.split('\n').length);
    setIsExpanded(code.split('\n').length <= MAX_LINES_COLLAPSED);
  }, [code]);

  const normalizedLanguage = language?.toLowerCase() || 'plaintext';
  const displayedCode = isExpanded ? code : code.split('\n').slice(0, MAX_LINES_COLLAPSED).join('\n') + (lineCount > MAX_LINES_COLLAPSED ? '\n...' : '');

  useEffect(() => {
    try {
      if (displayedCode) { // Ensure there's code to highlight
        const result = hljs.highlight(displayedCode, { language: normalizedLanguage, ignoreIllegals: true });
        setHighlightedHTML(result.value);
      } else {
        setHighlightedHTML(''); // Handle empty code case
      }
    } catch (e) {
      console.error("Error highlighting code block (fallback to plain text):", e, "Language:", normalizedLanguage, "Code snippet:", displayedCode.substring(0,100));
      setHighlightedHTML(escapeHtml(displayedCode)); // Fallback to escaped plain text
    }
  }, [displayedCode, normalizedLanguage, currentAppTheme]); // Re-highlight on theme change or expansion/code change

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code)
      .then(() => {
        setShowCopiedFeedback(true);
        setTimeout(() => setShowCopiedFeedback(false), 1500);
      })
      .catch(err => console.error('Failed to copy code: ', err));
  };

  const canRun = RUNNABLE_LANGUAGES.includes(normalizedLanguage);

  return (
    <div className="my-3 bg-slate-100 dark:bg-slate-800 rounded-lg shadow-md overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-200 dark:bg-slate-700 border-b border-slate-300 dark:border-slate-600">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
          {normalizedLanguage}
        </span>
        <div className="flex items-center space-x-2">
          {canRun && (
            <button
              onClick={() => onRunCode(code, normalizedLanguage)}
              title="Run Code"
              className="p-1 text-slate-500 hover:text-sky-500 dark:text-slate-400 dark:hover:text-sky-400"
            >
              <PlayIcon className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleCopyCode}
            title={showCopiedFeedback ? "Copied!" : "Copy code"}
            className="p-1 text-slate-500 hover:text-sky-500 dark:text-slate-400 dark:hover:text-sky-400"
          >
            {showCopiedFeedback ? (
              <CheckIcon className="w-4 h-4 text-green-500" />
            ) : (
              <ClipboardCopyIcon className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
      <pre className="p-3 text-sm overflow-x-auto">
        <code
          className={`language-${normalizedLanguage}`} // Keep class for CSS themes
          dangerouslySetInnerHTML={{ __html: highlightedHTML }}
        />
      </pre>
      {lineCount > MAX_LINES_COLLAPSED && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full text-center py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-xs text-slate-600 dark:text-slate-300 transition-colors"
        >
          {isExpanded ? (
            <ChevronUpIcon className="w-4 h-4 inline mr-1" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 inline mr-1" />
          )}
          {isExpanded ? 'Show Less' : `Show More (${lineCount - MAX_LINES_COLLAPSED} lines)`}
        </button>
      )}
    </div>
  );
};

export default CodeBlock;
