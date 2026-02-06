import * as vscode from 'vscode';
import { randomBytes } from 'crypto';
import { logger } from './Logger';
import { RoleId, DEFAULT_ROLE_ID, isValidRoleId } from '../types/Role';

/**
 * Represents a single message in a chat session
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
 * Metadata for a chat session
 */
export interface SessionMetadata {
    messageCount: number;
    lastMessagePreview?: string;
    provider?: string;
    model?: string;
    tags?: string[];
    isArchived?: boolean;
    /**
     * The role/persona for this session
     * @default 'programmer'
     */
    role?: RoleId;
}

/**
 * Represents a chat session containing multiple messages
 */
export interface ChatSession {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    messages: ChatMessage[];
    isActive: boolean;
    metadata: SessionMetadata;
}

/**
 * Root storage structure for all sessions
 */
export interface SessionStorage {
    version: number;
    activeSessionId: string | null;
    sessions: ChatSession[];
    settings: SessionSettings;
}

/**
 * Settings for session management
 */
export interface SessionSettings {
    maxSessions: number;
    autoSave: boolean;
    autoName: boolean;
    archiveAfterDays?: number;
}

/**
 * Default session settings
 */
const DEFAULT_SETTINGS: SessionSettings = {
    maxSessions: 50,
    autoSave: true,
    autoName: true,
    archiveAfterDays: 30,
};

/**
 * Storage keys for VSCode globalState
 */
const STORAGE_KEY = 'promptRefiner.chatSessions';
const STORAGE_KEY_LEGACY = 'promptRefiner.chatHistory';
const CURRENT_STORAGE_VERSION = 2;

/**
 * Manages multiple chat sessions with persistence in VSCode globalState
 */
export class SessionManager {
    private static instance: SessionManager;
    private context?: vscode.ExtensionContext;
    private storage: SessionStorage;

    private constructor() {
        this.storage = this.getDefaultStorage();
    }

    /**
     * Get the singleton instance
     */
    public static getInstance(): SessionManager {
        if (!SessionManager.instance) {
            SessionManager.instance = new SessionManager();
        }
        return SessionManager.instance;
    }

    /**
     * Initialize the manager with extension context
     * This will also attempt to migrate legacy data if present
     */
    public async initialize(context: vscode.ExtensionContext): Promise<void> {
        this.context = context;
        
        try {
            // Try to load existing storage
            const savedStorage = await this.context.globalState.get<SessionStorage>(STORAGE_KEY);
            
            if (savedStorage) {
                this.storage = savedStorage;
                logger.info('SessionManager initialized', {
                    sessionCount: this.storage.sessions.length,
                    activeSession: this.storage.activeSessionId
                });
                // Migrate session roles for existing sessions
                await this.migrateSessionRoles();
            } else {
                // No existing storage, check for legacy data
                await this.migrateFromLegacy();
            }
        } catch (error) {
            logger.error('Failed to initialize SessionManager', error as Error);
            // Initialize with empty storage as fallback
            this.storage = this.getDefaultStorage();
        }
    }

    /**
     * Get default empty storage structure
     */
    private getDefaultStorage(): SessionStorage {
        return {
            version: CURRENT_STORAGE_VERSION,
            activeSessionId: null,
            sessions: [],
            settings: { ...DEFAULT_SETTINGS },
        };
    }

    /**
     * Persist current storage to globalState
     */
    private async persist(): Promise<void> {
        if (!this.context) {
            logger.warn('SessionManager not initialized, cannot persist');
            return;
        }

        try {
            await this.context.globalState.update(STORAGE_KEY, this.storage);
            logger.debug('Session storage persisted', { 
                sessionCount: this.storage.sessions.length 
            });
        } catch (error) {
            logger.error('Failed to persist session storage', error as Error);
            throw error;
        }
    }

    // ==================== SESSION MANAGEMENT ====================

