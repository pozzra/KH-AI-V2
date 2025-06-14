import React, { useRef, useEffect } from 'react';
import { ChatMessage } from '../types'; // Assuming ChatMessage doesn't need direct changes here
import MessageBubble from './MessageBubble';
// import ImagePreview from './ImagePreview'; // Remove this line
import AttachmentPreview from './AttachmentPreview'; // Import the new component
import { Send, Paperclip, Mic, Loader2, Menu } from 'lucide-react'; // Using lucide-react

// Update prop names to be more general
interface ChatInterfaceProps {
  messages: ChatMessage[];
  inputText: string;
  setInputText: (text: string) => void;
  // Use inputFiles instead of inputImages
  inputFiles: { data: string; mimeType: string; name: string }[];
  // Use removeInputFile instead of removeInputImage
  removeInputFile: (index: number) => void;
  onSendMessage: () => void;
  // Use onFileUpload instead of onImageUpload
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isLoading: boolean;
  isRecording: boolean;
  toggleRecording: () => void;
  toggleSidebar: () => void;
  sidebarOpen: boolean;
  // Edit props
  editingState: { messageId: string; currentText: string } | null;
  onStartEdit: (message: ChatMessage) => void;
  onEditInputChange: (newText: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  // TTS props
  speakingMessageId: string | null;
  onSpeakMessage: (message: ChatMessage) => void;
  onStopSpeaking: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  inputText,
  setInputText,
  // Use inputFiles
  inputFiles,
  // Use removeInputFile
  removeInputFile,
  onSendMessage,
  // Use onFileUpload
  onFileUpload,
  isLoading,
  isRecording,
  toggleRecording,
  toggleSidebar,
  sidebarOpen,
  // Edit props
  editingState,
  onStartEdit,
  onEditInputChange,
  onSaveEdit,
  onCancelEdit,
  // TTS props
  speakingMessageId,
  onSpeakMessage,
  onStopSpeaking,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = () => {
    // Check against inputFiles length
    if (isLoading || (!inputText.trim() && inputFiles.length === 0) || editingState) return;
    onSendMessage();
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !editingState) {
      event.preventDefault();
      handleSend();
    }
  };

  // Function to trigger file input click
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };


  return (
    <div className="flex flex-col h-full bg-gray-800">
      <header className="p-4 bg-gray-900 shadow-md flex items-center">
        <button onClick={toggleSidebar} className="mr-4 text-gray-400 hover:text-white md:hidden">
          <Menu size={24} />
        </button>
        <h2 className="text-xl font-semibold text-gray-100">KH-AI V2</h2>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            // Edit props
            editingState={editingState}
            onStartEdit={onStartEdit}
            onEditInputChange={onEditInputChange}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
            // TTS & Copy props
            speakingMessageId={speakingMessageId}
            onSpeakMessage={onSpeakMessage}
            onStopSpeaking={onStopSpeaking}
            isLoading={isLoading} // Pass isLoading if MessageBubble uses it
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Check against inputFiles length */}
      {inputFiles.length > 0 && !editingState && (
        <div className="p-2 border-t border-gray-700 bg-gray-800">
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {/* Map over inputFiles and use AttachmentPreview */}
            {inputFiles.map((file, index) => (
              <AttachmentPreview
                key={index}
                file={file} // Pass the file object
                onRemove={() => removeInputFile(index)} // Use removeInputFile
              />
            ))}
          </div>
        </div>
      )}

      {!editingState && (
        <div className="p-4 border-t border-gray-700 bg-gray-800">
          <div className="flex items-end space-x-2 bg-gray-700 rounded-lg p-2">
            <button
              onClick={triggerFileInput} // Use the new trigger function
              className="p-2 text-gray-400 hover:text-indigo-400 transition-colors"
              // Update aria-label
              aria-label="Upload files (images, PDF)"
              disabled={isLoading}
            >
              <Paperclip size={22} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              // Update accept attribute to include PDF
              accept="image/*,application/pdf"
              onChange={onFileUpload} // Use onFileUpload
              className="hidden"
              disabled={isLoading}
            />
            <textarea
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message or ask a question..."
              className="flex-1 p-2 bg-transparent text-gray-100 placeholder-gray-500 focus:outline-none resize-none max-h-32 custom-scrollbar"
              disabled={isLoading}
            />
            <button
              onClick={toggleRecording}
              className={`p-2 transition-colors ${isRecording ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-indigo-400'}`}
              aria-label={isRecording ? "Stop recording" : "Start recording"}
              disabled={isLoading}
            >
              <Mic size={22} />
            </button>
            <button
              onClick={handleSend}
              // Check against inputFiles length
              disabled={isLoading || (!inputText.trim() && inputFiles.length === 0)}
              className="p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              {isLoading ? <Loader2 className="animate-spin" size={22} /> : <Send size={22} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;