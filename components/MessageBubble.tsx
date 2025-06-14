import React, { useState, useMemo } from "react";
import { ChatMessage, Part, TextPart, InlineDataPart } from "../types";
import {
  User,
  Bot,
  Edit3,
  Save,
  X,
  Volume2,
  VolumeX,
  Copy as CopyIcon,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import IconButton from "./IconButton";
import CodeEmulator from "./CodeEmulator";
import ImagePreview from "./ImagePreview"; // <-- Add this import
import { speakText } from "../utils/tts";

interface MessageBubbleProps {
  message: ChatMessage;
  editingState: { messageId: string; currentText: string } | null;
  onStartEdit: (message: ChatMessage) => void;
  onEditInputChange: (newText: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  speakingMessageId: string | null;
  onSpeakMessage: (message: ChatMessage) => void;
  onStopSpeaking: () => void;
  isLoading: boolean; // To disable edit during other loading states
}

const isTextPart = (part: Part): part is TextPart =>
  (part as TextPart).text !== undefined;
const isInlineDataPart = (part: Part): part is InlineDataPart =>
  (part as InlineDataPart).inlineData !== undefined;

// Helper function to parse text for code blocks
type ParsedSegment =
  | { type: "text"; content: string }
  | { type: "code"; language: string; code: string };

const parseTextForCodeBlocks = (text: string): ParsedSegment[] => {
  const segments: ParsedSegment[] = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)\n```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: text.substring(lastIndex, match.index),
      });
    }
    segments.push({
      type: "code",
      language: match[1]?.toLowerCase() || "plaintext",
      code: match[2].trim(),
    });
    lastIndex = codeBlockRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.substring(lastIndex) });
  }
  return segments;
};

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  editingState,
  onStartEdit,
  onEditInputChange,
  onSaveEdit,
  onCancelEdit,
  speakingMessageId,
  onSpeakMessage,
  onStopSpeaking,
  isLoading,
}) => {
  const isUser = message.role === "user";
  const isBeingEdited = editingState?.messageId === message.id;
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    const textToCopy = message.parts
      .filter((part) => (part as any).text !== undefined)
      .map((part) => (part as any).text)
      .join("\n");
    if (navigator.clipboard && textToCopy) {
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 1500);
        })
        .catch(() => setIsCopied(false));
    }
  };

  const textContentForActions = message.parts.find(isTextPart)?.text || "";
  const imageParts = message.parts.filter(isInlineDataPart);

  // --- PDF PARTS SUPPORT ---
  const pdfParts = message.parts.filter(
    (part) =>
      isInlineDataPart(part) && part.inlineData.mimeType === "application/pdf"
  ) as InlineDataPart[];

  // Condition for the placeholder spinner
  const isModelPlaceholderLoading =
    !isUser &&
    isLoading &&
    (message.parts.length === 0 ||
      (message.parts.length === 1 &&
        isTextPart(message.parts[0]) &&
        message.parts[0].text.trim() === ""));

  const canSaveEdit =
    editingState?.currentText.trim() !== "" || imageParts.length > 0;

  const bubbleBaseClasses =
    "px-4 py-3 rounded-lg shadow-md w-full relative group ";
  const userBubbleClasses = "bg-indigo-600 text-white ";
  const modelBubbleClasses = "bg-gray-700 text-gray-100 ";
  const editingBubbleClasses = "ring-2 ring-blue-500";

  const bubbleClassName =
    bubbleBaseClasses +
    (isUser ? userBubbleClasses : modelBubbleClasses) +
    (isBeingEdited ? editingBubbleClasses : "");

  const parsedContent = useMemo(() => {
    if (isUser) return null; // Code emulator is only for model responses
    return message.parts.reduce((acc, part) => {
      if (isTextPart(part)) {
        acc.push(...parseTextForCodeBlocks(part.text));
      } else if (
        isInlineDataPart(part) &&
        part.inlineData.mimeType.startsWith("image/")
      ) {
        // Represent image parts in a way that can be iterated over with text/code
        acc.push({ type: "image", ...part } as any); // Cast for simplicity, handle in render
      }
      return acc;
    }, [] as Array<ParsedSegment | ({ type: "image" } & InlineDataPart)>);
  }, [message.parts, isUser]);

  // Example usage in your speaker button handler:
  const handleSpeak = () => {
    // Combine all text parts for this message
    const text = message.parts
      .filter((part) => (part as any).text !== undefined)
      .map((part) => (part as any).text)
      .join("\n");
    speakText(text, "km-KH");
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`flex items-start max-w-xl lg:max-w-2xl ${
          isUser ? "flex-row-reverse" : "flex-row"
        }`}
      >
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser ? "ml-2 bg-indigo-500" : "mr-2 bg-teal-500"
          }`}
        >
          {isUser ? (
            <User size={18} className="text-white" />
          ) : (
            <Bot size={18} className="text-white" />
          )}
        </div>
        <div className={bubbleClassName.trim()}>
          {/* Show loading box for bot if isLoading */}
          {!isUser && isLoading && (
            <div className="flex items-center justify-center min-h-[40px]">
              <Loader2 className="animate-spin text-gray-400 mr-2" size={20} />
              <span className="text-gray-300">Thinking...</span>
            </div>
          )}
          {/* Only render message content if not loading */}
          {(!isLoading || isUser) && (
            <>
              {isBeingEdited ? (
                <div className="space-y-2">
                  <textarea
                    value={editingState.currentText}
                    onChange={(e) => onEditInputChange(e.target.value)}
                    className="w-full p-2 bg-gray-800 text-white rounded-md focus:ring-1 focus:ring-blue-400 resize-none custom-scrollbar"
                    rows={Math.max(
                      3,
                      editingState.currentText.split("\n").length
                    )}
                    autoFocus
                  />
                  {imageParts.map((part, index) => (
                    <img
                      key={`edit-img-${index}`}
                      src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`}
                      alt="Uploaded content"
                      className="mt-1 rounded-md max-w-xs max-h-32 object-contain"
                    />
                  ))}
                  {!canSaveEdit && (
                    <p className="text-xs text-red-400 flex items-center">
                      <AlertCircle size={14} className="mr-1" />
                      Cannot save an empty message.
                    </p>
                  )}
                  <div className="flex justify-end space-x-2 mt-2">
                    <IconButton
                      icon={<X size={18} />}
                      label="Cancel Edit"
                      onClick={onCancelEdit}
                      className="bg-gray-600 hover:bg-gray-500 text-white"
                    />
                    <IconButton
                      icon={<Save size={18} />}
                      label="Save Edit"
                      onClick={onSaveEdit}
                      disabled={!canSaveEdit || isLoading}
                      className="bg-green-600 hover:bg-green-500 text-white disabled:bg-gray-500"
                    />
                  </div>
                </div>
              ) : (
                <>
                  {/* Render parsed content for AI or regular parts for user */}
                  {isUser
                    ? message.parts.map((part, index) => {
                        if (isTextPart(part)) {
                          const paragraphs = part.text
                            .split("\n")
                            .map((paragraph, i) => (
                              <React.Fragment key={i}>
                                {paragraph}
                                {i < part.text.split("\n").length - 1 && <br />}
                              </React.Fragment>
                            ));
                          const ptClass =
                            index === 0 &&
                            textContentForActions &&
                            textContentForActions.trim() !== ""
                              ? "pt-6"
                              : "";
                          return (
                            <p
                              key={`user-text-${index}`}
                              className={`whitespace-pre-wrap break-words ${ptClass}`}
                            >
                              {paragraphs}
                            </p>
                          );
                        }
                        // --- PDF PREVIEW FOR USER ---
                        if (
                          isInlineDataPart(part) &&
                          part.inlineData.mimeType === "application/pdf"
                        ) {
                          return (
                            <div key={`user-pdf-${index}`} className="mt-2">
                              <ImagePreview
                                alt={
                                  part.inlineData.name
                                    ? part.inlineData.name
                                    : "PDF file"
                                }
                                mimeType="application/pdf"
                                {...(isUser ? { onRemove: () => {} } : {})}
                              />
                            </div>
                          );
                        }
                        if (
                          isInlineDataPart(part) &&
                          part.inlineData.mimeType.startsWith("image/")
                        ) {
                          return (
                            <img
                              key={`user-img-${index}`}
                              src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`}
                              alt="Uploaded content"
                              className="mt-2 rounded-md max-w-xs max-h-64 object-contain"
                            />
                          );
                        }
                        return (
                          <p
                            key={`user-unknown-${index}`}
                            className="text-sm text-red-400"
                          >
                            [Unsupported content part]
                          </p>
                        );
                      })
                    : parsedContent?.map((segment, index) => {
                        if (segment.type === "text") {
                          const paragraphs = segment.content
                            .split("\n")
                            .map((paragraph, i) => (
                              <React.Fragment key={i}>
                                {paragraph}
                                {i < segment.content.split("\n").length - 1 && <br />}
                              </React.Fragment>
                            ));
                          return (
                            <p
                              key={`model-text-${index}`}
                              className="whitespace-pre-wrap break-words"
                            >
                              {paragraphs}
                            </p>
                          );
                        }
                        if (segment.type === "code") {
                          return (
                            <div key={`model-code-${index}`} className="my-2">
                              <CodeEmulator
                                language={segment.language}
                                code={segment.code}
                              />
                            </div>
                          );
                        }
                        if (segment.type === "image") {
                          const imgPart = segment as { type: "image" } & InlineDataPart;
                          return (
                            <img
                              key={`model-img-${index}`}
                              src={`data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`}
                              alt="Uploaded content"
                              className="mt-2 rounded-md max-w-xs max-h-64 object-contain"
                            />
                          );
                        }
                        return null;
                      })}
                </>
              )}
            </>
          )}
          <p className="text-xs mt-1 opacity-70 text-right">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>

          {/* Action buttons container */}
          {!isBeingEdited && !isModelPlaceholderLoading && (
            <div
              className={`absolute opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-0.5 p-0.5 rounded-md bg-black/10 ${
                isUser ? "top-1 left-1" : "top-1 right-1"
              }`}
            >
              {isUser && (
                <>
                  <IconButton
                    icon={<Edit3 size={14} />}
                    label="Edit message"
                    onClick={() => onStartEdit(message)}
                    className="hover:text-blue-300 text-gray-300 p-1"
                  />
                  <IconButton
                    icon={
                      isCopied ? <Check size={14} /> : <CopyIcon size={14} />
                    }
                    label={isCopied ? "Copied!" : "Copy message"}
                    onClick={handleCopy}
                    className={`${
                      isCopied
                        ? "text-green-300"
                        : "hover:text-purple-300 text-gray-300"
                    } p-1`}
                    disabled={isCopied}
                  />
                </>
              )}
              {!isUser && textContentForActions.trim() && (
                <>
                  <IconButton
                    icon={
                      speakingMessageId === message.id ? (
                        <VolumeX size={14} />
                      ) : (
                        <Volume2 size={14} />
                      )
                    }
                    label={
                      speakingMessageId === message.id
                        ? "Stop speaking"
                        : "Speak message"
                    }
                    onClick={handleSpeak}
                    className={`${
                      speakingMessageId === message.id
                        ? "text-red-300 hover:text-red-200"
                        : "hover:text-green-300 text-gray-300"
                    } p-1`}
                  />
                  <IconButton
                    icon={
                      isCopied ? <Check size={14} /> : <CopyIcon size={14} />
                    }
                    label={isCopied ? "Copied!" : "Copy message"}
                    onClick={handleCopy}
                    className={`${
                      isCopied
                        ? "text-green-300"
                        : "hover:text-purple-300 text-gray-300"
                    } p-1`}
                    disabled={isCopied}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