    /**
     * Create a new chat session
     * @param name Optional session name (auto-generated if not provided)
     * @param role Optional role/persona for the session (defaults to programmer)
     * @returns The created session
     */
    public async createSession(name?: string, role?: RoleId): Promise<ChatSession> {
        if (!this.context) {
            throw new Error('SessionManager not initialized');
        }

        // Check session limit
        if (this.storage.sessions.length >= this.storage.settings.maxSessions) {
            // Archive oldest non-active session
            await this.archiveOldestSession();
        }

        const now = Date.now();
        const sessionName = name || `Session ${this.storage.sessions.length + 1}`;

        // Validate and default role
        const sessionRole = role && isValidRoleId(role) ? role : DEFAULT_ROLE_ID;

        const newSession: ChatSession = {
            id: this.generateId(),
            name: sessionName,
            createdAt: now,
            updatedAt: now,
            messages: [],
            isActive: true,
            metadata: {
                messageCount: 0,
                role: sessionRole,
            },
        };

        // Deactivate current active session
        if (this.storage.activeSessionId) {
            const currentActive = this.getSessionById(this.storage.activeSessionId);
            if (currentActive) {
                currentActive.isActive = false;
            }
        }

        // Add new session and set as active
        this.storage.sessions.push(newSession);
        this.storage.activeSessionId = newSession.id;

        await this.persist();
        
        logger.info('Created new session', { sessionId: newSession.id, name: sessionName });
        
        return newSession;
    }

    /**
     * Get a session by ID
     */
    public async getSession(id: string): Promise<ChatSession | null> {
        return this.getSessionById(id);
    }

    /**
     * Get session by ID (internal, non-async version)
     */
    private getSessionById(id: string): ChatSession | null {
        return this.storage.sessions.find(s => s.id === id) || null;
    }

    /**
     * Update session properties
     */
    public async updateSession(id: string, updates: Partial<ChatSession>): Promise<ChatSession> {
        const session = this.getSessionById(id);
        if (!session) {
            throw new Error(`Session not found: ${id}`);
        }

        Object.assign(session, updates, { updatedAt: Date.now() });
        await this.persist();

        logger.debug('Session updated', { sessionId: id, updates: Object.keys(updates) });
        
        return session;
    }

    /**
     * Rename a session
     */
    public async renameSession(id: string, newName: string): Promise<ChatSession> {
        if (!newName.trim()) {
            throw new Error('Session name cannot be empty');
        }

        return this.updateSession(id, { name: newName.trim() });
    }

    /**
     * Delete a session permanently
     */
    public async deleteSession(id: string): Promise<boolean> {
        const index = this.storage.sessions.findIndex(s => s.id === id);
        if (index === -1) {
            logger.warn('Session not found for deletion', { sessionId: id });
            return false;
        }

        this.storage.sessions.splice(index, 1);

        // If deleted session was active, activate another one or set to null
        if (this.storage.activeSessionId === id) {
            const remainingSessions = this.storage.sessions.filter(s => !s.metadata.isArchived);
            this.storage.activeSessionId = remainingSessions.length > 0 ? remainingSessions[0].id : null;
            
            if (this.storage.activeSessionId) {
                const newActive = this.getSessionById(this.storage.activeSessionId);
                if (newActive) {
                    newActive.isActive = true;
                }
            }
        }

        await this.persist();
        
        logger.info('Session deleted', { sessionId: id });
        
        return true;
    }

    /**
     * Get the currently active session
     */
    public async getActiveSession(): Promise<ChatSession | null> {
        if (!this.storage.activeSessionId) {
            return null;
        }

        const session = this.getSessionById(this.storage.activeSessionId);
        
        // If active session not found, clear the reference
        if (!session) {
            this.storage.activeSessionId = null;
            return null;
        }

        return session;
    }

    /**
     * Set a session as the active one
     */
    public async setActiveSession(id: string): Promise<void> {
        const newActive = this.getSessionById(id);
        if (!newActive) {
            throw new Error(`Session not found: ${id}`);
        }

        // Deactivate current
        if (this.storage.activeSessionId) {
            const current = this.getSessionById(this.storage.activeSessionId);
            if (current) {
                current.isActive = false;
            }
        }

        // Activate new
        newActive.isActive = true;
        this.storage.activeSessionId = id;

        await this.persist();
        
        logger.debug('Active session changed', { sessionId: id });
    }

    /**
     * Get all sessions
     */
    public async getAllSessions(options?: { includeArchived?: boolean }): Promise<ChatSession[]> {
        const { includeArchived = false } = options || {};

        if (includeArchived) {
            return [...this.storage.sessions];
        }

        return this.storage.sessions.filter(s => !s.metadata.isArchived);
    }

