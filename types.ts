export enum Sender {
  USER = 'user',
  AI = 'ai',
}

export interface FilePart {
  name: string;
  mimeType: string;
  data: string; // base64 encoded string, might include data:mime/type;base64, prefix for client use
  // rawData?: string; // base64 string without prefix for API use - handled during API call
}

export interface ChatMessage {
  id: string;
  sender: Sender;
  timestamp: Date;
  textPart?: string; // Text content of the message
  fileParts?: FilePart[]; // Array of files attached to the message
  isLoading?: boolean; // Used for AI messages while streaming
  error?: string; // To display an error related to this message
}

export interface ChatHistoryItem {
  id:string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  lastUpdatedAt: Date;
}

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

export enum RecognitionLanguage {
  EN_US = 'en-US',
  KM_KH = 'km-KH',
} 