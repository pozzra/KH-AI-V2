
import React, { useState, useMemo } from 'react';
import { ChatMessage, Sender, FilePart, Theme } from '../types';
import { UserIcon, FileIcon, PencilIcon, ClipboardCopyIcon, CheckIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from './IconComponents';
import LoadingDots from './LoadingDots';
import { marked, Renderer } from 'marked';
import CodeBlock from './CodeBlock'; 
import hljs from 'highlight.js';

interface ChatMessageItemProps {
  message: ChatMessage;
  onStartEdit: (messageId: string, currentText: string) => void;
  isBeingEdited: boolean;
  onToggleSpeak?: (messageId: string, textToSpeak: string) => void;
  isCurrentlySpeaking?: boolean;
  isSpeechSynthesisSupported?: boolean;
  currentAppTheme: Theme;
  onRunCode: (code: string, language: string | undefined) => void;
}

// Utility to ensure value is a string and not "[object Object]" from an actual object
const ensureStringContent = (value: any, context: string = 'unknown'): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || value === undefined) {
    return '';
  }
  const stringified = String(value);
  if (stringified === '[object Object]' && typeof value === 'object') {
    console.warn(`[ensureStringContent] Unexpected object received in context: ${context}. Rendering empty string. Value:`, value);
    return ''; // Or a placeholder like "[Content Error]"
  }
  return stringified;
};