    /**
     * Clear all sessions permanently
     */
    public async clearAllSessions(): Promise<void> {
        this.storage.sessions = [];
        this.storage.activeSessionId = null;
        await this.persist();

        logger.info('All sessions cleared');
    }

    /**
     * Archive a session (hide from main list but keep data)
     */
    public async archiveSession(id: string): Promise<void> {
        const session = this.getSessionById(id);
        if (!session) {
            throw new Error(`Session not found: ${id}`);
        }

        session.metadata.isArchived = true;
        session.isActive = false;

        // If archiving active session, switch to another
        if (this.storage.activeSessionId === id) {
            const unarchived = this.storage.sessions.filter(s => 
                !s.metadata.isArchived && s.id !== id
            );
            
            if (unarchived.length > 0) {
                await this.setActiveSession(unarchived[0].id);
            } else {
                this.storage.activeSessionId = null;
            }
        }

        await this.persist();
        
        logger.info('Session archived', { sessionId: id });
    }

    /**
     * Unarchive a session
     */
    public async unarchiveSession(id: string): Promise<void> {
        const session = this.getSessionById(id);
        if (!session) {
            throw new Error(`Session not found: ${id}`);
        }

        session.metadata.isArchived = false;
        await this.persist();
        
        logger.info('Session unarchived', { sessionId: id });
    }

    /**
     * Archive the oldest non-active session when limit reached
     */
    private async archiveOldestSession(): Promise<void> {
        const nonActiveSessions = this.storage.sessions
            .filter(s => !s.isActive && !s.metadata.isArchived)
            .sort((a, b) => a.updatedAt - b.updatedAt);

        if (nonActiveSessions.length > 0) {
            await this.archiveSession(nonActiveSessions[0].id);
            logger.debug('Auto-archived oldest session', { sessionId: nonActiveSessions[0].id });
        }
    }

    // ==================== MESSAGE MANAGEMENT ====================

