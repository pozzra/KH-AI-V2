
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import { ChatMessage, Sender, ChatHistoryItem, Theme, FilePart, RecognitionLanguage } from './types';
import ChatMessageItem from './components/ChatMessageItem';
import ChatInput, { FilePreview } from './components/ChatInput'; // Import FilePreview
import Sidebar from './components/Sidebar';
import { MenuIcon } from './components/IconComponents';
import { RunCodeModal } from './components/RunCodeModal'; // Import RunCodeModal as named import
import {
  loadChatHistories,
  saveChatHistories,
  loadActiveChatId,
  saveActiveChatId,
  convertToGeminiHistory,
  generateChatTitle,
  loadTheme,
  saveTheme,
  applyTheme,
  fileToBase64,
  MAX_INDIVIDUAL_FILE_SIZE,
  MAX_TOTAL_FILE_SIZE,
  MAX_FILES_PER_MESSAGE,
  ALLOWED_FILE_TYPES
} from './utils';

// Extend Window interface for SpeechRecognition & SpeechSynthesis
declare global {
  // Supporting types for SpeechRecognition
  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }

  interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionEvent extends Event {
    readonly results: SpeechRecognitionResultList;
    readonly resultIndex: number;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message?: string;
  }

  interface SpeechRecognition extends EventTarget {
    grammars: any;
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    serviceURI?: string;

    start(): void;
    stop(): void;
    abort(): void;

    onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
    onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  }

  interface SpeechRecognitionStatic {
    new(): SpeechRecognition;
  }

  // Types for SpeechSynthesis
  interface SpeechSynthesisUtterance extends EventTarget {
    text: string;
    lang: string;
    voice: SpeechSynthesisVoice | null;
    volume: number;
    rate: number;
    pitch: number;
    onstart: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null;
    onend: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null;
    onerror: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisErrorEvent) => any) | null;
  }

  interface SpeechSynthesisUtteranceStatic {
    new(text?: string): SpeechSynthesisUtterance;
  }


  // Augment Window
  interface Window {
    SpeechRecognition: SpeechRecognitionStatic | undefined;
    webkitSpeechRecognition: SpeechRecognitionStatic | undefined;
    SpeechSynthesisUtterance: SpeechSynthesisUtteranceStatic;
    readonly speechSynthesis: SpeechSynthesis;
  }
}