// Simple HTML escaping utility, now using ensureStringContent
const escapeHtml = (unsafeInput: any): string => {
  const unsafe = ensureStringContent(unsafeInput, 'escapeHtmlInput');
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Custom renderer for non-fenced block elements within text segments
const createTextSegmentRenderer = () => {
  const renderer = new Renderer();

  renderer.paragraph = (tokenOrText: any) => { // Can be string or Marked.Tokens.Paragraph
    let textToRender: string;
    // Check if it's a marked token object with a 'text' property
    if (typeof tokenOrText === 'object' && tokenOrText !== null && typeof tokenOrText.text === 'string') {
      textToRender = tokenOrText.text;
    } else if (typeof tokenOrText === 'string') {
      textToRender = tokenOrText; // It's already a string
    } else {
      // Fallback for unexpected types, ensureStringContent will further sanitize
      textToRender = tokenOrText;
    }
    return `<p class="my-1">${ensureStringContent(textToRender, 'paragraph_content')}</p>`;
  };

  renderer.link = ({ href, title, tokens }: { href?: string | null; title?: string | null; tokens?: any }) => {
    const safeHref = ensureStringContent(href, 'link.href');
    const safeTitle = ensureStringContent(title, 'link.title');
    // Render the inner text from tokens using marked.parser
    const safeText = ensureStringContent(tokens && Array.isArray(tokens) ? marked.parser(tokens, { renderer }) : '', 'link.text');
    return `<a href="${safeHref || '#'}" title="${safeTitle || ''}" target="_blank" rel="noopener noreferrer" class="text-sky-500 dark:text-sky-400 hover:underline">${safeText}</a>`;
  };
  
  renderer.codespan = ({ text }: { text: string }) => {
    const safeCode = ensureStringContent(text, 'codespan');
    try {
      const highlightedCode = hljs.highlightAuto(safeCode).value;
      return `<code class="bg-slate-200 dark:bg-slate-600 px-1 py-0.5 rounded text-sm font-mono">${highlightedCode}</code>`;
    } catch (e) {
      console.warn("Error highlighting inline code:", e, "Original code:", safeCode);
      return `<code class="bg-slate-200 dark:bg-slate-600 px-1 py-0.5 rounded text-sm font-mono">${escapeHtml(safeCode)}</code>`;
    }
  };

  renderer.list = (token: any) => {
    // token: { ordered: boolean, start: number, items: Token[], ... }
    const safeBody = token.body ? ensureStringContent(token.body, 'list.body') : 
      (token.items && Array.isArray(token.items)
        ? token.items.map((item: any) => renderer.listitem(item)).join('')
        : '');
    const type = token.ordered ? 'ol' : 'ul';
    const classNames = token.ordered ? 'list-decimal' : 'list-disc';
    const safeStart = ensureStringContent(token.start, 'list.start');
    const startAttr = (token.ordered && safeStart && safeStart !== '1' && safeStart !== '') ? ` start="${safeStart}"` : '';
    return `<${type} class="${classNames} pl-5 my-2 space-y-1"${startAttr}>${safeBody}</${type}>`;
  };

  renderer.listitem = (item: any, task?: boolean, checked?: boolean) => {
    // For list items, 'item' might also be a token object if it contains complex inline elements.
    // However, marked usually flattens simple list items to string text.
    // If complex list items become an issue, a similar check to paragraph might be needed.
    let contentToRender: string;
    if (typeof item === 'object' && item !== null && typeof item.text === 'string') {
      contentToRender = item.text; // Handle potential token object
    } else if (typeof item === 'string') {
      contentToRender = item;
    } else {
      contentToRender = item; // Fallback
    }

    const safeText = ensureStringContent(contentToRender, 'listitem.text');
    if (task) {
      const checkbox = `<input type="checkbox" class="mr-2" ${checked ? 'checked' : ''} disabled /> `;
      // Task list items from GFM often have the text directly, not nested in <p>
      // So, we don't wrap safeText in <p> here.
      return `<li class="flex items-center list-none -ml-5">${checkbox}${safeText.startsWith('<p>') && safeText.endsWith('</p>') ? safeText.slice(3, -4) : safeText}</li>`;
    }
    return `<li>${safeText}</li>`;
  };
  
  renderer.blockquote = ({ tokens }: any) => {
    // tokens is an array of tokens; we need to render them as HTML
    const quoteHtml = tokens && Array.isArray(tokens)
      ? tokens.map((token: any) => marked.parser([token], { renderer })).join('')
      : '';
    return `<blockquote class="pl-3 italic border-l-4 border-slate-300 dark:border-slate-600 my-2">${ensureStringContent(quoteHtml, 'blockquote')}</blockquote>`;
  };

  renderer.heading = (token: any) => {
    // token: { depth: number, text: string, ... }
    const depth: number = typeof token.depth === 'number' ? token.depth : 1;
    const text: string = typeof token.text === 'string' ? token.text : '';
    const safeText = ensureStringContent(text, `heading.h${depth}`);
    const sizes: { [key: number]: string } = {1: 'text-2xl', 2: 'text-xl', 3: 'text-lg', 4: 'text-base', 5: 'text-sm', 6: 'text-xs'};
    return `<h${depth} class="${sizes[depth] || 'text-base'} font-semibold my-2">${safeText}</h${depth}>`;
  };

  renderer.strong = ({ tokens }: any) => {
    // tokens is an array of inline tokens; render them to HTML
    const innerHtml = tokens && Array.isArray(tokens)
      ? tokens.map((token: any) => marked.parser([token], { renderer })).join('')
      : '';
    return `<strong>${ensureStringContent(innerHtml, 'strong')}</strong>`;
  };
  renderer.em = ({ tokens }: any) => {
    const innerHtml = tokens && Array.isArray(tokens)
      ? tokens.map((token: any) => marked.parser([token], { renderer })).join('')
      : '';
    return `<em>${ensureStringContent(innerHtml, 'em')}</em>`;
  };
  renderer.del = ({ tokens }: any) => {
    const innerHtml = tokens && Array.isArray(tokens)
      ? tokens.map((token: any) => marked.parser([token], { renderer })).join('')
      : '';
    return `<del>${ensureStringContent(innerHtml, 'del')}</del>`;
  };
  renderer.hr = () => '<hr class="my-3 border-slate-300 dark:border-slate-600"/>';
  renderer.br = () => '<br/>';
  renderer.html = ({ text }: { text: string }) => ensureStringContent(text, 'html'); // Sanitize direct HTML too

  return renderer;
};


const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ 
  message, 
  onStartEdit, 
  isBeingEdited,
  onToggleSpeak,
  isCurrentlySpeaking,
  isSpeechSynthesisSupported,
  currentAppTheme,
  onRunCode
}) => {
  const isUser = message.sender === Sender.USER;
  const [showCopiedFeedback, setShowCopiedFeedback] = useState(false);
  const [copiedButtonId, setCopiedButtonId] = useState<string | null>(null);

  // Memoize the renderer creation
  const textSegmentRenderer = useMemo(() => createTextSegmentRenderer(), []);


  const handleCopyText = (buttonId: string, textToCopy?: string) => {
    const text = ensureStringContent(textToCopy || message.textPart, 'copyText');
    if (text) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopiedButtonId(buttonId);
          setShowCopiedFeedback(true);
          setTimeout(() => {
            setShowCopiedFeedback(false);
            setCopiedButtonId(null);
          }, 1500);
        })
        .catch(err => console.error('Failed to copy text: ', err));
    }
  };

  const handleEditClick = () => {
    if (message.textPart) {
      onStartEdit(message.id, ensureStringContent(message.textPart, 'editClick'));
    }
  };

  const handleSpeakClick = () => {
    if (onToggleSpeak && message.textPart && isSpeechSynthesisSupported) {
      onToggleSpeak(message.id, ensureStringContent(message.textPart, 'speakClick'));
    }
  };

  const renderFilePart = (filePart: FilePart, index: number) => {
    const isImage = filePart.mimeType.startsWith('image/');
    // Ensure data is a string before trying to find indexOf
    const safeData = ensureStringContent(filePart.data, `filePart.data[${index}]`);
    const estimatedOriginalSizeBytes = (safeData.length - (safeData.includes(',') ? safeData.indexOf(',') : -1) -1) * 0.75;
    const sizeInMB = (estimatedOriginalSizeBytes / (1024*1024)).toFixed(2);
    const safeName = ensureStringContent(filePart.name, `filePart.name[${index}]`);

    return (
      <div key={index} className={`mt-2 p-2 rounded-lg ${isImage ? 'bg-transparent' : 'bg-slate-100 dark:bg-slate-600'}`}>
        {isImage ? (
          <img 
            src={safeData} 
            alt={safeName} 
            className="max-w-[150px] sm:max-w-[200px] max-h-48 rounded object-contain"
          />
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <FileIcon className="w-6 h-6 flex-shrink-0" />
            <span>{safeName} ({ sizeInMB } MB)</span>
          </div>
        )}
      </div>
    );
  };

  const messageBubbleId = `msg-bubble-${message.id}`;
  const userActionsCopyId = `user-actions-copy-${message.id}`;

  const renderMessageContent = (text: string | undefined) => {
    const safeText = ensureStringContent(text, 'renderMessageContentInput');
    if (!safeText) return null;

    const codeBlockRegex = new RegExp("(```(?:[a-zA-Z0-9_.-]+)?\\n[\\s\\S]*?\\n```)", "g");
    const parts = safeText.split(codeBlockRegex);
    
    return parts.map((part, index) => {
      const safePart = ensureStringContent(part, `renderMessageContent.part[${index}]`);
      if (safePart.match(codeBlockRegex)) {
        const match = new RegExp("```([a-zA-Z0-9_.-]+)?\\n([\\s\\S]*?)\\n```").exec(safePart);
        const language = match?.[1];
        const code = match?.[2] || '';
        return (
          <CodeBlock
            key={`code-${message.id}-${index}`}
            code={ensureStringContent(code, `codeBlock.code[${index}]`).trim()}
            language={ensureStringContent(language, `codeBlock.language[${index}]`)}
            currentAppTheme={currentAppTheme}
            onRunCode={onRunCode}
          />
        );
      } else {
        if (safePart.trim()) {
           try {
             // For text segments, we are using the custom renderer.
             // 'breaks: true' adds <br> for newlines. 'gfm: true' enables GitHub Flavored Markdown.
             const html = marked.parse(safePart.trim(), { renderer: textSegmentRenderer, breaks: true, gfm: true });
             return <div key={`text-${message.id}-${index}`} className="prose prose-sm dark:prose-invert max-w-none break-words" dangerouslySetInnerHTML={{ __html: ensureStringContent(html, `markedOutput[${index}]`) }} />;
           } catch (e) {
              console.error("Error parsing markdown segment:", e, "Original part:", safePart);
              // Fallback to pre-formatted, escaped text if parsing fails.
              return <div key={`text-error-${message.id}-${index}`} className="prose prose-sm dark:prose-invert max-w-none break-words whitespace-pre-wrap">{escapeHtml(safePart)}</div>;
           }
        }
        return null;
      }
    });
  };


  return (
    <div className={`group/outer flex items-start gap-3 my-4 ${isUser ? 'justify-end' : ''} ${isBeingEdited ? (isUser ? 'bg-sky-100 dark:bg-sky-900/50' : 'bg-slate-100 dark:bg-slate-800/50') : ''} rounded-lg p-1 -m-1`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
          <img src="https://github.com/pozzra/KH-AI-V2/blob/main/Images/kh_ai_logo.png?raw=true" alt="KH AI Logo" className="w-auto h-8 rounded-full" />
        </div>
      )}

      {isUser && (
        <div 
          className="relative order-1 self-center flex flex-col items-center space-y-1 opacity-0 group-hover/outer:opacity-100 focus-within:opacity-100 transition-opacity duration-150 "
        >
          {message.textPart && !isBeingEdited && (
            <button
              onClick={handleEditClick}
              title="Edit message"
              className="p-1.5 text-slate-500 hover:text-sky-500 dark:text-slate-400 dark:hover:text-sky-400 rounded-full bg-white dark:bg-slate-700 shadow"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          )}
          {message.textPart && (
            <button
              onClick={() => handleCopyText(userActionsCopyId)}
              title={showCopiedFeedback && copiedButtonId === userActionsCopyId ? "Copied!" : "Copy text"}
              className="relative p-1.5 text-slate-500 hover:text-sky-500 dark:text-slate-400 dark:hover:text-sky-400 rounded-full bg-white dark:bg-slate-700 shadow"
            >
              {showCopiedFeedback && copiedButtonId === userActionsCopyId ? (
                <CheckIcon className="w-4 h-4 text-green-500" />
              ) : (
                <ClipboardCopyIcon className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      )}
      
      <div className={`relative order-2 ${isUser ? '' : ''}`}>
        <div
          id={messageBubbleId}
          className={`group/bubble relative w-fit max-w-md :max-w-lg md:max-w-xl lg:max-w-2xl p-5 rounded-xl shadow-md   ${
            isUser
              ? 'bg-sky-500 dark:bg-sky-600 text-white rounded-br-none'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-none'
          }`}
        >
          {message.isLoading && message.sender === Sender.AI && !message.textPart && !message.fileParts ? (
            <LoadingDots />
          ) : (
            <>
              {renderMessageContent(message.textPart)}
              {message.fileParts && message.fileParts.length > 0 && (
                <div className={`mt-2 ${message.fileParts.some(fp => fp.mimeType.startsWith('image/')) ? 'flex flex-wrap gap-2' : 'space-y-2'}`}>
                  {message.fileParts.map(renderFilePart)}
                </div>
              )}
              {message.error && <p  className="text-red-400 dark:text-red-300 text-sm mt-1  break-words whitespace-pre-wrap ">{ensureStringContent(message.error, 'message.error')}</p>}
            </>
          )}
          {message.isLoading && message.sender === Sender.AI && (message.textPart || (message.fileParts && message.fileParts.length > 0) ) && <LoadingDots /> }
          
          <div className="flex justify-between items-end mt-1 text-xs text-slate-500 dark:text-slate-400  ">
            <p className={`text-xs ${isUser ? 'text-sky-100 dark:text-sky-200' : 'text-slate-500 dark:text-slate-400'}`}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

           {!isUser && message.textPart && ( 
            <div className="absolute top-2 right-0 left-110  flex flex-col space-y-1 opacity-0 group-hover/bubble:opacity-100 transition-opacity duration-150 focus-within:opacity-100 ">
                <button
                onClick={() => handleCopyText(messageBubbleId)}
                title={showCopiedFeedback && copiedButtonId === messageBubbleId ? "Copied!" : "Copy text"}
                className={`p-1 rounded-full opacity-0 group-hover/bubble:opacity-100 transition-opacity duration-150 focus:opacity-100 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200`}
                >
                {showCopiedFeedback && copiedButtonId === messageBubbleId ? (
                    <CheckIcon className="w-4 h-4 text-green-500 dark:text-green-400" />
                ) : (
                    <ClipboardCopyIcon className="w-4 h-4" />
                )}
                </button>
                {onToggleSpeak && isSpeechSynthesisSupported && (
                    <button
                        onClick={handleSpeakClick}
                        disabled={!isSpeechSynthesisSupported}
                        title={isCurrentlySpeaking ? "Stop speaking" : "Speak message"}
                        className={`p-1 rounded-full opacity-0 group-hover/bubble:opacity-100 transition-opacity duration-150 focus:opacity-100 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-50`}
                    >
                        {isCurrentlySpeaking ? (
                            <SpeakerXMarkIcon className="w-4 h-4 text-red-500 dark:text-red-400" />
                        ) : (
                            <SpeakerWaveIcon className="w-4 h-4" />
                        )}
                    </button>
                )}
            </div>
          )}
        </div>
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center order-3">
          <UserIcon className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
        </div>
      )}
    </div>
  );
};

export default ChatMessageItem;