    /**
     * Add a message to a specific session
     */
    public async addMessageToSession(
        sessionId: string, 
        message: Omit<ChatMessage, 'id' | 'timestamp'>
    ): Promise<ChatMessage> {
        const session = this.getSessionById(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        const newMessage: ChatMessage = {
            ...message,
            id: this.generateId(),
            timestamp: Date.now(),
        };

        session.messages.push(newMessage);
        session.updatedAt = Date.now();
        session.metadata.messageCount = session.messages.length;
        session.metadata.lastMessagePreview = newMessage.content.substring(0, 50);

        // Auto-update provider/model metadata from first message
        if (session.messages.length === 1) {
            session.metadata.provider = message.provider;
            session.metadata.model = message.model;
        }

        await this.persist();
        
        logger.debug('Message added to session', { 
            sessionId, 
            messageId: newMessage.id,
            role: newMessage.role 
        });
        
        return newMessage;
    }

    /**
     * Get all messages from a session
     */
    public async getMessages(sessionId: string): Promise<ChatMessage[]> {
        const session = this.getSessionById(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        return [...session.messages];
    }

    /**
     * Update a message in a session
     */
    public async updateMessage(
        sessionId: string, 
        messageId: string, 
        updates: Partial<ChatMessage>
    ): Promise<ChatMessage | null> {
        const session = this.getSessionById(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        const message = session.messages.find(m => m.id === messageId);
        if (!message) {
            logger.warn('Message not found for update', { sessionId, messageId });
            return null;
        }

        Object.assign(message, updates);
        session.updatedAt = Date.now();

        await this.persist();
        
        logger.debug('Message updated', { sessionId, messageId });
        
        return message;
    }

    /**
     * Delete a message from a session
     */
    public async deleteMessage(sessionId: string, messageId: string): Promise<boolean> {
        const session = this.getSessionById(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        const index = session.messages.findIndex(m => m.id === messageId);
        if (index === -1) {
            return false;
        }

        session.messages.splice(index, 1);
        session.metadata.messageCount = session.messages.length;
        
        // Update preview if deleted was the last message
        if (session.messages.length > 0) {
            const lastMsg = session.messages[session.messages.length - 1];
            session.metadata.lastMessagePreview = lastMsg.content.substring(0, 50);
        } else {
            session.metadata.lastMessagePreview = undefined;
        }

        await this.persist();
        
        logger.debug('Message deleted', { sessionId, messageId });
        
        return true;
    }

    /**
     * Clear all messages from a session (but keep the session)
     */
    public async clearSessionMessages(sessionId: string): Promise<void> {
        const session = this.getSessionById(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        session.messages = [];
        session.metadata.messageCount = 0;
        session.metadata.lastMessagePreview = undefined;
        session.updatedAt = Date.now();

        await this.persist();
        
        logger.info('Session messages cleared', { sessionId });
    }

    // ==================== SEARCH ====================

    /**
     * Search across all sessions
     */
    public async searchSessions(query: string): Promise<ChatSession[]> {
        const lowerQuery = query.toLowerCase().trim();
        if (!lowerQuery) {
            return this.getAllSessions();
        }

        return this.storage.sessions.filter(session => {
            // Search in session name
            if (session.name.toLowerCase().includes(lowerQuery)) {
                return true;
            }

            // Search in message content
            return session.messages.some(msg => 
                msg.content.toLowerCase().includes(lowerQuery)
            );
        });
    }

    /**
     * Search messages within a specific session
     */
    public async searchMessages(sessionId: string, query: string): Promise<ChatMessage[]> {
        const session = this.getSessionById(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        const lowerQuery = query.toLowerCase().trim();
        if (!lowerQuery) {
            return [...session.messages];
        }

        return session.messages.filter(msg => 
            msg.content.toLowerCase().includes(lowerQuery)
        );
    }

    // ==================== EXPORT/IMPORT ====================

    /**
     * Export a session to JSON string
     */
    public async exportSession(id: string): Promise<string> {
        const session = this.getSessionById(id);
        if (!session) {
            throw new Error(`Session not found: ${id}`);
        }

        const exportData = {
            version: CURRENT_STORAGE_VERSION,
            exportedAt: Date.now(),
            session,
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Import a session from JSON string
     */
    public async importSession(jsonString: string): Promise<ChatSession> {
        try {
            const data = JSON.parse(jsonString);
            
            // Validate structure
            if (!data.session || !data.session.name || !Array.isArray(data.session.messages)) {
                throw new Error('Invalid session format');
            }

            // Create new session with imported data
            const now = Date.now();
            const importedSession: ChatSession = {
                ...data.session,
                id: this.generateId(), // Generate new ID to avoid conflicts
                createdAt: now,
                updatedAt: now,
                isActive: false, // Don't auto-activate imported sessions
                metadata: {
                    ...data.session.metadata,
                    isArchived: false,
                },
            };

            this.storage.sessions.push(importedSession);
            await this.persist();

            logger.info('Session imported', { 
                sessionId: importedSession.id, 
                name: importedSession.name 
            });

            return importedSession;
        } catch (error) {
            logger.error('Failed to import session', error as Error);
            throw new Error(`Failed to import session: ${(error as Error).message}`);
        }
    }

    /**
     * Export all sessions
     */
    public async exportAllSessions(): Promise<string> {
        const exportData = {
            version: CURRENT_STORAGE_VERSION,
            exportedAt: Date.now(),
            sessions: this.storage.sessions,
            settings: this.storage.settings,
        };

        return JSON.stringify(exportData, null, 2);
    }

    // ==================== MIGRATION ====================

    /**
     * Migrate legacy chat history to new session format
     */
    public async migrateFromLegacy(): Promise<boolean> {
        if (!this.context) {
            return false;
        }

        try {
            // Check for legacy data
            const legacyHistory = await this.context.globalState.get<Array<{
                id: string;
                role: 'user' | 'assistant' | 'error';
                content: string;
                timestamp: number;
                provider?: string;
                model?: string;
            }>>(STORAGE_KEY_LEGACY);

            if (!legacyHistory || legacyHistory.length === 0) {
                logger.debug('No legacy data found for migration');
                return false;
            }

            logger.info('Migrating legacy chat history', { messageCount: legacyHistory.length });

            // Create a new session from legacy data
            const now = Date.now();
            const migratedSession: ChatSession = {
                id: this.generateId(),
                name: 'Legacy Session',
                createdAt: legacyHistory[0]?.timestamp || now,
                updatedAt: legacyHistory[legacyHistory.length - 1]?.timestamp || now,
                messages: legacyHistory.map(msg => ({
                    ...msg,
                })),
                isActive: true,
                metadata: {
                    messageCount: legacyHistory.length,
                    lastMessagePreview: legacyHistory[legacyHistory.length - 1]?.content?.substring(0, 50),
                    provider: legacyHistory[0]?.provider,
                    model: legacyHistory[0]?.model,
                },
            };

            // Set as the only session
            this.storage.sessions = [migratedSession];
            this.storage.activeSessionId = migratedSession.id;

            // Persist new format
            await this.persist();

            // Optionally clear legacy data (commented out for safety)
            // await this.context.globalState.update(STORAGE_KEY_LEGACY, undefined);

            logger.info('Migration completed successfully', { 
                sessionId: migratedSession.id,
                messageCount: migratedSession.messages.length 
            });

            return true;
        } catch (error) {
            logger.error('Migration failed', error as Error);
            return false;
        }
    }

    // ==================== UTILITY ====================

    /**
     * Generate a unique ID using cryptographically secure randomness
     */
    private generateId(): string {
        return `${Date.now()}-${randomBytes(8).toString('hex')}`;
    }

    /**
     * Get current settings
     */
    public async getSettings(): Promise<SessionSettings> {
        return { ...this.storage.settings };
    }

    /**
     * Update settings
     */
    public async updateSettings(settings: Partial<SessionSettings>): Promise<void> {
        this.storage.settings = { ...this.storage.settings, ...settings };
        await this.persist();
        
        logger.debug('Settings updated', { settings: Object.keys(settings) });
    }

    /**
     * Suggest a name for a session based on first message
     * This is a simple heuristic - could be enhanced with AI
     */
    public async suggestSessionName(firstMessage: string): Promise<string> {
        // Extract first few words (up to 5)
        const words = firstMessage.split(' ').slice(0, 5);
        let suggestion = words.join(' ');
        
        // Truncate if too long
        if (suggestion.length > 30) {
            suggestion = suggestion.substring(0, 30) + '...';
        }
        
        // Capitalize first letter
        suggestion = suggestion.charAt(0).toUpperCase() + suggestion.slice(1);
        
        return suggestion || 'New Session';
    }

    /**
     * Get storage statistics
     */
    public async getStats(): Promise<{
        totalSessions: number;
        activeSessions: number;
        archivedSessions: number;
        totalMessages: number;
    }> {
        const totalSessions = this.storage.sessions.length;
        const archivedSessions = this.storage.sessions.filter(s => s.metadata.isArchived).length;
        const totalMessages = this.storage.sessions.reduce((sum, s) => sum + s.messages.length, 0);

        return {
            totalSessions,
            activeSessions: totalSessions - archivedSessions,
            archivedSessions,
            totalMessages,
        };
    }

    // ==================== ROLE MANAGEMENT ====================

    /**
     * Get the role of a session
     * @param sessionId The session ID
     * @returns The role ID (defaults to 'programmer' if not set)
     */
    public getSessionRole(sessionId: string): RoleId {
        const session = this.getSessionById(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        return session.metadata.role || DEFAULT_ROLE_ID;
    }

    /**
     * Update the role of a session
     * @param sessionId The session ID
     * @param role The new role ID
     */
    public async updateSessionRole(sessionId: string, role: RoleId): Promise<void> {
        const session = this.getSessionById(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        if (!isValidRoleId(role)) {
            throw new Error(`Invalid role: ${role}`);
        }

        session.metadata.role = role;
        session.updatedAt = Date.now();
        await this.persist();

        logger.info('Session role updated', { sessionId, role });
    }

    /**
     * Ensure all sessions have a role (migration helper)
     * Called during initialization to migrate existing sessions
     */
    private async migrateSessionRoles(): Promise<void> {
        let migrated = false;
        for (const session of this.storage.sessions) {
            if (!session.metadata.role) {
                session.metadata.role = DEFAULT_ROLE_ID;
                migrated = true;
            }
        }
        if (migrated) {
            await this.persist();
            logger.info('Migrated session roles to default', { count: this.storage.sessions.length });
        }
    }
}
