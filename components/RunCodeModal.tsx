
import React, { useEffect, useState } from 'react';
import { CloseIcon, ReloadIcon, ExpandIcon, MinimizeIcon } from './IconComponents'; // Added ExpandIcon, MinimizeIcon

interface RunCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  language: string | undefined;
}

export const RunCodeModal: React.FC<RunCodeModalProps> = ({ isOpen, onClose, code, language }) => {
  const [iframeContent, setIframeContent] = useState('');
  const [iframeKey, setIframeKey] = useState(0); // Key to force iframe re-render
  const [isFullScreen, setIsFullScreen] = useState(false);

  const handleReload = () => {
    setIframeKey(prevKey => prevKey + 1);
  };

  const handleToggleFullScreen = () => {
    setIsFullScreen(prev => !prev);
  };

  useEffect(() => {
    if (isOpen) {
      let processedCode = code;
      const parentIsDark = window.document.documentElement.classList.contains('dark');
      const themeClass = parentIsDark ? 'dark' : '';
      let content = '';

      if (language === 'html') {
        content = `
          <html class="${themeClass}">
            <head>
              <title>HTML Output</title>
              <style>
                body { margin: 8px; padding: 0; font-family: sans-serif; background-color: #f8f9fa; color: #212529; }
                html.dark body { background-color: #212529; color: #f8f9fa; }
              </style>
            </head>
            <body>
              ${code}
            </body>
          </html>
        `;
      } else if (language === 'javascript' || language === 'js') {
        processedCode = code.replace(/<\/script>/gi, '<\\/script>');
        content = `
          <html class="${themeClass}">
            <head>
              <style>
                body { margin: 0; padding: 8px; font-family: sans-serif; background-color: #f8f9fa; color: #212529; }
                html.dark body { background-color: #212529; color: #f8f9fa; }
                pre { white-space: pre-wrap; word-wrap: break-word; margin-top: 0; margin-bottom: 0.5rem; font-family: monospace; }
                html.dark pre { color: #f8f9fa; } 
              </style>
              <script>
                const originalConsoleLog = console.log;
                console.log = (...args) => {
                  const output = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
                  const logEntry = document.createElement('pre');
                  logEntry.textContent = output;
                  document.body.appendChild(logEntry);
                  originalConsoleLog.apply(console, args);
                };
                window.onerror = (message, source, lineno, colno, error) => {
                  const errorEntry = document.createElement('pre');
                  errorEntry.style.color = 'red';
                  errorEntry.textContent = \`Error: \${message} (line \${lineno}:\${colno})\`;
                  document.body.appendChild(errorEntry);
                };
                window.addEventListener('DOMContentLoaded', () => {
                  try {
                    let result;
                    // Try to eval as an expression first, fallback to statement
                    try {
                      result = (0, eval)(\`(() => { return (\n${processedCode}\n) })()\`);
                    } catch {
                      result = (0, eval}(\`${processedCode}\`);
                    }
                    if (result !== undefined) {
                      const resultEntry = document.createElement('pre');
                      resultEntry.style.color = 'blue';
                      resultEntry.textContent = 'Result: ' + (typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result));
                      document.body.appendChild(resultEntry);
                    }
                  } catch (e) {
                    const errorEntry = document.createElement('pre');
                    errorEntry.style.color = 'red';
                    errorEntry.textContent = 'Error: ' + e;
                    document.body.appendChild(errorEntry);
                  }
                });
              </script>
            </head>
            <body>
            </body>
          </html>
        `;
      } else if (language === 'css') {
        processedCode = code.replace(/<\/style>/gi, '<\\/style>');
        content = `
          <html class="${themeClass}">
            <head>
              <style>${processedCode}</style>
              <style> /* Base styles for CSS preview */
                body { margin: 0; padding: 8px; font-family: sans-serif; background-color: #f8f9fa; color: #212529; }
                html.dark body { background-color: #212529; color: #f8f9fa; }
              </style>
            </head>
            <body>
              <div style="padding:8px; font-family: sans-serif; min-height: 50px;"> <!-- Added min-height and div for visibility -->
                <p>CSS applied. Add HTML elements (e.g., via browser dev tools) or modify the CSS to style this container or new elements to see results.</p>
                <div class="example-class" style="border: 1px solid green; padding: 5px; margin-top:5px;">This is a test div.</div>
              </div>
            </body>
          </html>
        `;
      } else {
        // Fallback for non-runnable languages or if language is undefined
        content = `
          <html class="${themeClass}">
            <head>
              <style>
                  body { margin: 0; padding: 8px; font-family: sans-serif; background-color: #f8f9fa; color: #212529; }
                  html.dark body { background-color: #212529; color: #f8f9fa; }
                  pre { white-space: pre-wrap; word-wrap: break-word; }
              </style>
            </head>
            <body>
              <pre>${code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
            </body>
          </html>`;
      }
      setIframeContent(content);
    }
  }, [isOpen, code, language, iframeKey]); // Added iframeKey to re-run effect on reload

  useEffect(() => {
    // Reset iframeKey when fullscreen state changes to ensure content is re-evaluated if needed
    // This is not strictly necessary for this implementation but can be useful if iframe content depended on fullscreen state
    // setIframeKey(prevKey => prevKey + 1); 
  }, [isFullScreen]);

  if (!isOpen) return null;

  const modalContainerClasses = isFullScreen
    ? "bg-black/60 fixed inset-0 z-50 flex items-center justify-center p-0"
    : "bg-black/60 fixed inset-0 z-50 flex items-center justify-center p-4";

  const modalContentClasses = isFullScreen
    ? "bg-white dark:bg-slate-800 w-screen h-screen max-w-full max-h-full rounded-none shadow-none flex flex-col overflow-hidden"
    : "bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden";


  return (
    <div className={modalContainerClasses} onClick={onClose} aria-modal="true" role="dialog">
      <div 
        className={modalContentClasses}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Code Output {language && `(${language})`}
          </h3>
          <div className="flex items-center space-x-1">
            <button
              onClick={handleReload}
              className="p-1.5 text-slate-500 hover:text-sky-500 dark:text-slate-400 dark:hover:text-sky-400 rounded-md"
              aria-label="Reload code output"
              title="Reload"
            >
              <ReloadIcon className="w-5 h-5" />
            </button>
            <button
              onClick={handleToggleFullScreen}
              className="p-1.5 text-slate-500 hover:text-sky-500 dark:text-slate-400 dark:hover:text-sky-400 rounded-md"
              aria-label={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}
              title={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullScreen ? <MinimizeIcon className="w-5 h-5" /> : <ExpandIcon className="w-5 h-5" />}
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-md"
              aria-label="Close code output modal"
              title="Close"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-grow p-1 bg-slate-50 dark:bg-slate-900">
          <iframe
            key={iframeKey} // Use key to force re-mount on reload
            srcDoc={iframeContent}
            title="Code Execution Result"
            className="w-full h-full border-0 rounded" // iframe itself can keep rounded if its parent has overflow hidden
            sandbox="allow-scripts allow-modals allow-forms" 
          />
        </div>
      </div>
    </div>
  );
};
