import React, { useRef, useEffect } from "react";
import { ChatMessage, TextPart, InlineDataPart } from "../types";
import MessageBubble from "./MessageBubble";
import ImagePreview from "./ImagePreview";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

import {
  Send,
  Paperclip,
  Mic,
  Loader2,
  ImageOff,
  Menu,
  FileText,
} from "lucide-react"; // Add this import for PDF icon

interface ChatInterfaceProps {
  messages: ChatMessage[];
  inputText: string;
  setInputText: (text: string) => void;
  inputImages: { data: string; mimeType: string; name: string }[];
  removeInputImage: (index: number) => void;
  onSendMessage: () => void;
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
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
  inputImages,
  removeInputImage,
  onSendMessage,
  onImageUpload,
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

  const {
    isSupported: micSupported,
    isRecording: isMicRecording,
    start,
    stop,
  } = useSpeechRecognition(
    (transcript) => {
      setInputText(inputText + (inputText ? " " : "") + transcript);
    },
    "km-KH" // Khmer language code
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = () => {
    if (
      isLoading ||
      (!inputText.trim() && inputImages.length === 0) ||
      editingState
    )
      return;
    onSendMessage();
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !editingState) {
      event.preventDefault();
      handleSend();
    }
  };

  const toggleRecordingHandler = () => {
    if (isMicRecording) stop();
    else start();
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-gray-800">
      {" "}
      {/* <-- changed h-full to h-screen and added max-h-screen */}
      <header className="p-4 bg-gray-900 shadow-md flex items-center">
        <button
          onClick={toggleSidebar}
          className="mr-4 text-gray-400 hover:text-white md:hidden"
        >
          <Menu size={24} />
        </button>
        <h2 className="text-xl font-semibold text-gray-100">KH-AI V2</h2>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((msg, idx) => {
          // Find the index of the last completed bot message (has content)
          const lastCompletedBotIdx = [...messages]
            .reverse()
            .findIndex(
              (m) =>
                m.role === "model" &&
                m.parts &&
                m.parts.length > 0 &&
                m.parts.some(
                  (p) => (p as any).text && (p as any).text.trim() !== ""
                )
            );
          const lastCompletedBotMessageIndex =
            lastCompletedBotIdx === -1
              ? -1
              : messages.length - 1 - lastCompletedBotIdx;

          // Show loading for all bot messages after the last completed one, including the current loading one
          const showLoading =
            msg.role === "model" &&
            // If isLoading, show spinner for all bot messages after last completed
            ((isLoading && idx > lastCompletedBotMessageIndex) ||
              // Or, if this bot message has no content yet (pending)
              msg.parts.length === 0 ||
              msg.parts.every(
                (p) => !(p as any).text || (p as any).text.trim() === ""
              ));

          return (
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
              isLoading={showLoading}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      {inputImages.length > 0 && !editingState && (
        <div className="p-2 border-t border-gray-700 bg-gray-800">
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {inputImages.map((img, index) => (
              <ImagePreview
                key={index}
                src={
                  img.mimeType === "application/pdf"
                    ? undefined
                    : `data:${img.mimeType};base64,${img.data}`
                }
                alt={img.name}
                onRemove={() => removeInputImage(index)}
                mimeType={img.mimeType}
              />
            ))}
          </div>
        </div>
      )}
      {!editingState && (
        <div className="p-4 border-t border-gray-700 bg-gray-800">
          <div className="flex items-end space-x-2 bg-gray-700 rounded-lg p-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-400 hover:text-indigo-400 transition-colors"
              aria-label="Upload file"
              disabled={isLoading}
            >
              <Paperclip size={22} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*,application/pdf" // Allow PDF files
              onChange={onImageUpload}
              className="hidden"
            />
            <textarea
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message or ask a question..."
              className="flex-1 p-2 bg-transparent text-gray-100 placeholder-gray-500 focus:outline-none resize-none max-h-32 custom-scrollbar"
            />
            <button
              onClick={toggleRecordingHandler}
              disabled={!micSupported}
              className={`p-2 ${
                isMicRecording ? "text-red-500" : "text-gray-400"
              } transition-colors`}
              aria-label={isMicRecording ? "Stop recording" : "Start recording"}
            >
              <Mic size={22} />
            </button>
            {!micSupported && (
              <span className="text-xs text-red-400 ml-2">
                Microphone not supported in this browser.
              </span>
            )}
            <button
              onClick={handleSend}
              disabled={
                isLoading || (!inputText.trim() && inputImages.length === 0)
              }
              className="p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={22} />
              ) : (
                <Send size={22} />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
