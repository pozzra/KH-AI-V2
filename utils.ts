
import { ChatMessage, ChatHistoryItem, Sender, Theme, FilePart } from './types';

const CHAT_HISTORIES_KEY = 'gemini_chat_histories_v2';
const ACTIVE_CHAT_ID_KEY = 'gemini_active_chat_id_v2';
const THEME_KEY = 'gemini_chat_theme_v1';

export const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
export const MAX_INDIVIDUAL_FILE_SIZE = Infinity; // 4MB per file - Changed to Infinity
export const MAX_TOTAL_FILE_SIZE = Infinity; // 16MB total for all files in a message - Changed to Infinity
export const MAX_FILES_PER_MESSAGE = Infinity; // Max 5 files per message - Changed to Infinity


// Type guard for parsing ChatHistoryItem with Date objects
function parseChatHistoryItem(item: any): ChatHistoryItem {
  return {
    ...item,
    messages: item.messages.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
      // fileParts might exist, if so, they are already in correct format from JSON
    })),
    createdAt: new Date(item.createdAt),
    lastUpdatedAt: new Date(item.lastUpdatedAt),
  };
}


export const loadChatHistories = (): ChatHistoryItem[] => {
  try {
    const serializedHistories = localStorage.getItem(CHAT_HISTORIES_KEY);
    if (serializedHistories === null) {
      return [];
    }
    const parsedHistories = JSON.parse(serializedHistories);
    return parsedHistories.map(parseChatHistoryItem);
  } catch (error) {
    console.error('Failed to load chat histories from localStorage:', error);
    return [];
  }
};

export const saveChatHistories = (histories: ChatHistoryItem[]): void => {
  try {
    const serializedHistories = JSON.stringify(histories);
    localStorage.setItem(CHAT_HISTORIES_KEY, serializedHistories);
  } catch (error) {
    console.error('Failed to save chat histories to localStorage:', error);
  }
};

export const loadActiveChatId = (): string | null => {
  return localStorage.getItem(ACTIVE_CHAT_ID_KEY);
};

export const saveActiveChatId = (id: string | null): void => {
  if (id === null) {
    localStorage.removeItem(ACTIVE_CHAT_ID_KEY);
  } else {
    localStorage.setItem(ACTIVE_CHAT_ID_KEY, id);
  }
};

export const convertToGeminiHistory = (messages: ChatMessage[]): { role: string; parts: object[] }[] => {
  const historyMessages = messages.filter(msg => !msg.isLoading && !msg.error); // Don't include loading or error messages in history for API
  
  return historyMessages.map(msg => {
    const parts: object[] = [];
    if (msg.textPart && msg.textPart.trim() !== "") {
      parts.push({ text: msg.textPart.trim() });
    }
    if (msg.fileParts) {
      msg.fileParts.forEach(fp => {
        // Remove data URL prefix for Gemini API
        const base64Data = fp.data.substring(fp.data.indexOf(',') + 1);
        parts.push({
          inlineData: {
            mimeType: fp.mimeType,
            data: base64Data
          }
        });
      });
    }
    return {
      role: msg.sender === Sender.USER ? 'user' : 'model',
      parts: parts,
    };
  }).filter(entry => entry.parts.length > 0); // Ensure we don't send empty parts arrays
};


export const generateChatTitle = (firstUserMessageText?: string, files?: FilePart[]): string => {
  if (firstUserMessageText) {
    const words = firstUserMessageText.split(' ');
    if (words.length > 5) {
      return words.slice(0, 5).join(' ') + '...';
    }
    return firstUserMessageText;
  }
  if (files && files.length > 0) {
    if (files.length === 1) {
      const fileName = files[0].name;
      return fileName.length > 30 ? fileName.substring(0,27) + "..." : fileName;
    }
    const commonType = files.every(f => f.mimeType.startsWith('image/')) ? "Images" : "Files";
    const firstFileName = files[0].name.length > 15 ? files[0].name.substring(0,12) + "..." : files[0].name;
    return `${files.length} ${commonType} (e.g. ${firstFileName})`;
  }
  return `Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

// Theme Utilities
export const loadTheme = (): Theme => {
  const savedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
  return savedTheme || Theme.SYSTEM;
};

export const saveTheme = (theme: Theme): void => {
  localStorage.setItem(THEME_KEY, theme);
};

export const applyTheme = (theme: Theme): void => {
  const root = document.documentElement;
  const isDarkSystem = window.matchMedia('(prefers-color-scheme: dark)').matches;

  // HLJS theme links
  const lightThemeLink = document.getElementById('hljs-light-theme') as HTMLLinkElement | null;
  const darkThemeLink = document.getElementById('hljs-dark-theme') as HTMLLinkElement | null;

  if (theme === Theme.DARK || (theme === Theme.SYSTEM && isDarkSystem)) {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
    if (lightThemeLink) lightThemeLink.disabled = true;
    if (darkThemeLink) darkThemeLink.disabled = false;
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
    if (lightThemeLink) lightThemeLink.disabled = false;
    if (darkThemeLink) darkThemeLink.disabled = true;
  }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};
