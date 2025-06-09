
import React, { useState, useCallback, JSX } from 'react';
import { Play, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import IconButton from './IconButton';

interface CodeEmulatorProps {
  language: string;
  code: string;
}

const CodeEmulator = ({ language, code }: CodeEmulatorProps): JSX.Element => {
  const [isRunning, setIsRunning] = useState(false);
  const [showCode, setShowCode] = useState(true);
  const [iframeSrcDoc, setIframeSrcDoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunCode = useCallback(() => {
    setError(null);
    let srcDocContent = '';
    const sanitizedLanguage = language.toLowerCase().trim();

    try {
      if (sanitizedLanguage === 'html') {
        // Basic check for script tags in HTML to warn if they are present
        // This is a very simple check and not a full XSS sanitizer.
        if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(code)) {
            // console.warn("HTML content includes script tags. Ensure they are safe.");
        }
        srcDocContent = code;
      } else if (sanitizedLanguage === 'javascript' || sanitizedLanguage === 'js') {
        srcDocContent =
          '<!DOCTYPE html>\n' +
          '<html lang="en">\n' +
          '<head>\n' +
          '  <meta charset="UTF-8">\n' +
          '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
          '  <title>JS Execution</title>\n' +
          '  <style>body { margin: 8px; font-family: sans-serif; background-color: #f0f0f0; color: #333; }</style>\n' +
          '</head>\n' +
          '<body>\n' +
          '  <script>\n' +
          '    // Capture console.log and display it\n' +
          '    const originalConsoleLog = console.log;\n' +
          '    console.log = (...args) => {\n' +
          '      originalConsoleLog(...args);\n' +
          '      const output = document.createElement(\'pre\');\n' +
          '      output.textContent = args.map(arg => typeof arg === \'object\' ? JSON.stringify(arg, null, 2) : String(arg)).join(\' \');\n' +
          '      document.body.appendChild(output);\n' +
          '    };\n' +
          '    try {\n' +
          `      ${code}\n` + // The user's code is still interpolated here
          '    } catch (e) {\n' +
          '      console.error("Error executing script:", e);\n' +
          '      const errorOutput = document.createElement(\'pre\');\n' +
          '      errorOutput.style.color = \'red\';\n' +
          '      errorOutput.textContent = "Error: " + e.message;\n' +
          '      document.body.appendChild(errorOutput);\n' +
          '    }\n' +
          '  <\/script>\n' + // Correctly escaped
          '</body>\n' +
          '</html>\n';
      } else if (sanitizedLanguage === 'css') {
        srcDocContent = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>CSS Preview</title>
            <style>
              body { margin: 0; padding: 10px; background-color: #fff; }
              /* Example styled div to see CSS in action */
              .example-div { 
                /* Default styles for the example div, can be overridden by user's CSS */
                border: 1px solid #ccc; 
                margin: 10px; 
                padding: 5px;
                box-sizing: border-box;
                width: 100px; /* Default width */
                height: 100px; /* Default height */
                background-color: #f9f9f9; /* Default background */
              } 
              ${code} /* User's CSS is injected here */
            </style>
          </head>
          <body>
            <p style="font-size: 0.875rem; color: #4B5563; margin-bottom: 0.5rem;">CSS applied. Below is an example div (add your own HTML structure in a full HTML block if needed for complex CSS).</p>
            <div class="example-div">Styled Div</div>
          </body>
          </html>
        `;
      } else {
        setError(`Unsupported language for emulation: ${language}. Only HTML, JavaScript, and CSS are supported.`);
        setIsRunning(false);
        setIframeSrcDoc(null);
        return;
      }
      setIframeSrcDoc(srcDocContent);
      setIsRunning(true);
    } catch (e) {
        console.error("Error preparing srcDoc:", e);
        setError(e instanceof Error ? e.message : "An unknown error occurred preparing the code.");
        setIsRunning(false);
        setIframeSrcDoc(null);
    }
  }, [code, language]);

  const toggleShowCode = () => setShowCode(!showCode);

  const supportedLanguages = ['html', 'javascript', 'js', 'css'];
  const isSupported = supportedLanguages.includes(language.toLowerCase().trim());

  return (
    <div className="my-3 p-3 border border-gray-600 rounded-lg bg-gray-800 shadow">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase">
          {language} {isSupported ? 'Emulator' : 'Snippet'}
        </span>
        <div className="flex items-center space-x-1">
          {isSupported && (
            <IconButton
              icon={<Play size={16} />}
              label="Run Code"
              onClick={handleRunCode}
              className="text-green-400 hover:text-green-300 p-1 bg-gray-700 hover:bg-gray-600"
              disabled={!isSupported}
            />
          )}
          <IconButton
            icon={showCode ? <EyeOff size={16} /> : <Eye size={16} />}
            label={showCode ? 'Hide Code' : 'View Code'}
            onClick={toggleShowCode}
            className="text-gray-400 hover:text-gray-300 p-1 bg-gray-700 hover:bg-gray-600"
          />
        </div>
      </div>

      {error && (
        <div className="mb-2 p-2 bg-red-900 border border-red-700 text-red-300 rounded-md text-xs flex items-center">
          <AlertTriangle size={16} className="mr-2 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {showCode && (
        <pre className="bg-gray-900 text-gray-200 p-3 rounded-md overflow-x-auto max-h-60 custom-scrollbar text-xs mb-2">
          <code>{code}</code>
        </pre>
      )}

      {isRunning && iframeSrcDoc && isSupported && (
        <div className="mt-2">
          <h4 className="text-sm font-medium text-gray-300 mb-1">Output:</h4>
          <iframe
            srcDoc={iframeSrcDoc}
            title={`Code Execution: ${language}`}
            sandbox="allow-scripts allow-modals" // allow-modals for alert/confirm/prompt in JS
            className="w-full h-64 border border-gray-600 rounded-md bg-white"
            onError={(e) => {
                console.error("Iframe loading error:", e);
                setError("Error loading content in the iframe. The code might have issues or be restricted by sandboxing.");
            }}
          />
        </div>
      )}
    </div>
  );
};

export default CodeEmulator;