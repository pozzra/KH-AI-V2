
import React, { useRef } from 'react';
import { SendIcon, PaperClipIcon, CloseIcon, FileIcon, CheckIcon, MicrophoneIcon, StopCircleIcon, StopSolidIcon } from './IconComponents';
import { ALLOWED_FILE_TYPES, MAX_INDIVIDUAL_FILE_SIZE, MAX_TOTAL_FILE_SIZE, MAX_FILES_PER_MESSAGE } from '../utils';
import { RecognitionLanguage } from '../types'; // Import RecognitionLanguage

interface ChatInputProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSendMessage: (files?: File[] | null) => void; // This will handle both send and save edit
  isLoading: boolean;
  isChatDisabled: boolean;
  isEditing: boolean; // True if a message is being edited
  onCancelEdit: () => void; // Callback to cancel editing mode
  selectedFilePreviews: FilePreview[];
  setSelectedFilePreviews: React.Dispatch<React.SetStateAction<FilePreview[]>>;
  fileError: string | null;
  setFileError: React.Dispatch<React.SetStateAction<string | null>>;

  // Voice Input Props
  isListening: boolean;
  onToggleListening: () => void;
  currentRecognitionLang: RecognitionLanguage; 
  onChangeRecognitionLang: (lang: RecognitionLanguage) => void; 
  isSpeechApiSupported: boolean;

  // Stop Generation Prop
  onStopGeneration: () => void;
}

export interface FilePreview { // Exporting for App.tsx to use
  id: string; 
  name: string;
  type: string;
  dataUrl?: string; 
  fileObject: File; 
}

