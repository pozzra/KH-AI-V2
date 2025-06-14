// Description: Main application component for the AI chat interface, handling chat sessions, messages, and speech recognition.
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ChatSession,
  ChatMessage,
  Part,
  TextPart,
  InlineDataPart,
  SpeechRecognition,
  SpeechRecognitionEvent,
  SpeechRecognitionErrorEvent,
} from "./types";
import Sidebar from "./components/Sidebar";
import ChatInterface from "./components/ChatInterface";
import { GeminiService } from "./services/geminiService";
import { v4 as uuidv4 } from "uuid";
import {
  AlertTriangle,
  Info,
  Loader2,
  Edit3,
  Save,
  X,
  Volume2,
  VolumeX,
  Copy as CopyIcon,
  Check,
  Play,
  Eye,
  EyeOff,
} from "lucide-react";

const LOCAL_STORAGE_KEYS = {
  CHAT_HISTORY: "chatHistory",
  ACTIVE_SESSION_ID: "activeChatSessionId",
  SIDEBAR_OPEN_STATE: "sidebarOpenState",
};

const isTextPart = (part: Part): part is TextPart =>
  (part as TextPart).text !== undefined;

const App: React.FC = () => {
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [inputImages, setInputImages] = useState<
    { data: string; mimeType: string; name: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  // Initialize sidebarOpen state from localStorage or based on screen size
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [editingState, setEditingState] = useState<{
    messageId: string;
    currentText: string;
  } | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(
    null
  );

  const [speechBaselineText, setSpeechBaselineText] = useState<string>("");
  const speechBaselineTextRef = useRef<string>("");

  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([]);

  const geminiService = useRef<GeminiService | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    let apiKey: string | undefined = undefined;

    // Try to get API key from Vite's import.meta.env
    console.log("Attempting to load API key...");
    if (
      typeof import.meta !== "undefined" &&
      typeof import.meta.env !== "undefined"
    ) {
      console.log("import.meta.env is available. Checking for VITE_API_KEY...");
      const viteSpecificApiKey = (import.meta.env as any).VITE_API_KEY;
      if (typeof viteSpecificApiKey === "string") {
        console.log(
          "Found VITE_API_KEY in import.meta.env:",
          viteSpecificApiKey ? "Exists" : "Empty String"
        );
        apiKey = viteSpecificApiKey;
      } else {
        console.log(
          "VITE_API_KEY not found or not a string in import.meta.env. Checking for generic API_KEY in import.meta.env..."
        );
        // Fallback to API_KEY from import.meta.env only if VITE_API_KEY is not defined.
        // Note: Accessing non-VITE_ prefixed vars from import.meta.env is non-standard for Vite
        // for user-defined .env variables unless envPrefix is customized. Use type assertion.
        const genericMetaApiKey = (import.meta.env as any).API_KEY;
        if (typeof genericMetaApiKey === "string") {
          console.log(
            "Found generic API_KEY in import.meta.env:",
            genericMetaApiKey ? "Exists" : "Empty String"
          );
          apiKey = genericMetaApiKey;
        } else {
          console.log(
            "Generic API_KEY not found or not a string in import.meta.env."
          );
        }
      }
    } else {
      console.log("import.meta.env is not available.");
    }

    // Fallback for Create React App or Node.js-like environments (less likely for client-side)
    if (!apiKey && typeof process !== "undefined" && process.env) {
      console.log(
        "API key not found yet. Checking process.env for REACT_APP_API_KEY..."
      );
      apiKey = process.env.REACT_APP_API_KEY;
      if (apiKey)
        console.log(
          "Found REACT_APP_API_KEY in process.env:",
          apiKey ? "Exists" : "Empty String"
        );
    }
    if (!apiKey && typeof process !== "undefined" && process.env) {
      // General fallback
      console.log(
        "API key not found yet. Checking process.env for generic API_KEY..."
      );
      apiKey = process.env.API_KEY;
      if (apiKey)
        console.log(
          "Found generic API_KEY in process.env:",
          apiKey ? "Exists" : "Empty String"
        );
    }

    if (!apiKey) {
      setApiKeyError(
        "API_KEY environment variable not accessible or not set. Please configure it to use the AI features."
      );
      console.error("API_KEY environment variable not accessible or not set.");
    } else {
      try {
        geminiService.current = new GeminiService(apiKey);
        setApiKeyError(null);
      } catch (error) {
        console.error("Error initializing GeminiService:", error);
        setApiKeyError(
          error instanceof Error
            ? error.message
            : "Failed to initialize AI Service."
        );
      }
    }
  }, []);

  // Effect for initializing chat state from localStorage or creating a new session
  useEffect(() => {
    if (typeof window === "undefined") return; // Guard against non-browser environments
    // Removed: if (apiKeyError) return; // History loading should not depend on API key status

    let loadedHistory: ChatSession[] = [];
    let storedActiveSessionId: string | null = null;

    try {
      const storedHistoryJson = localStorage.getItem(
        LOCAL_STORAGE_KEYS.CHAT_HISTORY
      );
      if (storedHistoryJson) {
        const parsedHistory: ChatSession[] = JSON.parse(storedHistoryJson);
        // Ensure it's an array and sort by timestamp descending to get the latest first
        if (Array.isArray(parsedHistory)) {
          loadedHistory = parsedHistory.sort(
            (a, b) => b.timestamp - a.timestamp
          );
        }
      }
    } catch (error) {
      console.error(
        "Failed to load or parse chat history from localStorage:",
        error
      );
      localStorage.removeItem(LOCAL_STORAGE_KEYS.CHAT_HISTORY); // Clear corrupted data
    }

    try {
      const activeId = localStorage.getItem(
        LOCAL_STORAGE_KEYS.ACTIVE_SESSION_ID
      );
      if (activeId) {
        storedActiveSessionId = activeId;
      }
    } catch (error) {
      console.error(
        "Failed to load active session ID from localStorage:",
        error
      );
      localStorage.removeItem(LOCAL_STORAGE_KEYS.ACTIVE_SESSION_ID); // Clear corrupted data
    }

    if (loadedHistory.length > 0) {
      setChatHistory(loadedHistory);
      const sessionExists = loadedHistory.some(
        (session) => session.id === storedActiveSessionId
      );
      if (storedActiveSessionId && sessionExists) {
        setActiveSessionId(storedActiveSessionId);
      } else {
        // Default to the most recent session (first in the sorted list)
        setActiveSessionId(loadedHistory[0].id);
      }
    } else {
      // No valid history found, or history is empty. Create a new session.
      const newSessionId = uuidv4();
      const newSession: ChatSession = {
        id: newSessionId,
        title: "New Chat",
        messages: [],
        timestamp: Date.now(),
      };
      setChatHistory([newSession]);
      setActiveSessionId(newSessionId);
      // No need to save to localStorage here, the other useEffects will handle it.
    }
  }, []); // Runs once on mount to load initial history

  useEffect(() => {
    if (activeSessionId) {
      const activeSession = chatHistory.find(
        (session) => session.id === activeSessionId
      );
      setCurrentMessages(activeSession ? activeSession.messages : []);
    } else {
      setCurrentMessages([]);
    }
    setEditingState(null);
  }, [activeSessionId, chatHistory]);

  // Effect to save sidebarOpen state to localStorage
  useEffect(() => {
    // Sidebar state persistence is independent of the API key status
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          LOCAL_STORAGE_KEYS.SIDEBAR_OPEN_STATE,
          JSON.stringify(sidebarOpen)
        );
      } catch (error) {
        console.error("Failed to save sidebar state to localStorage:", error);
      }
    }
  }, [sidebarOpen]);

  // Re-evaluating the dependencies for saving effects:
  // The primary trigger for saving chatHistory is when chatHistory itself changes.
  // The primary trigger for saving activeSessionId is when activeSessionId itself changes.
  // The apiKeyError state should not prevent these save operations if we want history to persist
  // even when the API key is temporarily invalid.

  // Corrected effect to save chatHistory to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (chatHistory.length > 0) {
        try {
          localStorage.setItem(
            LOCAL_STORAGE_KEYS.CHAT_HISTORY,
            JSON.stringify(chatHistory)
          );
        } catch (error) {
          console.error("Failed to save chat history to localStorage:", error);
        }
      } else {
        // If chatHistory becomes empty, clear it from localStorage
        localStorage.removeItem(LOCAL_STORAGE_KEYS.CHAT_HISTORY);
        localStorage.removeItem(LOCAL_STORAGE_KEYS.ACTIVE_SESSION_ID); // Also clear active session
      }
    }
  }, [chatHistory]); // Depends only on chatHistory

  // Corrected effect to save activeSessionId to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (activeSessionId) {
        try {
          localStorage.setItem(
            LOCAL_STORAGE_KEYS.ACTIVE_SESSION_ID,
            activeSessionId
          );
        } catch (error) {
          console.error(
            "Failed to save active session ID to localStorage:",
            error
          );
        }
      } else {
        // If activeSessionId becomes null, remove it
        localStorage.removeItem(LOCAL_STORAGE_KEYS.ACTIVE_SESSION_ID);
      }
    }
  }, [activeSessionId]); // Depends only on activeSessionId

  const handleNewChat = useCallback((): string => {
    const newSessionId = uuidv4();
    const newSession: ChatSession = {
      id: newSessionId,
      title: "New Chat",
      messages: [],
      timestamp: Date.now(),
    };
    setChatHistory((prev) =>
      [newSession, ...prev].sort((a, b) => b.timestamp - a.timestamp)
    );
    setActiveSessionId(newSessionId);
    setEditingState(null);
    return newSessionId;
  }, []);

  const updateChatSession = useCallback(
    (sessionId: string, newMessages: ChatMessage[], newTitle?: string) => {
      setChatHistory((prevHistory) => {
        const now = Date.now();
        let updated = false;
        const newHistory = prevHistory.map((session) => {
          if (session.id === sessionId) {
            updated = true;
            return {
              ...session,
              messages: [...newMessages], // always new array
              title: newTitle || session.title,
              timestamp: now,
            };
          }
          return session;
        });
        // If session not found (shouldn't happen), add it
        if (!updated) {
          newHistory.push({
            id: sessionId,
            messages: [...newMessages],
            title: newTitle || "New Chat",
            timestamp: now,
          });
        }
        return newHistory.sort((a, b) => b.timestamp - a.timestamp);
      });
    },
    []
  );

  const processAndSendMessages = useCallback(
    async (
      sessionId: string,
      messagesLeadingToThisTurn: ChatMessage[], // This array includes the latest user message
      titleToUpdate?: string
    ) => {
      if (!geminiService.current || apiKeyError) {
        setIsLoading(true);
        const errorMsgContent =
          apiKeyError ||
          "AI Service is not available. Please check API key configuration.";
        const errorUiMessage: ChatMessage = {
          id: uuidv4(),
          role: "model",
          parts: [{ text: errorMsgContent }],
          timestamp: Date.now(),
          files: false,
        };
        const finalMessages = [...messagesLeadingToThisTurn, errorUiMessage];
        setCurrentMessages(finalMessages);
        updateChatSession(sessionId, finalMessages, titleToUpdate);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const stream = await geminiService.current.generateChatResponseStream(
          sessionId,
          messagesLeadingToThisTurn
        );

        let modelResponseText = "";
        const modelMessageId = uuidv4();
        const modelMessageBase: Omit<ChatMessage, "parts" | "timestamp"> = {
          id: modelMessageId,
          role: "model",
          files: false,
        };

        const placeholderUiMessage: ChatMessage = {
          ...modelMessageBase,
          parts: [{ text: "" }],
          timestamp: Date.now(),
        };
        setCurrentMessages([
          ...messagesLeadingToThisTurn,
          placeholderUiMessage,
        ]);
        updateChatSession(
          sessionId,
          [...messagesLeadingToThisTurn, placeholderUiMessage],
          titleToUpdate
        );

        for await (const chunk of stream) {
          modelResponseText += chunk.text;
          const streamingUiMessage: ChatMessage = {
            ...modelMessageBase,
            parts: [{ text: modelResponseText }],
            timestamp: Date.now(),
          };

          setCurrentMessages([
            ...messagesLeadingToThisTurn,
            streamingUiMessage,
          ]);
          updateChatSession(
            sessionId,
            [...messagesLeadingToThisTurn, streamingUiMessage],
            titleToUpdate
          );
        }

        const finalUiMessage: ChatMessage = {
          ...modelMessageBase,
          parts: [{ text: modelResponseText }],
          timestamp: Date.now(),
        };
        setCurrentMessages([...messagesLeadingToThisTurn, finalUiMessage]);
        updateChatSession(
          sessionId,
          [...messagesLeadingToThisTurn, finalUiMessage],
          titleToUpdate
        );
      } catch (error) {
        console.error("Error sending message to Gemini:", error);
        let errorText = "An unknown error occurred.";
        if (error instanceof Error) {
          errorText = error.message;
          // Check for Gemini API overload
          if (
            errorText.includes("503") ||
            errorText.includes("overloaded") ||
            errorText.includes("UNAVAILABLE")
          ) {
            errorText =
              "The AI model is currently overloaded. Please try again in a few moments.";
          }
        }
        const errorUiMessage: ChatMessage = {
          id: uuidv4(),
          role: "model",
          parts: [{ text: `Error: ${errorText}` }],
          timestamp: Date.now(),
          files: false,
        };
        setCurrentMessages([...messagesLeadingToThisTurn, errorUiMessage]);
        updateChatSession(
          sessionId,
          [...messagesLeadingToThisTurn, errorUiMessage],
          titleToUpdate
        );
      } finally {
        setIsLoading(false);
      }
    },
    [apiKeyError, updateChatSession]
  );

  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim() && inputImages.length === 0) return;

    let currentActiveSessionId = activeSessionId;
    if (!currentActiveSessionId) {
      currentActiveSessionId = handleNewChat();
    }

    if (!currentActiveSessionId) {
      alert(
        "Failed to establish an active chat session. Please try refreshing or creating a new chat."
      );
      return;
    }

    const userParts: Part[] = [];
    if (inputText.trim()) {
      userParts.push({ text: inputText.trim() });
    }
    inputImages.forEach((img) => {
      userParts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data,
          name: "",
        },
      });
    });

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: "user",
      parts: userParts,
      timestamp: Date.now(),
      files: false,
    };

    const messagesIncludingUser = [...currentMessages, userMessage];

    let sessionTitleToUpdate: string | undefined;
    const currentSessionForTitle = chatHistory.find(
      (s) => s.id === currentActiveSessionId
    );
    sessionTitleToUpdate = currentSessionForTitle?.title;

    if (
      currentSessionForTitle &&
      currentSessionForTitle.messages.length === 0 &&
      inputText.trim()
    ) {
      sessionTitleToUpdate =
        inputText.trim().substring(0, 30) +
        (inputText.trim().length > 30 ? "..." : "");
    }

    setCurrentMessages(messagesIncludingUser);
    updateChatSession(
      currentActiveSessionId,
      messagesIncludingUser,
      sessionTitleToUpdate
    );

    setInputText("");
    setInputImages([]);

    await processAndSendMessages(
      currentActiveSessionId,
      messagesIncludingUser,
      sessionTitleToUpdate
    );
  }, [
    inputText,
    inputImages,
    activeSessionId,
    updateChatSession,
    chatHistory,
    currentMessages,
    handleNewChat,
    processAndSendMessages,
  ]);

  const handleStartEdit = useCallback((message: ChatMessage) => {
    const textToEdit = message.parts.find(isTextPart)?.text || "";
    setEditingState({ messageId: message.id, currentText: textToEdit });
  }, []);

  const handleEditInputChange = useCallback((newText: string) => {
    setEditingState((prev) =>
      prev ? { ...prev, currentText: newText } : null
    );
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingState || !activeSessionId) return;
    const { messageId, currentText } = editingState;

    const activeChatSession = chatHistory.find((s) => s.id === activeSessionId);
    if (!activeChatSession) return;

    const messageIndex = activeChatSession.messages.findIndex(
      (msg) => msg.id === messageId
    );
    if (messageIndex === -1) return;

    const originalMessage = activeChatSession.messages[messageIndex];

    const existingImageParts = originalMessage.parts.filter(
      (part) => !isTextPart(part)
    );
    if (!currentText.trim() && existingImageParts.length === 0) {
      alert("Cannot save an empty message.");
      return;
    }

    const updatedTextPart: TextPart = { text: currentText.trim() };
    const updatedMessage: ChatMessage = {
      ...originalMessage,
      parts: currentText.trim()
        ? [updatedTextPart, ...existingImageParts]
        : existingImageParts,
      timestamp: Date.now(),
    };

    const messagesForResubmission = activeChatSession.messages
      .slice(0, messageIndex)
      .concat(updatedMessage);

    let sessionTitleToUpdate = activeChatSession.title;
    if (messageIndex === 0 && currentText.trim()) {
      sessionTitleToUpdate =
        currentText.trim().substring(0, 30) +
        (currentText.trim().length > 30 ? "..." : "");
    }

    setCurrentMessages(messagesForResubmission);
    updateChatSession(
      activeSessionId,
      messagesForResubmission,
      sessionTitleToUpdate
    );
    setEditingState(null);

    await processAndSendMessages(
      activeSessionId,
      messagesForResubmission,
      sessionTitleToUpdate
    );
  }, [
    editingState,
    activeSessionId,
    chatHistory,
    updateChatSession,
    processAndSendMessages,
  ]);

  const handleCancelEdit = useCallback(() => {
    setEditingState(null);
  }, []);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files);
      const newImagesPromises = files.map((file) => {
        return new Promise<{ data: string; mimeType: string; name: string }>(
          (resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                data: (reader.result as string).split(",")[1],
                mimeType: file.type,
                name: file.name,
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          }
        );
      });

      Promise.all(newImagesPromises)
        .then((newImagesData) => {
          setInputImages((prevInputImages) => {
            const combinedImages = [...prevInputImages, ...newImagesData];
            if (combinedImages.length > 5) {
              const numCanAdd = Math.max(0, 5 - prevInputImages.length);
              const numAttempted = newImagesData.length;
              console.warn(
                `Maximum 5 images allowed. You had ${prevInputImages.length}, selected ${numAttempted}. Added ${numCanAdd} new image(s).`
              );
            }
            return combinedImages.slice(0, 5);
          });
        })
        .catch((error) => console.error("Error reading images:", error));

      event.target.value = "";
    }
  };

  const removeInputImage = (index: number) => {
    setInputImages((prev) => prev.filter((_, i) => i !== index));
  };

  const initializeSpeechRecognition = useCallback(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      console.error("Speech Recognition API not supported in this browser.");
      alert(
        "Speech recognition is not available or not supported by your browser."
      );
      return null;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "km-KH";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let combinedFinalizedFromEvent = "";
      let latestInterimFromEvent = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptSegment = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          const space =
            combinedFinalizedFromEvent.length > 0 &&
            !combinedFinalizedFromEvent.endsWith(" ") &&
            transcriptSegment.length > 0 &&
            !transcriptSegment.startsWith(" ")
              ? " "
              : "";
          combinedFinalizedFromEvent += space + transcriptSegment;
        } else {
          latestInterimFromEvent = transcriptSegment;
        }
      }

      if (combinedFinalizedFromEvent) {
        const spaceBeforeAppending =
          speechBaselineTextRef.current.length > 0 &&
          !speechBaselineTextRef.current.endsWith(" ") &&
          combinedFinalizedFromEvent.length > 0 &&
          !combinedFinalizedFromEvent.startsWith(" ")
            ? " "
            : "";
        speechBaselineTextRef.current +=
          spaceBeforeAppending + combinedFinalizedFromEvent;
        setSpeechBaselineText(speechBaselineTextRef.current);
      }

      let displayText = speechBaselineTextRef.current;
      if (latestInterimFromEvent) {
        const spaceForInterim =
          displayText.length > 0 &&
          !displayText.endsWith(" ") &&
          latestInterimFromEvent.length > 0 &&
          !latestInterimFromEvent.startsWith(" ")
            ? " "
            : "";
        displayText += spaceForInterim + latestInterimFromEvent;
      }
      setInputText(displayText);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error", event.error, event.message);
      setIsRecording(false);
      let userMessage = `Speech recognition error: ${event.error}.`;
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        userMessage =
          "Microphone access denied. Please allow microphone permission in your browser settings.";
      } else if (event.error === "no-speech") {
        userMessage = "No speech was detected. Please try again.";
      } else if (event.error === "audio-capture") {
        userMessage =
          "Microphone not found or not working. Please check your microphone.";
      }
      alert(userMessage + (event.message ? ` (${event.message})` : ""));
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInputText(speechBaselineTextRef.current);
    };
    return recognition;
  }, []);

  useEffect(() => {
    if (!speechRecognitionRef.current) {
      speechRecognitionRef.current = initializeSpeechRecognition();
    }
    return () => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.abort();
        speechRecognitionRef.current = null;
      }
    };
  }, [initializeSpeechRecognition]);

  const toggleRecording = () => {
    if (!speechRecognitionRef.current) {
      speechRecognitionRef.current = initializeSpeechRecognition();
      if (!speechRecognitionRef.current) {
        return;
      }
    }

    if (isRecording) {
      speechRecognitionRef.current?.stop();
    } else {
      setSpeechBaselineText(inputText);
      speechBaselineTextRef.current = inputText;
      try {
        speechRecognitionRef.current?.start();
        setIsRecording(true);
      } catch (e) {
        console.error("Error starting speech recognition:", e);
        setIsRecording(false);
        setSpeechBaselineText("");
        speechBaselineTextRef.current = "";
        alert(
          "Could not start recording. Please check microphone permissions and ensure it's not already in use."
        );
      }
    }
  };

  useEffect(() => {
    if ("speechSynthesis" in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  const handleSpeakMessage = useCallback(
    (message: ChatMessage) => {
      if (!("speechSynthesis" in window)) {
        alert("Text-to-speech is not supported in your browser.");
        return;
      }

      if (window.speechSynthesis.speaking && speakingMessageId === message.id) {
        window.speechSynthesis.cancel();
        setSpeakingMessageId(null);
        return;
      }

      window.speechSynthesis.cancel();

      const textToSpeak = message.parts
        .filter(isTextPart)
        .map((p) => p.text)
        .join(" ");
      if (!textToSpeak.trim()) return;

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = "km-KH";

      const khmerVoices = availableVoices.filter(
        (voice) => voice.lang === "km-KH" || voice.lang.startsWith("km-")
      );
      if (khmerVoices.length > 0) {
        utterance.voice = khmerVoices[0];
        console.log(
          `Using Khmer voice: ${khmerVoices[0].name} (${khmerVoices[0].lang})`
        );
      } else {
        console.warn(
          "No specific Khmer (km-KH) voice found. Using browser default for km-KH or fallback."
        );
      }

      utterance.onstart = () => setSpeakingMessageId(message.id);
      utterance.onend = () => setSpeakingMessageId(null);
      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        console.error("SpeechSynthesisUtterance.onerror event:", event);
        setSpeakingMessageId(null);

        let detail = "Unknown error";
        if (event && event.error) {
          if (typeof event.error === "string") {
            detail = `Error code: ${event.error}`;
          } else {
            try {
              detail = `Error details: ${JSON.stringify(event.error)}`;
            } catch (e) {
              detail = `Error: ${String(event.error)}`;
            }
          }
        }
        alert(`Could not speak the message. ${detail}`);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [speakingMessageId, availableVoices]
  );

  const handleStopSpeaking = useCallback(() => {
    if ("speechSynthesis" in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);
  }, []);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

const handleSelectSession = (sessionId: string) => {
  setActiveSessionId(sessionId);
  if (window.innerWidth < 768) {
    setSidebarOpen(false);
  }
};

  const deleteSession = (sessionId: string) => {
    setChatHistory((prev) => {
      const filteredHistory = prev.filter(
        (session) => session.id !== sessionId
      );
      const sortedHistory = [...filteredHistory].sort(
        (a, b) => b.timestamp - a.timestamp
      );

      if (activeSessionId === sessionId) {
        if (sortedHistory.length > 0) {
          setActiveSessionId(sortedHistory[0].id);
        } else {
          setActiveSessionId(null);
        }
      }
      return sortedHistory;
    });

    if (geminiService.current) {
      geminiService.current.deleteChatInstance(sessionId);
    }
    if (speakingMessageId) handleStopSpeaking();
  };

  const deleteAllHistory = () => {
    setChatHistory([]);
    setActiveSessionId(null);
    if (geminiService.current) {
      geminiService.current.clearAllChatInstances();
    }
    if (speakingMessageId) handleStopSpeaking();
  };

  const toggleSidebar = () => setSidebarOpen((open) => !open);

  if (apiKeyError && !geminiService.current) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-red-400 p-8">
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-center">
          <AlertTriangle size={48} className="mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold mb-2">Configuration Error</h1>
          <p>{apiKeyError}</p>
          <p className="mt-4 text-sm text-gray-400">
            Please ensure the API_KEY is correctly set up in your execution
            environment and refresh the application.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-800">
      <Sidebar
        history={chatHistory}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={deleteSession}
        onDeleteAllHistory={deleteAllHistory}
        isOpen={sidebarOpen}
        toggleSidebar={toggleSidebar}
        setSidebarOpen={setSidebarOpen}
      />
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
          sidebarOpen && window.innerWidth >= 768 ? "ml-64" : "ml-0"
        }`}
      >
        {activeSessionId &&
        chatHistory.find((s) => s.id === activeSessionId) ? (
          <ChatInterface
            messages={currentMessages}
            inputText={inputText}
            setInputText={setInputText}
            inputImages={inputImages}
            removeInputImage={removeInputImage}
            onSendMessage={handleSendMessage}
            onImageUpload={handleImageUpload}
            isLoading={isLoading}
            isRecording={isRecording}
            toggleRecording={toggleRecording}
            toggleSidebar={toggleSidebar}
            sidebarOpen={sidebarOpen}
            editingState={editingState}
            onStartEdit={handleStartEdit}
            onEditInputChange={handleEditInputChange}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
            speakingMessageId={speakingMessageId}
            onSpeakMessage={handleSpeakMessage}
            onStopSpeaking={handleStopSpeaking}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-4">
            {chatHistory.length === 0 && !apiKeyError ? (
              <Loader2 className="animate-spin text-indigo-400" size={48} />
            ) : (
              <>
                <Info size={48} className="mb-4" />
                <p className="text-xl">Select a chat or start a new one.</p>
                {!apiKeyError && (
                  <button
                    onClick={handleNewChat}
                    className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow transition-colors"
                  >
                    Start New Chat
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
