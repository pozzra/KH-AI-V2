
import { GoogleGenAI, Chat, GenerateContentResponse, Content, Part as GeminiPart } from "@google/genai";
import { ChatMessage, Part as AppPart, TextPart, InlineDataPart } from '../types';

// Helper to convert app messages to Gemini API's Content format
const convertMessagesToGeminiHistory = (messages: ChatMessage[]): Content[] => {
  return messages.map(msg => {
    const parts: GeminiPart[] = msg.parts.map(p => {
      if ((p as TextPart).text !== undefined) {
        return { text: (p as TextPart).text };
      } else if ((p as InlineDataPart).inlineData !== undefined) {
        return { inlineData: (p as InlineDataPart).inlineData };
      }
      // Fallback for unknown part types, though ideally all parts should match defined types
      return { text: '[Unsupported part]' }; 
    }).filter(part => part !== null) as GeminiPart[]; // Ensure no null parts if filtering occurs

    return {
      role: msg.role,
      parts: parts,
    };
  });
};


export class GeminiService {
  private ai: GoogleGenAI;
  private chatInstances: Map<string, Chat>;
  private readonly modelName = 'gemini-2.5-flash-preview-04-17';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Gemini API key is required.");
    }
    this.ai = new GoogleGenAI({ apiKey });
    this.chatInstances = new Map<string, Chat>();
  }

  private getOrCreateChat(sessionId: string, history: Content[] = []): Chat {
    if (this.chatInstances.has(sessionId)) {
      return this.chatInstances.get(sessionId)!;
    }
    
    const chat = this.ai.chats.create({
      model: this.modelName,
      history: history, 
      config: {
        // systemInstruction: "You are a versatile AI assistant that can speak Khmer.",
      }
    });
    this.chatInstances.set(sessionId, chat);
    return chat;
  }

  public async generateChatResponseStream(
    sessionId: string,
    currentSessionMessages: ChatMessage[]
  ): Promise<AsyncIterable<GenerateContentResponse>> {
    const historyForGemini = convertMessagesToGeminiHistory(currentSessionMessages.slice(0, -1));
    const latestUserMessage = currentSessionMessages[currentSessionMessages.length - 1];

    if (!latestUserMessage || latestUserMessage.role !== 'user') {
        throw new Error("Last message must be from user to generate response.");
    }

    const chat = this.getOrCreateChat(sessionId, historyForGemini);
    
    const userMessageParts: GeminiPart[] = latestUserMessage.parts.map(p => {
        if ((p as TextPart).text !== undefined) return { text: (p as TextPart).text };
        if ((p as InlineDataPart).inlineData !== undefined) return { inlineData: (p as InlineDataPart).inlineData };
        return { text: '' }; 
    }).filter(p => (p.text && p.text.length > 0) || p.inlineData); 

    if (userMessageParts.length === 0) {
      throw new Error("Cannot send a message with no valid content parts (text or image).");
    }

    try {
        const result = await chat.sendMessageStream({ message: userMessageParts });
        return result;
    } catch (error) {
        console.error("Error in sendMessageStream:", error);
        throw error; 
    }
  }
  
  public deleteChatInstance(sessionId: string): void {
    this.chatInstances.delete(sessionId);
  }

  public clearAllChatInstances(): void {
    this.chatInstances.clear();
  }
}