const ChatInput: React.FC<ChatInputProps> = ({
  inputValue,
  onInputChange,
  onSendMessage,
  isLoading,
  isChatDisabled,
  isEditing,
  onCancelEdit,
  selectedFilePreviews,
  setSelectedFilePreviews,
  fileError,
  setFileError,
  isListening,
  onToggleListening,
  currentRecognitionLang, 
  onChangeRecognitionLang, 
  isSpeechApiSupported,
  onStopGeneration,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null); 

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isEditing) return; 

    const files = event.target.files;
    if (!files || files.length === 0) return;

    setFileError(null);
    let newPreviews: FilePreview[] = [...selectedFilePreviews];
    let currentTotalSize = selectedFilePreviews.reduce((sum, fp) => sum + fp.fileObject.size, 0);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (newPreviews.length >= MAX_FILES_PER_MESSAGE) {
        setFileError(`Cannot select more than ${MAX_FILES_PER_MESSAGE} files.`);
        break; 
      }
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setFileError(`File "${file.name}" has an invalid type. Allowed: ${ALLOWED_FILE_TYPES.join(', ')}`);
        continue; 
      }
      if (file.size > MAX_INDIVIDUAL_FILE_SIZE) {
        setFileError(`File "${file.name}" is too large (max ${MAX_INDIVIDUAL_FILE_SIZE / (1024 * 1024)}MB).`);
        continue;
      }
      if (currentTotalSize + file.size > MAX_TOTAL_FILE_SIZE) {
        setFileError(`Total file size exceeds ${MAX_TOTAL_FILE_SIZE / (1024 * 1024)}MB limit.`);
        break; 
      }
      
      currentTotalSize += file.size;
      const previewId = `${file.name}-${Date.now()}-${Math.random()}`;

      if (file.type.startsWith('image/')) {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newPreviews.push({ id: previewId, name: file.name, type: file.type, dataUrl, fileObject: file });
      } else {
        newPreviews.push({ id: previewId, name: file.name, type: file.type, fileObject: file });
      }
    }
    setSelectedFilePreviews(newPreviews);

    if (fileInputRef.current) {
      fileInputRef.current.value = ""; 
    }
  };

  const removeSelectedFile = (previewIdToRemove: string) => {
    setSelectedFilePreviews(prev => prev.filter(fp => fp.id !== previewIdToRemove));
    setFileError(null);
  };
  
  const removeAllSelectedFiles = () => {
    setSelectedFilePreviews([]);
    setFileError(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  }

  const handleSubmitOrStop = () => {
    if (isLoading) {
      onStopGeneration();
    } else {
      if ((isChatDisabled && !isEditing) ) return;
      if (!inputValue.trim() && selectedFilePreviews.length === 0 && !isEditing) return;
      if (isEditing && !inputValue.trim()) return;

      const filesToSend = selectedFilePreviews.map(fp => fp.fileObject);
      onSendMessage(isEditing ? null : (filesToSend.length > 0 ? filesToSend : null) ); 
      
      if(!isEditing) {
          removeAllSelectedFiles();
      }
    }
  };
  
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !isLoading) { // Don't submit with Enter if loading
      event.preventDefault();
      handleSubmitOrStop();
    }
    if (event.key === 'Escape' && isEditing) {
      onCancelEdit();
    }
  };
  
  const handleTextareaInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onInputChange(event.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; 
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; 
    }
  };


  let placeholderText = "Type your message or attach files...";
  if (isListening) {
    placeholderText = `Listening in ${currentRecognitionLang === RecognitionLanguage.KM_KH ? 'Khmer' : 'English'}...`;
  } else if (isEditing) {
    placeholderText = "Editing message... (Esc to cancel)";
  } else if (isChatDisabled) {
    placeholderText = "Select or create a chat to begin, or check API status.";
  } else if (isLoading) {
    placeholderText = "AI is responding...";
  }
  
  const effectiveIsChatDisabled = isChatDisabled && !isEditing;
  const voiceControlsDisabled = isLoading || effectiveIsChatDisabled || isEditing || !isSpeechApiSupported;
  const mainButtonDisabled = 
    !isLoading && 
    (effectiveIsChatDisabled || (isEditing ? !inputValue.trim() : (!inputValue.trim() && selectedFilePreviews.length === 0)));

  return (
    <div className="bg-slate-100 dark:bg-slate-800 p-3 sm:p-4 border-t border-slate-300 dark:border-slate-700">
      {fileError && !isEditing && (
        <div className="mb-2 p-2 text-sm text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/50 rounded-md">
          {fileError}
        </div>
      )}
      {selectedFilePreviews.length > 0 && !isEditing && (
        <div className="mb-2 p-2 bg-slate-200 dark:bg-slate-700 rounded-lg max-h-40 overflow-y-auto space-y-2">
          {selectedFilePreviews.map((preview) => (
            <div key={preview.id} className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-600 rounded">
              <div className="flex items-center gap-2 overflow-hidden min-w-0">
                {preview.dataUrl ? (
                  <img src={preview.dataUrl} alt="Preview" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                ) : (
                  <FileIcon className="w-7 h-7 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                )}
                <span className="text-xs text-slate-700 dark:text-slate-200 truncate">{preview.name}</span>
              </div>
              <button 
                onClick={() => removeSelectedFile(preview.id)} 
                className="p-1 text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 flex-shrink-0"
                aria-label={`Remove ${preview.name}`}
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-stretch gap-2">
        {!isEditing && !isLoading && ( // Hide file & mic buttons when editing or loading
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={effectiveIsChatDisabled || selectedFilePreviews.length >= MAX_FILES_PER_MESSAGE}
              className="p-3 text-slate-600 dark:text-slate-300 hover:text-sky-500 dark:hover:text-sky-400 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Attach files"
            >
              <PaperClipIcon className="w-6 h-6" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept={ALLOWED_FILE_TYPES.join(',')}
              className="hidden"
              multiple
              disabled={effectiveIsChatDisabled || selectedFilePreviews.length >= MAX_FILES_PER_MESSAGE}
            />
            {isSpeechApiSupported && (
                 <div className="flex items-center self-stretch"> 
                    <button
                        onClick={onToggleListening}
                        disabled={voiceControlsDisabled}
                        className={`p-3 h-full rounded-l-lg transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isListening ? 'text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-500 animate-pulse bg-slate-200 dark:bg-slate-700' : 'text-slate-600 dark:text-slate-300 hover:text-sky-500 dark:hover:text-sky-400 bg-slate-200 dark:bg-slate-700'
                        }`}
                        aria-label={isListening ? "Stop listening" : "Start voice input"}
                    >
                        {isListening ? <StopCircleIcon className="w-6 h-6" /> : <MicrophoneIcon className="w-6 h-6" />}
                    </button>
                    <div className="flex flex-col h-full"> 
                        <button
                            onClick={() => onChangeRecognitionLang(RecognitionLanguage.EN_US)}
                            disabled={voiceControlsDisabled || isListening}
                            className={`flex-1 px-2 w-full text-xs rounded-tr-lg transition-colors focus:outline-none focus:ring-1 focus:ring-inset focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
                                currentRecognitionLang === RecognitionLanguage.EN_US ? 'bg-sky-500 text-white' : 'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-400 dark:hover:bg-slate-500'
                            }`}
                            aria-pressed={currentRecognitionLang === RecognitionLanguage.EN_US}
                        >
                            EN
                        </button>
                        <button
                            onClick={() => onChangeRecognitionLang(RecognitionLanguage.KM_KH)}
                            disabled={voiceControlsDisabled || isListening}
                            className={`flex-1 px-2 w-full text-xs rounded-br-lg transition-colors focus:outline-none focus:ring-1 focus:ring-inset focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
                                currentRecognitionLang === RecognitionLanguage.KM_KH ? 'bg-sky-500 text-white' : 'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-400 dark:hover:bg-slate-500'
                            }`}
                            aria-pressed={currentRecognitionLang === RecognitionLanguage.KM_KH}
                        >
                            KM
                        </button>
                    </div>
                 </div>
            )}
          </>
        )}
        <textarea
          ref={textareaRef}
          rows={1}
          className="flex-grow bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 p-3 rounded-lg resize-none focus:ring-2 focus:ring-sky-500 focus:outline-none placeholder-slate-500 dark:placeholder-slate-400 disabled:opacity-50"
          placeholder={placeholderText}
          value={inputValue}
          onChange={handleTextareaInput}
          onKeyDown={handleKeyDown}
          disabled={isLoading || (effectiveIsChatDisabled && !isEditing)} // Textarea is disabled when loading or if chat is generally disabled (but not if only editing)
          style={{ maxHeight: '120px', minHeight: '48px' }} 
        />
        {isEditing && !isLoading && ( // Show cancel only if editing and not loading
           <button
            onClick={onCancelEdit}
            className="p-3 bg-slate-500 text-white rounded-lg hover:bg-slate-600 dark:hover:bg-slate-400 transition-colors focus:ring-2 focus:ring-slate-400 focus:outline-none"
            aria-label="Cancel edit"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        )}
        <button
          onClick={handleSubmitOrStop}
          disabled={mainButtonDisabled && !isLoading} // Button is only truly disabled if mainButtonDisabled is true AND not loading (i.e. not in "stop" mode)
          className={`p-3 text-white rounded-lg transition-colors focus:ring-2 focus:outline-none
            ${isLoading 
              ? 'bg-red-500 hover:bg-red-600 dark:hover:bg-red-400 focus:ring-red-400' // Stop button style
              : isEditing 
                ? 'bg-green-500 hover:bg-green-600 dark:hover:bg-green-400 focus:ring-green-400 disabled:bg-slate-400 dark:disabled:bg-slate-600' // Save edit style
                : 'bg-sky-600 hover:bg-sky-500 dark:hover:bg-sky-700 focus:ring-sky-400 disabled:bg-slate-400 dark:disabled:bg-slate-600' // Send message style
            } disabled:cursor-not-allowed`}
          aria-label={isLoading ? "Stop generating" : (isEditing ? "Save edit" : "Send message")}
        >
          {isLoading ? <StopSolidIcon className="w-6 h-6" /> : (isEditing ? <CheckIcon className="w-6 h-6" /> : <SendIcon className="w-6 h-6" />)}
        </button>
      </div>
      {!isSpeechApiSupported && !isEditing && !isLoading && ( // Hide if editing or loading
         <p className="text-xs text-red-500 dark:text-red-400 mt-1 text-center">Voice input not supported by this browser.</p>
      )}
    </div>
  );
};

export default ChatInput;
