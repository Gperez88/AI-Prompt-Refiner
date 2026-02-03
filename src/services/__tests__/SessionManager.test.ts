import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionManager, ChatSession, ChatMessage } from '../../../src/services/SessionManager';

// Mock VSCode API
const mockGlobalState = {
  get: vi.fn(),
  update: vi.fn(),
};

const mockContext = {
  globalState: mockGlobalState,
};

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    // Reset singleton instance
    (SessionManager as any).instance = undefined;
    sessionManager = SessionManager.getInstance();
    
    // Reset mocks
    vi.clearAllMocks();
    mockGlobalState.get.mockResolvedValue(null);
    mockGlobalState.update.mockResolvedValue(undefined);
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SessionManager.getInstance();
      const instance2 = SessionManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Initialization', () => {
    it('should initialize with empty storage when no data exists', async () => {
      mockGlobalState.get.mockResolvedValue(null);
      
      await sessionManager.initialize(mockContext as any);
      
      expect(mockGlobalState.get).toHaveBeenCalledWith('promptRefiner.chatSessions');
    });

    it('should load existing storage when available', async () => {
      const existingStorage = {
        version: 2,
        activeSessionId: 'session-1',
        sessions: [
          {
            id: 'session-1',
            name: 'Test Session',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [],
            isActive: true,
            metadata: { messageCount: 0 },
          },
        ],
        settings: { maxSessions: 50, autoSave: true, autoName: true },
      };
      
      mockGlobalState.get.mockResolvedValue(existingStorage);
      
      await sessionManager.initialize(mockContext as any);
      const activeSession = await sessionManager.getActiveSession();
      
      expect(activeSession).toBeDefined();
      expect(activeSession?.id).toBe('session-1');
    });
  });

  describe('Session Creation', () => {
    beforeEach(async () => {
      await sessionManager.initialize(mockContext as any);
    });

    it('should create a new session with custom name', async () => {
      const session = await sessionManager.createSession('My Test Session');
      
      expect(session).toBeDefined();
      expect(session.name).toBe('My Test Session');
      expect(session.id).toBeDefined();
      expect(session.messages).toEqual([]);
      expect(session.isActive).toBe(true);
    });

    it('should create a session with auto-generated name when none provided', async () => {
      const session = await sessionManager.createSession();
      
      expect(session).toBeDefined();
      expect(session.name).toMatch(/^Session \d+$/);
    });

    it('should set new session as active', async () => {
      const session = await sessionManager.createSession('Active Test');
      const activeSession = await sessionManager.getActiveSession();
      
      expect(activeSession?.id).toBe(session.id);
    });

    it('should archive oldest session when maxSessions reached', async () => {
      // Create 50 sessions (the default limit)
      for (let i = 0; i < 50; i++) {
        await sessionManager.createSession(`Session ${i}`);
      }
      
      // Creating one more should trigger archiving
      const newSession = await sessionManager.createSession('Overflow Session');
      
      expect(newSession).toBeDefined();
      
      // Verify archiving happened
      const allSessions = await sessionManager.getAllSessions({ includeArchived: true });
      const archivedCount = allSessions.filter(s => s.metadata.isArchived).length;
      expect(archivedCount).toBeGreaterThan(0);
    });
  });

  describe('Session Management', () => {
    let sessionId: string;

    beforeEach(async () => {
      await sessionManager.initialize(mockContext as any);
      const session = await sessionManager.createSession('Test Session');
      sessionId = session.id;
    });

    it('should get a session by ID', async () => {
      const session = await sessionManager.getSession(sessionId);
      
      expect(session).toBeDefined();
      expect(session?.id).toBe(sessionId);
    });

    it('should return null for non-existent session', async () => {
      const session = await sessionManager.getSession('non-existent-id');
      
      expect(session).toBeNull();
    });

    it('should rename a session', async () => {
      await sessionManager.renameSession(sessionId, 'New Name');
      const session = await sessionManager.getSession(sessionId);
      
      expect(session?.name).toBe('New Name');
    });

    it('should throw error when renaming with empty name', async () => {
      await expect(sessionManager.renameSession(sessionId, ''))
        .rejects.toThrow('Session name cannot be empty');
    });

    it('should delete a session', async () => {
      const result = await sessionManager.deleteSession(sessionId);
      
      expect(result).toBe(true);
      
      const session = await sessionManager.getSession(sessionId);
      expect(session).toBeNull();
    });

    it('should return false when deleting non-existent session', async () => {
      const result = await sessionManager.deleteSession('non-existent');
      
      expect(result).toBe(false);
    });

    it('should switch active session', async () => {
      const session2 = await sessionManager.createSession('Second Session');
      
      await sessionManager.setActiveSession(session2.id);
      
      const activeSession = await sessionManager.getActiveSession();
      expect(activeSession?.id).toBe(session2.id);
      expect(activeSession?.isActive).toBe(true);
    });

    it('should archive a session', async () => {
      await sessionManager.archiveSession(sessionId);
      
      const session = await sessionManager.getSession(sessionId);
      expect(session?.metadata.isArchived).toBe(true);
      expect(session?.isActive).toBe(false);
    });

    it('should unarchive a session', async () => {
      await sessionManager.archiveSession(sessionId);
      await sessionManager.unarchiveSession(sessionId);
      
      const session = await sessionManager.getSession(sessionId);
      expect(session?.metadata.isArchived).toBe(false);
    });
  });

  describe('Message Management', () => {
    let sessionId: string;

    beforeEach(async () => {
      await sessionManager.initialize(mockContext as any);
      const session = await sessionManager.createSession('Test Session');
      sessionId = session.id;
    });

    it('should add a message to session', async () => {
      const message = await sessionManager.addMessageToSession(sessionId, {
        role: 'user',
        content: 'Test message',
        provider: 'openai',
        model: 'gpt-4',
      });
      
      expect(message).toBeDefined();
      expect(message.role).toBe('user');
      expect(message.content).toBe('Test message');
      expect(message.id).toBeDefined();
      expect(message.timestamp).toBeDefined();
    });

    it('should get all messages from session', async () => {
      await sessionManager.addMessageToSession(sessionId, {
        role: 'user',
        content: 'Message 1',
      });
      await sessionManager.addMessageToSession(sessionId, {
        role: 'assistant',
        content: 'Message 2',
      });
      
      const messages = await sessionManager.getMessages(sessionId);
      
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('Message 1');
      expect(messages[1].content).toBe('Message 2');
    });

    it('should update a message', async () => {
      const message = await sessionManager.addMessageToSession(sessionId, {
        role: 'user',
        content: 'Original',
      });
      
      const updated = await sessionManager.updateMessage(sessionId, message.id, {
        content: 'Updated',
      });
      
      expect(updated).toBeDefined();
      expect(updated?.content).toBe('Updated');
    });

    it('should return null when updating non-existent message', async () => {
      const result = await sessionManager.updateMessage(sessionId, 'non-existent', {
        content: 'Updated',
      });
      
      expect(result).toBeNull();
    });

    it('should delete a message', async () => {
      const message = await sessionManager.addMessageToSession(sessionId, {
        role: 'user',
        content: 'To be deleted',
      });
      
      const result = await sessionManager.deleteMessage(sessionId, message.id);
      
      expect(result).toBe(true);
      
      const messages = await sessionManager.getMessages(sessionId);
      expect(messages).toHaveLength(0);
    });

    it('should update session metadata when adding messages', async () => {
      await sessionManager.addMessageToSession(sessionId, {
        role: 'user',
        content: 'Test message content',
        provider: 'openai',
        model: 'gpt-4',
      });
      
      const session = await sessionManager.getSession(sessionId);
      
      expect(session?.metadata.messageCount).toBe(1);
      expect(session?.metadata.lastMessagePreview).toBe('Test message content');
      expect(session?.metadata.provider).toBe('openai');
      expect(session?.metadata.model).toBe('gpt-4');
    });
  });

  describe('Search', () => {
    let sessionId1: string;
    let sessionId2: string;

    beforeEach(async () => {
      await sessionManager.initialize(mockContext as any);
      
      const session1 = await sessionManager.createSession('JavaScript Help');
      sessionId1 = session1.id;
      
      const session2 = await sessionManager.createSession('Python Tutorial');
      sessionId2 = session2.id;
      
      await sessionManager.addMessageToSession(sessionId1, {
        role: 'user',
        content: 'How do I use async/await in JavaScript?',
      });
      await sessionManager.addMessageToSession(sessionId1, {
        role: 'assistant',
        content: 'Here is how you use async/await...',
      });
      
      await sessionManager.addMessageToSession(sessionId2, {
        role: 'user',
        content: 'Python list comprehension example',
      });
    });

    it('should search across all sessions', async () => {
      const results = await sessionManager.searchSessions('javascript');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('JavaScript Help');
    });

    it('should search by message content', async () => {
      const results = await sessionManager.searchSessions('async/await');
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(sessionId1);
    });

    it('should return all sessions when query is empty', async () => {
      const results = await sessionManager.searchSessions('');
      
      expect(results).toHaveLength(2);
    });

    it('should search messages within a specific session', async () => {
      const messages = await sessionManager.searchMessages(sessionId1, 'async');
      
      expect(messages).toHaveLength(2);
    });
  });

  describe('Export/Import', () => {
    let sessionId: string;

    beforeEach(async () => {
      await sessionManager.initialize(mockContext as any);
      const session = await sessionManager.createSession('Export Test');
      sessionId = session.id;
      
      await sessionManager.addMessageToSession(sessionId, {
        role: 'user',
        content: 'Hello',
      });
      await sessionManager.addMessageToSession(sessionId, {
        role: 'assistant',
        content: 'Hi there!',
      });
    });

    it('should export a session to JSON', async () => {
      const json = await sessionManager.exportSession(sessionId);
      
      expect(json).toBeDefined();
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(2);
      expect(parsed.session).toBeDefined();
      expect(parsed.session.name).toBe('Export Test');
      expect(parsed.session.messages).toHaveLength(2);
    });

    it('should import a session from JSON', async () => {
      const json = await sessionManager.exportSession(sessionId);
      
      const imported = await sessionManager.importSession(json);
      
      expect(imported).toBeDefined();
      expect(imported.name).toBe('Export Test');
      expect(imported.id).not.toBe(sessionId); // Should have new ID
      expect(imported.messages).toHaveLength(2);
    });

    it('should throw error when importing invalid JSON', async () => {
      await expect(sessionManager.importSession('invalid json'))
        .rejects.toThrow();
    });
  });

  describe('Migration', () => {
    it('should migrate legacy chat history', async () => {
      const legacyHistory = [
        {
          id: 'msg-1',
          role: 'user' as const,
          content: 'Legacy message 1',
          timestamp: Date.now(),
          provider: 'openai',
          model: 'gpt-4',
        },
        {
          id: 'msg-2',
          role: 'assistant' as const,
          content: 'Legacy message 2',
          timestamp: Date.now(),
          provider: 'openai',
          model: 'gpt-4',
        },
      ];
      
      mockGlobalState.get
        .mockResolvedValueOnce(null) // No new format
        .mockResolvedValueOnce(legacyHistory); // Legacy format
      
      const result = await sessionManager.initialize(mockContext as any);
      
      const activeSession = await sessionManager.getActiveSession();
      expect(activeSession).toBeDefined();
      expect(activeSession?.name).toBe('Legacy Session');
      expect(activeSession?.messages).toHaveLength(2);
    });

    it('should handle empty legacy data gracefully', async () => {
      mockGlobalState.get.mockResolvedValue(null);
      
      await sessionManager.initialize(mockContext as any);
      
      const activeSession = await sessionManager.getActiveSession();
      expect(activeSession).toBeNull();
    });
  });

  describe('Session Stats', () => {
    beforeEach(async () => {
      await sessionManager.initialize(mockContext as any);
      
      const session1 = await sessionManager.createSession('Session 1');
      await sessionManager.addMessageToSession(session1.id, { role: 'user', content: 'Hello' });
      
      const session2 = await sessionManager.createSession('Session 2');
      await sessionManager.addMessageToSession(session2.id, { role: 'user', content: 'World' });
      await sessionManager.addMessageToSession(session2.id, { role: 'assistant', content: 'Hi' });
      
      await sessionManager.archiveSession(session2.id);
    });

    it('should return correct stats', async () => {
      const stats = await sessionManager.getStats();
      
      expect(stats.totalSessions).toBe(2);
      expect(stats.activeSessions).toBe(1);
      expect(stats.archivedSessions).toBe(1);
      expect(stats.totalMessages).toBe(3);
    });
  });

  describe('Settings', () => {
    beforeEach(async () => {
      await sessionManager.initialize(mockContext as any);
    });

    it('should get default settings', async () => {
      const settings = await sessionManager.getSettings();
      
      expect(settings.maxSessions).toBe(50);
      expect(settings.autoSave).toBe(true);
      expect(settings.autoName).toBe(true);
    });

    it('should update settings', async () => {
      await sessionManager.updateSettings({ maxSessions: 100 });
      
      const settings = await sessionManager.getSettings();
      expect(settings.maxSessions).toBe(100);
    });
  });

  describe('Auto-naming', () => {
    it('should suggest session name from first message', async () => {
      const suggestion = await sessionManager.suggestSessionName(
        'How do I implement authentication in React'
      );
      
      // Takes first 5 words, capitalizes first letter, truncates to 30 chars + "..."
      // "How do I implement authentication" = 33 chars, truncated to "How do I implement authenticat..."
      expect(suggestion).toBe('How do I implement authenticat...');
    });

    it('should truncate long suggestions', async () => {
      const longMessage = 'a'.repeat(50);
      const suggestion = await sessionManager.suggestSessionName(longMessage);
      
      expect(suggestion.length).toBeLessThanOrEqual(33); // 30 + '...'
    });
  });
});