const App: React.FC = () => {
  const [chatHistories, setChatHistories] = useState<ChatHistoryItem[]>([]);
  const [activeChatIdState, setActiveChatIdInternal] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');

  const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true); // Overall initialization status for loading screen
  const [initialDataLoaded, setInitialDataLoaded] = useState<boolean>(false); // Flag for main data loading effect

  const [isSidebarOpenOnMobile, setIsSidebarOpenOnMobile] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false); // Initially false, will be set by effect
  const [aiInstance, setAiInstance] = useState<GoogleGenAI | null | undefined>(undefined); // undefined initially to signify not checked yet
  const [currentTheme, setCurrentTheme] = useState<Theme>(loadTheme());

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [selectedFilePreviews, setSelectedFilePreviews] = useState<FilePreview[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  // Voice Input State
  const [isListening, setIsListening] = useState<boolean>(false);
  const isListeningRef = useRef(isListening); // Ref to hold current isListening state for stable callbacks
  const [currentRecognitionLang, setCurrentRecognitionLang] = useState<RecognitionLanguage>(RecognitionLanguage.EN_US);
  const [isSpeechApiSupported, setIsSpeechApiSupported] = useState<boolean>(true);
  const [micError, setMicError] = useState<string | null>(null);
  const speechRecognitionInstanceRef = useRef<SpeechRecognition | null>(null);

  // Text-to-Speech (TTS) State
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isSpeechSynthesisSupported, setIsSpeechSynthesisSupported] = useState<boolean>(true);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const speechSynthesisUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [ttsVoices, setTtsVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Stop Generation
  const streamAbortControllerRef = useRef<AbortController | null>(null);

  // Code Emulator Modal State
  const [showRunCodeModal, setShowRunCodeModal] = useState<boolean>(false);
  const [runningCodeInfo, setRunningCodeInfo] = useState<{ code: string, language: string | undefined } | null>(null);

  // AI Title Generation State
  const [generatingTitleForChatId, setGeneratingTitleForChatId] = useState<string | null>(null);

  // Page Reload State
  const [isReloadingPage, setIsReloadingPage] = useState<boolean>(false);


  // Keep isListeningRef synced with isListening state
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    applyTheme(currentTheme);
    if (currentTheme === Theme.SYSTEM) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme(Theme.SYSTEM);
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [currentTheme]);

  useEffect(() => {
    const isSecureContext = window.isSecureContext;
    if (!isSecureContext) {
      console.warn("Voice input and other sensitive APIs may not work: Page is not served over a secure context (HTTPS).");
      setError(prevError => {
          const httpsError = "For voice features, please use a secure (HTTPS) connection.";
          if (prevError && !prevError.includes(httpsError)) return `${prevError} ${httpsError}`;
          if (!prevError) return httpsError;
          return prevError;
      });
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setIsSpeechApiSupported(false);
      console.warn("Speech recognition API not found in this browser.");
    } else {
      setIsSpeechApiSupported(true);
    }

    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setIsSpeechSynthesisSupported(false);
      console.warn("Speech synthesis not supported by this browser.");
    } else {
      setIsSpeechSynthesisSupported(true);
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis!.getVoices();
        if (availableVoices.length > 0) setTtsVoices(availableVoices);
      };
      loadVoices();
      let voicesChangedHandler: (() => void) | null = loadVoices;
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = voicesChangedHandler;
      }
      return () => {
        if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged === voicesChangedHandler) {
          window.speechSynthesis.onvoiceschanged = null;
        }
      };
    }
  }, [setError]); // Added setError to dependency array

  const setActiveChatId = useCallback((id: string | null) => {
    setActiveChatIdInternal(id);
    saveActiveChatId(id);
    setEditingMessageId(null);
    setInputValue('');
    if (isListeningRef.current && speechRecognitionInstanceRef.current) {
      speechRecognitionInstanceRef.current.stop();
    }
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);
    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort();
      streamAbortControllerRef.current = null;
      setIsSendingMessage(false);
    }
  }, []); // Stable: uses refs and stable setters

  useEffect(() => {
    return () => {
      if (window.speechSynthesis && window.speechSynthesis.speaking) window.speechSynthesis.cancel();
      if (streamAbortControllerRef.current) {
        streamAbortControllerRef.current.abort();
        streamAbortControllerRef.current = null;
      }
    };
  }, [activeChatIdState]); // Cleanup depends on actual activeChatIdState


  const handleThemeChange = (newTheme: Theme) => {
    setCurrentTheme(newTheme);
    saveTheme(newTheme);
    applyTheme(newTheme);
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(scrollToBottom, [currentMessages]);

  const extractUserFriendlyErrorMessage = (err: any): string => {
      if (typeof err === 'string') return err;
      if (err instanceof Error) {
          if (err.message.includes('stream') && err.message.includes('abort')) return "Generation stopped by user.";
          return err.message;
      }
      if (err && typeof err.message === 'string') return err.message;
      if (err && typeof err.detail === 'string') return err.detail;
      if (err && typeof err.error === 'string') return err.error;
      if (err && typeof err.reason === 'string') return err.reason;
      if (err && typeof err.statusText === 'string') return err.statusText;

      const simpleString = String(err);
      if (simpleString !== "[object Object]" && simpleString !== "") return simpleString.substring(0, 500);

      return "An unknown error occurred.";
  };

  const initializeAndSetChatSession = useCallback(async (messagesToLoad: ChatMessage[], currentAiInstance: GoogleGenAI | null) => {
    if (!currentAiInstance) {
      setChatSession(null);
      return null;
    }
    setError(null); setMicError(null); setTtsError(null);
    try {
      let geminiHistoryForCreation: { role: string; parts: object[] }[] | undefined = convertToGeminiHistory(messagesToLoad);

      // Validate history for API
      if (geminiHistoryForCreation && geminiHistoryForCreation.length > 0) {
        if (geminiHistoryForCreation[0].role !== 'user') {
          console.warn("[App] History for chat creation does not start with a user turn. Starting session fresh for API.");
          geminiHistoryForCreation = undefined;
        } else {
          for (let i = 0; i < geminiHistoryForCreation.length - 1; i++) {
            if (geminiHistoryForCreation[i].role === geminiHistoryForCreation[i + 1].role) {
              console.warn("[App] History for chat creation does not have alternating roles. Starting session fresh for API.");
              geminiHistoryForCreation = undefined;
              break;
            }
          }
        }
      } else if (geminiHistoryForCreation && geminiHistoryForCreation.length === 0) {
        // If conversion results in an empty list (e.g. only loading/error messages), treat as no history.
        geminiHistoryForCreation = undefined;
      }
      // If messagesToLoad was empty initially, convertToGeminiHistory returns [], which becomes undefined.

      const newChat = currentAiInstance.chats.create({
        model: 'gemini-2.5-flash-preview-04-17',
        history: geminiHistoryForCreation, // Pass validated or undefined history
        config: {
          systemInstruction: 'You are a helpful, friendly, and concise AI assistant. Format your responses clearly. You can use markdown for formatting if appropriate, but keep it simple. If you are given images or PDFs, analyze them and respond to the user query based on their content.',
        },
      });
      setChatSession(newChat);
      return newChat;
    } catch (err) {
      console.error('Failed to initialize chat session:', err);
      const errorMessage = extractUserFriendlyErrorMessage(err);
      setError(`Failed to initialize AI session: ${errorMessage}`);
      setChatSession(null);
      return null;
    }
  }, []); // Depends on no external state other than args, setters are stable

  const handleStartEdit = (messageId: string, currentText: string) => {
    if (isListeningRef.current && speechRecognitionInstanceRef.current) speechRecognitionInstanceRef.current.stop();
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    }
    setEditingMessageId(messageId);
    setInputValue(currentText);
    setSelectedFilePreviews([]);
    setFileError(null);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setInputValue('');
  };
  
  const handleNewChat = useCallback(async (currentAiInstanceForNewChat?: GoogleGenAI, suppressGreeting: boolean = false) => {
    handleCancelEdit();
    if (isListeningRef.current && speechRecognitionInstanceRef.current) {
      speechRecognitionInstanceRef.current.stop();
    }
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    }
    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort();
      setIsSendingMessage(false);
    }

    const actualAiInstance = currentAiInstanceForNewChat || aiInstance; // aiInstance from state
    if (!actualAiInstance || apiKeyMissing) {
      setError(apiKeyMissing ? "Cannot start new chat: API Key is missing." : "Cannot start new chat: AI not initialized.");
      return;
    }

    const now = new Date();
    const newChatId = `chat-${Date.now()}`;
    const initialMessages: ChatMessage[] = [];

    if (!suppressGreeting) {
        initialMessages.push({
            id: `ai-greeting-${newChatId}`,
            sender: Sender.AI,
            timestamp: now,
            textPart: "Hello! I'm your KH AI assistant. How can I help you today? You can also upload images or PDFs.",
            isLoading: false,
        });
    }

    const newHistoryItem: ChatHistoryItem = {
      id: newChatId,
      title: `New Chat ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      messages: initialMessages,
      createdAt: now,
      lastUpdatedAt: now,
    };

    setChatHistories(prevChatHistories => {
        const updatedHistories = [newHistoryItem, ...prevChatHistories].sort((a,b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime() );
        saveChatHistories(updatedHistories);
        return updatedHistories;
    });

    setActiveChatId(newHistoryItem.id); // Stable callback
    setCurrentMessages(initialMessages);
    await initializeAndSetChatSession(initialMessages, actualAiInstance);
  }, [aiInstance, apiKeyMissing, initializeAndSetChatSession, setActiveChatId]); // Removed isListening, use isListeningRef


  // Effect 1: Initialize aiInstance and apiKeyMissing. Runs once.
  useEffect(() => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      setError("API_KEY environment variable is not set. Chatbot is disabled.");
      setApiKeyMissing(true);
      setAiInstance(null);
      setIsInitializing(false); // Allow history viewing etc.
      return;
    }

    try {
      const genAI = new GoogleGenAI({ apiKey });
      setAiInstance(genAI);
      setApiKeyMissing(false);
      // setIsInitializing(false) will be handled by the main data loading effect
    } catch (err) {
      console.error("AI Initialization error:", err);
      setError(`AI Initialization failed: ${extractUserFriendlyErrorMessage(err)}`);
      setApiKeyMissing(true);
      setAiInstance(null);
      setIsInitializing(false); // Allow app to proceed or show error
    }
  }, []);


  // Effect 2: Load initial data after aiInstance/apiKeyMissing are determined.
  useEffect(() => {
    if (initialDataLoaded) return; // Prevent re-running if already loaded

    // Wait until aiInstance is determined (not undefined) or apiKeyMissing is true (meaning no key)
    if (aiInstance === undefined && !apiKeyMissing) {
      return; // Still waiting for Effect 1 to set aiInstance or confirm apiKeyMissing
    }

    // This local async function encapsulates the main data loading logic
    const loadData = async () => {
      setIsInitializing(true); // Start "initializing" state for UI
      applyTheme(loadTheme()); // Apply theme early

      let loadedHistories = loadChatHistories();
      loadedHistories.sort((a,b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime() );
      setChatHistories(loadedHistories);

      const lastActiveId = loadActiveChatId();
      let chatToLoad: ChatHistoryItem | undefined = loadedHistories.find(h => h.id === lastActiveId);
      if (!chatToLoad && loadedHistories.length > 0) chatToLoad = loadedHistories[0];

      if (chatToLoad) {
        setActiveChatId(chatToLoad.id); // Stable callback
        setCurrentMessages(chatToLoad.messages); // Stable setter
        if (aiInstance) { // aiInstance is now stable from Effect 1 or null
          await initializeAndSetChatSession(chatToLoad.messages, aiInstance);
        } else {
          setChatSession(null); // No AI, no session
        }
      } else {
        // No existing chats or no specific chat to load
        if (aiInstance) {
          // No chats, and AI is available, so create a new one.
          // Pass aiInstance directly to avoid dependency on the useCallback'd handleNewChat for init phase
          // This inlines part of handleNewChat's logic for the initial setup.
            handleCancelEdit(); // from handleNewChat
            if (isListeningRef.current && speechRecognitionInstanceRef.current) speechRecognitionInstanceRef.current.stop(); // from handleNewChat
            if (window.speechSynthesis && window.speechSynthesis.speaking) window.speechSynthesis.cancel(); // from handleNewChat
            setSpeakingMessageId(null); // from handleNewChat
            if (streamAbortControllerRef.current) { streamAbortControllerRef.current.abort(); setIsSendingMessage(false); } // from handleNewChat

            const now = new Date();
            const newChatId = `chat-${Date.now()}`;
            const initialMsgs: ChatMessage[] = [];
             if (loadedHistories.length === 0) { // Only add greeting if truly no histories (suppressGreeting = false effectively)
                initialMsgs.push({
                    id: `ai-greeting-${newChatId}`, sender: Sender.AI, timestamp: now,
                    textPart: "Hello! I'm your KH AI assistant. How can I help you today? You can also upload images or PDFs.", isLoading: false,
                });
            }
            const newHistoryItem: ChatHistoryItem = {
              id: newChatId, title: `New Chat ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
              messages: initialMsgs, createdAt: now, lastUpdatedAt: now,
            };
            setChatHistories(prev => [newHistoryItem, ...prev].sort((a,b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime()));
            setActiveChatId(newChatId);
            setCurrentMessages(initialMsgs);
            await initializeAndSetChatSession(initialMsgs, aiInstance);
        } else {
          // No AI instance, and no previous chats. Show empty state.
          setActiveChatId(null);
          setCurrentMessages([]);
          setChatSession(null);
        }
      }
      setIsInitializing(false); // Done with all initialization
      setInitialDataLoaded(true); // Mark data as loaded
    };

    loadData();

  }, [aiInstance, apiKeyMissing, initialDataLoaded, setActiveChatId, initializeAndSetChatSession]); // Dependencies that trigger this effect


  const handleSelectChat = useCallback(async (chatIdToSelect: string) => {
    const selectedHistory = chatHistories.find(h => h.id === chatIdToSelect);
    if (selectedHistory && aiInstance) { // Check aiInstance
      setActiveChatId(selectedHistory.id);
      setCurrentMessages(selectedHistory.messages);
      await initializeAndSetChatSession(selectedHistory.messages, aiInstance);
    } else if (!aiInstance && selectedHistory) { // Allow selecting chat even if AI is down, just won't init session
      setActiveChatId(selectedHistory.id);
      setCurrentMessages(selectedHistory.messages);
      setChatSession(null);
    } else if (!aiInstance) {
        setError("AI Service not available. Cannot switch chats effectively.");
    }
  }, [chatHistories, aiInstance, initializeAndSetChatSession, setActiveChatId]);

  const handleStopGeneration = useCallback(() => {
    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort();
    }
  }, []);

  const generateAndSetAiTitle = async (chatId: string, textToSummarize: string, currentAiInstance: GoogleGenAI) => {
    if (!textToSummarize.trim() || !currentAiInstance) return;
    setGeneratingTitleForChatId(chatId);
    try {
      const titlePrompt = `Summarize the following text into a very short chat title (maximum 5 words, ideally 2-3 words). Respond with only the title itself, no extra text or quotes: "${textToSummarize.substring(0, 500)}"`;
      
      const response = await currentAiInstance.models.generateContent({
          model: 'gemini-2.5-flash-preview-04-17',
          contents: titlePrompt,
      });
  
      const potentialTitle = response.text?.trim();
  
      if (potentialTitle && potentialTitle.length > 0 && potentialTitle.length < 50) {
        setChatHistories(prevHistories => {
          const newHistories = prevHistories.map(h => {
            if (h.id === chatId) {
              // Only update if the title is still the generic "New Chat..." or the client-generated one that looks similar
              if (h.title.startsWith("New Chat")) { 
                return { ...h, title: potentialTitle };
              }
            }
            return h;
          });
          // Check if a change actually happened before saving and re-sorting
          const didChange = newHistories.some((newH, index) => newH.title !== prevHistories[index]?.title && newH.id === chatId);
          if (didChange) {
            const sortedHistories = newHistories.sort((a,b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());
            saveChatHistories(sortedHistories);
            return sortedHistories;
          }
          return prevHistories; 
        });
      } else {
          console.warn("AI title generation returned empty or unsuitable title:", potentialTitle);
      }
    } catch (error) {
      console.error("Error generating AI chat title:", extractUserFriendlyErrorMessage(error));
    } finally {
      setGeneratingTitleForChatId(null);
    }
  };


  const handleSendMessage = useCallback(async (files?: File[] | null) => {
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    }
    const trimmedInput = inputValue.trim();

    const currentActiveChatId = activeChatIdState; 

    if (editingMessageId) {
      if (!trimmedInput) {
        setError("Cannot save an empty message. Please add some text or cancel edit.");
        return;
      }

      setChatHistories(prevChatHistories => {
        let activeHistoryItem = prevChatHistories.find(h => h.id === currentActiveChatId);
        if (!activeHistoryItem) {
            setError("Critical error: Active chat history not found during edit.");
            return prevChatHistories;
        }

        const editedMessageIndex = activeHistoryItem.messages.findIndex(msg => msg.id === editingMessageId);
        if (editedMessageIndex === -1) {
            setError("Critical error: Edited message not found in history.");
             return prevChatHistories;
        }

        const originalUserMessage = activeHistoryItem.messages[editedMessageIndex];
        const updatedUserMessage: ChatMessage = {
            ...originalUserMessage,
            textPart: trimmedInput,
            timestamp: new Date()
        };

        setCurrentMessages(prevMsgs =>
            prevMsgs.map(msg => msg.id === editingMessageId ? updatedUserMessage : msg)
        );

        const updatedHistories = prevChatHistories.map(h => {
            if (h.id === currentActiveChatId) {
                return {
                    ...h,
                    messages: h.messages.map(msg => msg.id === editingMessageId ? updatedUserMessage : msg),
                    lastUpdatedAt: new Date(),
                };
            }
            return h;
        });

        const subsequentAiMessageIndex = editedMessageIndex + 1;
        const aiMessageToRegenerate = (activeHistoryItem.messages.length > subsequentAiMessageIndex &&
                                   activeHistoryItem.messages[subsequentAiMessageIndex].sender === Sender.AI)
                                  ? activeHistoryItem.messages[subsequentAiMessageIndex]
                                  : null;

        if (aiMessageToRegenerate && aiInstance) {
            setIsSendingMessage(true);
            const aiMessageToRegenerateId = aiMessageToRegenerate.id;

            setCurrentMessages(prev => prev.map(msg =>
                msg.id === aiMessageToRegenerateId ? { ...msg, textPart: '', isLoading: true, error: undefined, fileParts: undefined } : msg
            ));

            const historiesWithLoadingAi = updatedHistories.map(h => {
                if (h.id === currentActiveChatId) {
                    return {
                        ...h,
                        messages: h.messages.map(msg =>
                            msg.id === aiMessageToRegenerateId ? { ...msg, textPart: '', isLoading: true, error: undefined, fileParts: undefined, timestamp: new Date() } : msg
                        ),
                        lastUpdatedAt: new Date(),
                    };
                }
                return h;
            });

            let accumulatedRegeneratedText = '';
            streamAbortControllerRef.current = new AbortController();

            (async () => {
                try {
                    // History for regen session context: messages *before* the edited one
                    const historyContextForRegeneration = activeHistoryItem.messages.slice(0, editedMessageIndex);
                    
                    let geminiHistoryForRegen: { role: string; parts: object[] }[] | undefined = convertToGeminiHistory(historyContextForRegeneration);

                    // Validate history for regen API call
                    if (geminiHistoryForRegen && geminiHistoryForRegen.length > 0) {
                        if (geminiHistoryForRegen[0].role !== 'user') {
                          console.warn("[App] Regen history does not start with a user turn. Starting session fresh for API regen.");
                          geminiHistoryForRegen = undefined;
                        } else {
                          for (let i = 0; i < geminiHistoryForRegen.length - 1; i++) {
                            if (geminiHistoryForRegen[i].role === geminiHistoryForRegen[i + 1].role) {
                              console.warn("[App] Regen history does not have alternating roles. Starting session fresh for API regen.");
                              geminiHistoryForRegen = undefined;
                              break;
                            }
                          }
                        }
                      } else if (geminiHistoryForRegen && geminiHistoryForRegen.length === 0) {
                        geminiHistoryForRegen = undefined;
                      }

                    const regenChatSession = aiInstance.chats.create({
                        model: 'gemini-2.5-flash-preview-04-17',
                        history: geminiHistoryForRegen, // Pass validated or undefined history
                        config: {
                          systemInstruction: 'You are a helpful, friendly, and concise AI assistant. Format your responses clearly. You can use markdown for formatting if appropriate, but keep it simple. If you are given images or PDFs, analyze them and respond to the user query based on their content.',
                        },
                    });

                    const partsForEditedUserMessage: ({ text: string } | { inlineData: { mimeType: string, data: string }})[] = [];
                    if (updatedUserMessage.textPart && updatedUserMessage.textPart.trim() !== "") {
                        partsForEditedUserMessage.push({ text: updatedUserMessage.textPart.trim() });
                    }
                    if (updatedUserMessage.fileParts) {
                        updatedUserMessage.fileParts.forEach(fp => {
                            const base64DataOnly = fp.data.substring(fp.data.indexOf(',') + 1);
                            partsForEditedUserMessage.push({ inlineData: { mimeType: fp.mimeType, data: base64DataOnly } });
                        });
                    }

                    if (partsForEditedUserMessage.length === 0) {
                        throw new Error("Edited message has no content to send to AI for regeneration.");
                    }

                    const stream = await regenChatSession.sendMessageStream({ message: partsForEditedUserMessage });

                    for await (const chunk of stream) {
                        if (streamAbortControllerRef.current?.signal.aborted) {
                        accumulatedRegeneratedText += " (Stopped)";
                        break;
                        }
                        const chunkText = chunk.text;
                        if (typeof chunkText === 'string') {
                            accumulatedRegeneratedText += chunkText;
                        } else if (chunkText !== null && chunkText !== undefined) {
                            console.warn("Received non-string chunk text during edit regeneration:", chunkText);
                        }
                        setCurrentMessages(prev => prev.map(msg =>
                        msg.id === aiMessageToRegenerateId ? { ...msg, textPart: accumulatedRegeneratedText, isLoading: true } : msg
                        ));
                    }

                    const finalRegeneratedAiMessage: ChatMessage = {
                        ...aiMessageToRegenerate,
                        textPart: accumulatedRegeneratedText,
                        timestamp: new Date(),
                        isLoading: false,
                        error: streamAbortControllerRef.current?.signal.aborted ? "Generation stopped by user." : undefined,
                        fileParts: undefined,
                    };

                    setCurrentMessages(prev => prev.map(msg => msg.id === aiMessageToRegenerateId ? finalRegeneratedAiMessage : msg));

                    setChatHistories(finalPrevHistories => {
                        const regeneratedHistories = finalPrevHistories.map(h => {
                            if (h.id === currentActiveChatId) {
                                return {
                                    ...h,
                                    messages: h.messages.map(msg => {
                                      return msg.id === aiMessageToRegenerateId ? finalRegeneratedAiMessage : (msg.id === editingMessageId ? updatedUserMessage : msg);
                                    }),
                                    lastUpdatedAt: new Date(),
                                };
                            }
                            return h;
                        }).sort((a,b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime() );
                        saveChatHistories(regeneratedHistories);
                        const currentActiveChatForSession = regeneratedHistories.find(h => h.id === currentActiveChatId);
                        if (currentActiveChatForSession) initializeAndSetChatSession(currentActiveChatForSession.messages, aiInstance); // Pass aiInstance
                        return regeneratedHistories;
                    });
                } catch (err) {
                    console.error('Error regenerating AI response:', err);
                    const errorText = extractUserFriendlyErrorMessage(err);
                    const errorAiMessageUpdate: ChatMessage = {
                        ...aiMessageToRegenerate,
                        textPart: accumulatedRegeneratedText + `Error during regeneration. ${errorText}`,
                        isLoading: false,
                        error: `AI Regeneration Error: ${errorText}`,
                        timestamp: new Date(),
                        fileParts: undefined,
                    };
                    setCurrentMessages(prev => prev.map(msg => msg.id === aiMessageToRegenerateId ? errorAiMessageUpdate : msg));

                    setChatHistories(finalPrevHistories => {
                        const errorHistories = finalPrevHistories.map(h => {
                            if (h.id === currentActiveChatId) {
                            return {
                                ...h,
                                messages: h.messages.map(msg => {
                                  return msg.id === aiMessageToRegenerateId ? errorAiMessageUpdate : (msg.id === editingMessageId ? updatedUserMessage : msg);
                                }),
                                lastUpdatedAt: new Date(),
                            };
                            }
                            return h;
                        }).sort((a,b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime() );
                        saveChatHistories(errorHistories);
                        return errorHistories;
                    });
                } finally {
                    setIsSendingMessage(false);
                    if (streamAbortControllerRef.current) streamAbortControllerRef.current = null;
                }
            })();
            return historiesWithLoadingAi;
        } else {
            const sortedHistories = updatedHistories.sort((a,b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime() );
            saveChatHistories(sortedHistories);
             if (aiInstance) { // Re-initialize chat session after edit if AI is available
                const currentActiveChatForSession = sortedHistories.find(h => h.id === currentActiveChatId);
                if (currentActiveChatForSession) initializeAndSetChatSession(currentActiveChatForSession.messages, aiInstance);
            }
            return sortedHistories;
        }
      });

      setEditingMessageId(null);
      setInputValue('');
      return;
    }

    if (!trimmedInput && (!files || files.length === 0)) return;
    if (apiKeyMissing || !currentActiveChatId || !aiInstance) return;
    if (isSendingMessage && !streamAbortControllerRef.current) return;

    let currentActiveChatSession = chatSession;
    if (!currentActiveChatSession) {
        const activeHistoryItemFromState = chatHistories.find(h => h.id === currentActiveChatId);
        if (activeHistoryItemFromState && aiInstance) { // Ensure aiInstance before re-init
            currentActiveChatSession = await initializeAndSetChatSession(activeHistoryItemFromState.messages, aiInstance);
            if (!currentActiveChatSession) {
                setError("Failed to re-initialize chat session.");
                setIsSendingMessage(false); return;
            }
        } else if (!aiInstance) {
             setError("AI Service not available.");
             setIsSendingMessage(false); return;
        } else {
             setError("Active chat data not found.");
             setIsSendingMessage(false); return;
        }
    }

    setIsSendingMessage(true);
    setError(null); setMicError(null); setTtsError(null);
    setInputValue(''); setSelectedFilePreviews([]); setFileError(null);

    const filePartsForMessage: FilePart[] = [];
    if (files && files.length > 0) {
      let totalSize = 0;
      if (files.length > MAX_FILES_PER_MESSAGE) {
        setError(`Cannot upload more than ${MAX_FILES_PER_MESSAGE} files at a time.`);
        setIsSendingMessage(false); return;
      }
      for (const file of files) {
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
          setError(`Unsupported file type: ${file.name}. Allowed: ${ALLOWED_FILE_TYPES.join(', ')}.`);
          setIsSendingMessage(false); return;
        }
        if (file.size > MAX_INDIVIDUAL_FILE_SIZE) {
          setError(`File ${file.name} is too large. Max: ${MAX_INDIVIDUAL_FILE_SIZE / (1024*1024)}MB.`);
          setIsSendingMessage(false); return;
        }
        totalSize += file.size;
        if (totalSize > MAX_TOTAL_FILE_SIZE) {
          setError(`Total file size exceeds ${MAX_TOTAL_FILE_SIZE / (1024*1024)}MB.`);
          setIsSendingMessage(false); return;
        }
        try {
          const base64Data = await fileToBase64(file);
          filePartsForMessage.push({ name: file.name, mimeType: file.type, data: base64Data });
        } catch (err) {
          setError(`Could not process file: ${file.name}. ${extractUserFriendlyErrorMessage(err)}`);
          setIsSendingMessage(false); return;
        }
      }
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: Sender.USER,
      timestamp: new Date(),
      textPart: trimmedInput,
      fileParts: filePartsForMessage.length > 0 ? filePartsForMessage : undefined,
    };

    setCurrentMessages(prevMessages => [...prevMessages, userMessage]);

    // Determine if AI title generation should be attempted
    let shouldAttemptAiTitleGeneration = false;
    let initialUserMessageForTitle: ChatMessage | undefined = undefined;

    const chatToUpdateForTitle = chatHistories.find(h => h.id === currentActiveChatId);
    if (chatToUpdateForTitle && chatToUpdateForTitle.title.startsWith("New Chat")) {
      const aiResponsesInChat = chatToUpdateForTitle.messages.filter(m => m.sender === Sender.AI && m.textPart && !m.isLoading);
      if (aiResponsesInChat.length === 0) { // This will be the first AI response
        shouldAttemptAiTitleGeneration = true;
        // Find the actual first user message in the history if it exists, otherwise use current
        const firstUserMsgInHistory = chatToUpdateForTitle.messages.find(m => m.sender === Sender.USER && (m.textPart?.trim() || (m.fileParts && m.fileParts.length > 0)));
        initialUserMessageForTitle = firstUserMsgInHistory || userMessage;
      }
    }

    const aiMessageId = `ai-${Date.now()}`;
    const aiPlaceholderMessage: ChatMessage = {
      id: aiMessageId,
      sender: Sender.AI,
      timestamp: new Date(),
      isLoading: true,
    };
    setCurrentMessages(prev => [...prev, aiPlaceholderMessage]);

    setChatHistories(prevHistories => {
      const newHistories = prevHistories.map(h => {
        if (h.id === currentActiveChatId) {
          let newTitle = h.title;
          // Generate client-side title only if AI title won't be attempted or if title is still default.
          if (h.title.startsWith("New Chat") && !shouldAttemptAiTitleGeneration) {
            newTitle = generateChatTitle(userMessage.textPart, userMessage.fileParts);
          }
          return { ...h, title: newTitle, messages: [...h.messages, userMessage], lastUpdatedAt: new Date() };
        }
        return h;
      }).sort((a,b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime() );
      // No saveChatHistories here yet, will be saved after AI response or in finally block
      return newHistories;
    });

    streamAbortControllerRef.current = new AbortController();
    let accumulatedResponse = '';

    try {
      const partsForApi: ({ text: string } | { inlineData: { mimeType: string, data: string }})[] = [];
      if (userMessage.textPart && userMessage.textPart.trim() !== "") {
        partsForApi.push({ text: userMessage.textPart.trim() });
      }
      if (userMessage.fileParts) {
        userMessage.fileParts.forEach(fp => {
          const base64DataOnly = fp.data.substring(fp.data.indexOf(',') + 1);
          partsForApi.push({ inlineData: { mimeType: fp.mimeType, data: base64DataOnly } });
        });
      }

      if (partsForApi.length === 0) throw new Error("No content to send to AI.");

      const stream = await currentActiveChatSession.sendMessageStream({ message: partsForApi });

      for await (const chunk of stream) {
        if (streamAbortControllerRef.current?.signal.aborted) {
          accumulatedResponse += " (Stopped)";
          break;
        }
        const chunkText = chunk.text;
        if (typeof chunkText === 'string') {
            accumulatedResponse += chunkText;
        } else if (chunkText !== null && chunkText !== undefined) {
            console.warn("Received non-string chunk text during new message stream:", chunkText);
        }
        setCurrentMessages(prev => prev.map(msg =>
            msg.id === aiMessageId ? { ...msg, textPart: accumulatedResponse, isLoading: true } : msg
        ));
      }

      const finalAiMessage: ChatMessage = {
          id: aiMessageId,
          textPart: accumulatedResponse,
          sender: Sender.AI,
          timestamp: new Date(),
          isLoading: false,
          error: streamAbortControllerRef.current?.signal.aborted ? "Generation stopped by user." : undefined,
      };

      setCurrentMessages(prev => prev.map(msg => msg.id === aiMessageId ? finalAiMessage : msg ));

      // AI Title Generation Call
      if (shouldAttemptAiTitleGeneration && finalAiMessage.textPart && currentActiveChatId && aiInstance) {
        let textToSummarizeForTitle = "";
        if (initialUserMessageForTitle?.textPart) {
            textToSummarizeForTitle += `User: ${initialUserMessageForTitle.textPart.substring(0, 200)}\n`;
        }
        textToSummarizeForTitle += `AI: ${finalAiMessage.textPart.substring(0, 300)}`;
        generateAndSetAiTitle(currentActiveChatId, textToSummarizeForTitle.trim(), aiInstance);
      }
      
      setChatHistories(prevHistories => {
        const newHistories = prevHistories.map(h => {
          if (h.id === currentActiveChatId) {
            const userMsgExists = h.messages.find(m => m.id === userMessage.id);
            const messagesWithUser = userMsgExists ? h.messages : [...h.messages, userMessage];
            const messagesWithoutOldPlaceholder = messagesWithUser.filter(m => m.id !== aiMessageId || m.sender !== Sender.AI);
            return { ...h, messages: [...messagesWithoutOldPlaceholder, finalAiMessage].filter((item, index, self) => index === self.findIndex(t => t.id === item.id)), lastUpdatedAt: new Date() };
          }
          return h;
        }).sort((a,b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime() );
        saveChatHistories(newHistories);
        return newHistories;
      });

    } catch (err) {
      console.error('Error sending message to AI:', err);
      const errorMessageText = extractUserFriendlyErrorMessage(err);
      setError(`AI Error: ${errorMessageText}`);
      const errorAiMessage: ChatMessage = {
        id: aiMessageId,
        textPart: accumulatedResponse + `Error: ${errorMessageText}`,
        sender: Sender.AI,
        timestamp: new Date(),
        isLoading: false,
        error: `AI Error: ${errorMessageText}`,
      };
      setCurrentMessages(prev => prev.map(msg => msg.id === aiMessageId ? errorAiMessage : msg));
      setChatHistories(prevHistories => {
        const newHistories = prevHistories.map(h => {
          if (h.id === currentActiveChatId) {
             const userMsgExists = h.messages.find(m => m.id === userMessage.id);
             const messagesWithUser = userMsgExists ? h.messages : [...h.messages, userMessage];
             const messagesWithoutOldPlaceholder = messagesWithUser.filter(m => m.id !== aiMessageId || m.sender !== Sender.AI);
            return { ...h, messages: [...messagesWithoutOldPlaceholder, errorAiMessage].filter((item, index, self) => index === self.findIndex(t => t.id === item.id)), lastUpdatedAt: new Date() };
          }
          return h;
        }).sort((a,b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime() );
        saveChatHistories(newHistories);
        return newHistories;
      });
    } finally {
      setIsSendingMessage(false);
      if (streamAbortControllerRef.current) streamAbortControllerRef.current = null;
    }
  }, [inputValue, chatSession, isSendingMessage, apiKeyMissing, aiInstance, chatHistories, initializeAndSetChatSession, editingMessageId, activeChatIdState]);


  const handleDeleteChat = useCallback(async (chatIdToDelete: string) => {
    if (apiKeyMissing && !aiInstance && chatHistories.length === 0) return;
    handleCancelEdit();

    setChatHistories(prevChatHistories => {
        const remainingHistories = prevChatHistories.filter(h => h.id !== chatIdToDelete);
        const sortedRemainingHistories = remainingHistories.sort((a,b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime() );
        saveChatHistories(sortedRemainingHistories);

        if (activeChatIdState === chatIdToDelete) {
            if (window.speechSynthesis && window.speechSynthesis.speaking) {
                window.speechSynthesis.cancel();
                setSpeakingMessageId(null);
            }
            if (streamAbortControllerRef.current) {
                streamAbortControllerRef.current.abort();
                setIsSendingMessage(false);
            }
        }
        return sortedRemainingHistories;
    });

    if (activeChatIdState === chatIdToDelete) {
        const currentHistories = loadChatHistories().sort((a,b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime() );
        if (currentHistories.length > 0) {
            const nextActiveChat = currentHistories[0];
            setActiveChatId(nextActiveChat.id);
            setCurrentMessages(nextActiveChat.messages);
            if (aiInstance) await initializeAndSetChatSession(nextActiveChat.messages, aiInstance); // Pass aiInstance
        } else {
            // No chats left, create a new one if AI is available
            if (aiInstance) await handleNewChat(aiInstance); else setActiveChatId(null);
        }
    }
  }, [activeChatIdState, apiKeyMissing, aiInstance, initializeAndSetChatSession, handleNewChat, setActiveChatId, chatHistories.length]);

  const handleDeleteAllChats = useCallback(async () => {
    if (apiKeyMissing && !aiInstance && chatHistories.length === 0) return;
    handleCancelEdit();
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    }
    if (streamAbortControllerRef.current) {
        streamAbortControllerRef.current.abort();
        setIsSendingMessage(false);
    }
    setChatHistories([]);
    saveChatHistories([]);
    // Create a new chat if AI is available, otherwise set to null/empty state
    if (aiInstance) await handleNewChat(aiInstance); else { setActiveChatId(null); setCurrentMessages([]); setChatSession(null); }
  }, [apiKeyMissing, aiInstance, handleNewChat, setActiveChatId, chatHistories.length]);

  // Voice Input Handlers
  const handleChangeRecognitionLang = useCallback((lang: RecognitionLanguage) => {
    setCurrentRecognitionLang(lang);
    if (isListeningRef.current && speechRecognitionInstanceRef.current) speechRecognitionInstanceRef.current.stop();
  }, []); // isListeningRef is used, no direct dep on isListening state

  const handleToggleListening = useCallback(() => {
    if (!isSpeechApiSupported) {
      setMicError("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListeningRef.current) { // Use ref
      if (speechRecognitionInstanceRef.current) speechRecognitionInstanceRef.current.stop();
    } else {
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        setSpeakingMessageId(null);
      }
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
          setMicError(null);
          const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (!SpeechRecognitionAPI) {
              setMicError("Speech recognition is not supported by this browser.");
              setIsListening(false); return;
          }

          const recognition = new SpeechRecognitionAPI();
          recognition.lang = currentRecognitionLang;
          recognition.continuous = false; recognition.interimResults = false;

          recognition.onstart = () => { setIsListening(true); setMicError(null); };
          recognition.onresult = (event: SpeechRecognitionEvent) => {
            setInputValue(prev => (prev ? prev.trim() + ' ' : '') + event.results[0][0].transcript.trim());
          };
          recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') setMicError("Microphone permission denied.");
            else if (event.error === 'no-speech') setMicError("No speech detected.");
            else setMicError(`Voice input error: ${event.error}.`);
            setIsListening(false);
          };
          recognition.onend = () => { setIsListening(false); speechRecognitionInstanceRef.current = null; };

          speechRecognitionInstanceRef.current = recognition;
          recognition.start();
        })
        .catch(err => {
          setMicError("Microphone permission denied or not available. " + extractUserFriendlyErrorMessage(err));
          setIsListening(false);
        });
    }
  }, [isSpeechApiSupported, currentRecognitionLang]); // Depends on currentRecognitionLang for recognition.lang

  // Text-to-Speech Handler
  const handleToggleSpeakMessage = useCallback((messageId: string, textToSpeak: string) => {
    if (!isSpeechSynthesisSupported || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setTtsError("Speech synthesis not supported.");
      return;
    }
    setTtsError(null);

    if (speakingMessageId === messageId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      if (speechSynthesisUtteranceRef.current) speechSynthesisUtteranceRef.current = null;
    } else {
      if (window.speechSynthesis?.speaking) window.speechSynthesis.cancel();

      const utterance = new window.SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = currentRecognitionLang;

      let selectedVoice: SpeechSynthesisVoice | undefined = undefined;
      if (currentRecognitionLang === RecognitionLanguage.KM_KH) {
        selectedVoice = ttsVoices.find(v => v.lang === RecognitionLanguage.KM_KH) || ttsVoices.find(v => v.lang.toLowerCase().startsWith('km'));
      } else if (currentRecognitionLang === RecognitionLanguage.EN_US) {
        selectedVoice = ttsVoices.find(v => v.lang === RecognitionLanguage.EN_US && v.default) || ttsVoices.find(v => v.lang === RecognitionLanguage.EN_US) || ttsVoices.find(v => v.lang.toLowerCase().startsWith('en') && v.default) || ttsVoices.find(v => v.lang.toLowerCase().startsWith('en'));
      }
      if (selectedVoice) utterance.voice = selectedVoice;

      utterance.onend = () => { setSpeakingMessageId(null); speechSynthesisUtteranceRef.current = null; };
      utterance.onerror = (event) => {
        const synthesisEvent = event as SpeechSynthesisErrorEvent;
        setTtsError(`Error playing speech: ${synthesisEvent.error || 'Unknown TTS error'}`);
        setSpeakingMessageId(null); speechSynthesisUtteranceRef.current = null;
      };

      speechSynthesisUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setSpeakingMessageId(messageId);
    }
  }, [isSpeechSynthesisSupported, speakingMessageId, currentRecognitionLang, ttsVoices]);

  // Code Emulator Handlers
  const handleRunCode = useCallback((code: string, language: string | undefined) => {
    setRunningCodeInfo({ code, language });
    setShowRunCodeModal(true);
  }, []);

  const handleCloseRunCodeModal = useCallback(() => {
    setShowRunCodeModal(false);
    setRunningCodeInfo(null);
  }, []);

  // Page Reload Handler
  const handleReloadPage = useCallback(() => {
    setIsReloadingPage(true);
    setTimeout(() => {
      window.location.reload();
    }, 200); // Small delay to allow loader to render
  }, []);


  if (isInitializing || aiInstance === undefined && !apiKeyMissing && !initialDataLoaded) { // Show loading if overall init or AI check pending
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
        <div className="flex flex-col items-center">
          <img src="https://github.com/pozzra/KH-AI-V2/blob/main/Images/kh_ai_logo.png?raw=true" alt="KH AI Logo" className="w-26 h-26 animate-pulse" />
          <p className="mt-4 text-xl">Initializing Chatbot...</p>
        </div>
      </div>
    );
  }

  const isChatInputDisabled = apiKeyMissing || !aiInstance || !activeChatIdState;
  const anyError = error || micError || ttsError;

  return (
    <div className="flex h-screen max-h-screen antialiased bg-white dark:bg-slate-900 transition-colors duration-300">
      <Sidebar
        histories={chatHistories}
        activeChatId={activeChatIdState}
        onNewChat={() => handleNewChat(aiInstance || undefined)}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        onDeleteAllChats={handleDeleteAllChats}
        apiKeyMissing={apiKeyMissing || !aiInstance}
        isOpenOnMobile={isSidebarOpenOnMobile}
        onCloseMobileSidebar={() => setIsSidebarOpenOnMobile(false)}
        currentTheme={currentTheme}
        onThemeChange={handleThemeChange}
        generatingTitleForChatId={generatingTitleForChatId}
        onReloadPage={handleReloadPage} 
      />
      <div className="flex flex-col flex-grow min-w-0">
        <header className="bg-slate-100 dark:bg-slate-800 p-4 shadow-md flex items-center gap-3 border-b border-slate-300 dark:border-slate-700">
          <button
            onClick={() => setIsSidebarOpenOnMobile(true)}
            className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100"
            aria-label="Open chat history"
          >
            <MenuIcon className="w-6 h-6" />
          </button>
          <img src="https://github.com/pozzra/KH-AI-V2/blob/main/Images/kh_ai_logo.png?raw=true" alt="KH AI Logo" className="w-8 h-8 hidden sm:block" />
          <h1 className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-slate-100 truncate">
            KH AI
          </h1>
          <a
            href="https://pozzra.github.io/about-me/"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-sm font-medium text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300 transition-colors"
          >
            Contact Developer
          </a>
        </header>

        {anyError && (
          <div className="bg-red-500 text-white p-3 text-center text-sm">
            {anyError}
            <button
              onClick={() => {
                setError(null); setMicError(null); setTtsError(null);
                if (editingMessageId && error?.startsWith("Cannot save an empty message")) handleCancelEdit();
              }}
              className="ml-2 py-0.5 px-1.5 text-xs bg-red-700 hover:bg-red-800 rounded">Dismiss</button>
          </div>
        )}
        {apiKeyMissing && !anyError && (
          <div className="bg-red-600 dark:bg-red-700 text-white p-4 text-center font-semibold">
            API_KEY environment variable is not set. Chatbot is disabled. Please set it up to use the application.
          </div>
        )}

        <main className="flex-grow overflow-y-auto p-4 space-y-4 bg-white dark:bg-slate-900">
          {currentMessages.map((msg) => (
            <ChatMessageItem
              key={msg.id}
              message={msg}
              onStartEdit={handleStartEdit}
              isBeingEdited={editingMessageId === msg.id}
              onToggleSpeak={handleToggleSpeakMessage}
              isCurrentlySpeaking={speakingMessageId === msg.id}
              isSpeechSynthesisSupported={isSpeechSynthesisSupported}
              currentAppTheme={currentTheme}
              onRunCode={handleRunCode}
            />
          ))}
          <div ref={messagesEndRef} />
           {currentMessages.length === 0 && !isChatInputDisabled && !isSendingMessage && activeChatIdState && (
            <div className="text-center text-slate-500 dark:text-slate-400 mt-8">
              <p>No messages in this chat yet.</p>
              <p>Type something, attach files, or use voice input to get started!</p>
            </div>
          )}
           {currentMessages.length === 0 && !activeChatIdState && !apiKeyMissing && !isInitializing && ( // Check !isInitializing
             <div className="text-center text-slate-500 dark:text-slate-400 mt-8">
                <p>No active chat. Create a new chat or select one from the history.</p>
             </div>
           )}
        </main>

        <ChatInput
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSendMessage={handleSendMessage}
          isLoading={isSendingMessage}
          isChatDisabled={isChatInputDisabled}
          isEditing={!!editingMessageId}
          onCancelEdit={handleCancelEdit}
          selectedFilePreviews={selectedFilePreviews}
          setSelectedFilePreviews={setSelectedFilePreviews}
          fileError={fileError}
          setFileError={setFileError}
          // Voice Input Props
          isListening={isListening}
          onToggleListening={handleToggleListening}
          currentRecognitionLang={currentRecognitionLang}
          onChangeRecognitionLang={handleChangeRecognitionLang}
          isSpeechApiSupported={isSpeechApiSupported}
          // Stop Generation Prop
          onStopGeneration={handleStopGeneration}
        />
      </div>
      {showRunCodeModal && runningCodeInfo && (
        <RunCodeModal
          isOpen={showRunCodeModal}
          onClose={handleCloseRunCodeModal}
          code={runningCodeInfo.code}
          language={runningCodeInfo.language}
        />
      )}
      {isReloadingPage && (
        <div className="fixed inset-0 z-[100] bg-slate-900/70 dark:bg-black/80 flex flex-col items-center justify-center transition-opacity duration-300 ease-in-out" aria-live="assertive" role="alert">
          <img src="https://github.com/pozzra/KH-AI-V2/blob/main/Images/kh_ai_logo.png?raw=true" alt="Reloading application" className="w-20 h-20 animate-spin" />
          <p className="mt-4 text-xl text-white font-semibold">Reloading...</p>
        </div>
      )}
    </div>
  );
};

export default App;
