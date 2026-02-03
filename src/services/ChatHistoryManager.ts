import * as vscode from 'vscode';
import { randomBytes } from 'crypto';
import { logger } from './Logger';

/**
 * Represents a single message in the chat history
 */
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'error';
    content: string;
    timestamp: number;
    provider?: string;
    model?: string;
}

/**
 * Manages chat history persistence using VSCode's globalState
 */
export class ChatHistoryManager {
    private static instance: ChatHistoryManager;
    private context?: vscode.ExtensionContext;
    private readonly STORAGE_KEY = 'promptRefiner.chatHistory';
    private readonly MAX_HISTORY_SIZE = 50;

    private constructor() {
        // Private constructor to prevent direct instantiation - use getInstance()
    }

    /**
     * Get the singleton instance
     */
    public static getInstance(): ChatHistoryManager {
        if (!ChatHistoryManager.instance) {
            ChatHistoryManager.instance = new ChatHistoryManager();
        }
        return ChatHistoryManager.instance;
    }

    /**
     * Initialize the manager with extension context
     */
    public initialize(context: vscode.ExtensionContext): void {
        this.context = context;
        logger.debug('ChatHistoryManager initialized');
    }

    /**
     * Get all chat messages from history
     */
    public async getHistory(): Promise<ChatMessage[]> {
        if (!this.context) {
            logger.warn('ChatHistoryManager not initialized');
            return [];
        }

        try {
            const history = await this.context.globalState.get<ChatMessage[]>(this.STORAGE_KEY, []);
            return history;
        } catch (error) {
            logger.error('Failed to load chat history', error as Error);
            return [];
        }
    }

    /**
     * Add a new message to history
     */
    public async addMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
        if (!this.context) {
            logger.warn('ChatHistoryManager not initialized');
            throw new Error('ChatHistoryManager not initialized');
        }

        const newMessage: ChatMessage = {
            ...message,
            id: this.generateId(),
            timestamp: Date.now(),
        };

        try {
            const history = await this.getHistory();
            history.push(newMessage);

            // Keep only the last MAX_HISTORY_SIZE messages
            if (history.length > this.MAX_HISTORY_SIZE) {
                history.splice(0, history.length - this.MAX_HISTORY_SIZE);
            }

            await this.context.globalState.update(this.STORAGE_KEY, history);
            logger.debug('Message added to history', { messageId: newMessage.id });
            
            return newMessage;
        } catch (error) {
            logger.error('Failed to save message to history', error as Error);
            throw error;
        }
    }

    /**
     * Update an existing message
     */
    public async updateMessage(id: string, updates: Partial<ChatMessage>): Promise<ChatMessage | null> {
        if (!this.context) {
            logger.warn('ChatHistoryManager not initialized');
            return null;
        }

        try {
            const history = await this.getHistory();
            const index = history.findIndex(m => m.id === id);
            
            if (index === -1) {
                logger.warn('Message not found for update', { messageId: id });
                return null;
            }

            history[index] = { ...history[index], ...updates };
            await this.context.globalState.update(this.STORAGE_KEY, history);
            
            logger.debug('Message updated', { messageId: id });
            return history[index];
        } catch (error) {
            logger.error('Failed to update message', error as Error);
            throw error;
        }
    }

    /**
     * Delete a message from history
     */
    public async deleteMessage(id: string): Promise<boolean> {
        if (!this.context) {
            logger.warn('ChatHistoryManager not initialized');
            return false;
        }

        try {
            const history = await this.getHistory();
            const filtered = history.filter(m => m.id !== id);
            
            if (filtered.length === history.length) {
                logger.warn('Message not found for deletion', { messageId: id });
                return false;
            }

            await this.context.globalState.update(this.STORAGE_KEY, filtered);
            logger.debug('Message deleted', { messageId: id });
            return true;
        } catch (error) {
            logger.error('Failed to delete message', error as Error);
            throw error;
        }
    }

    /**
     * Clear all chat history
     */
    public async clearHistory(): Promise<void> {
        if (!this.context) {
            logger.warn('ChatHistoryManager not initialized');
            return;
        }

        try {
            await this.context.globalState.update(this.STORAGE_KEY, []);
            logger.info('Chat history cleared');
        } catch (error) {
            logger.error('Failed to clear history', error as Error);
            throw error;
        }
    }

    /**
     * Search through chat history
     */
    public async searchHistory(query: string): Promise<ChatMessage[]> {
        const history = await this.getHistory();
        const lowerQuery = query.toLowerCase();
        
        return history.filter(msg => 
            msg.content.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Generate a unique ID for messages using cryptographically secure randomness
     */
    private generateId(): string {
        return `${Date.now()}-${randomBytes(8).toString('hex')}`;
    }
}
