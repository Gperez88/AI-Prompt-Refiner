import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigurationManager } from '../services/ConfigurationManager';
import * as vscode from 'vscode';

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;
  let mockConfig: any;
  let mockSecrets: any;
  let mockContext: any;

  beforeEach(() => {
    // Reset singleton
    (ConfigurationManager as any).instance = undefined;
    
    configManager = ConfigurationManager.getInstance();
    
    mockSecrets = {
      get: vi.fn(),
      store: vi.fn(),
    };
    
    mockContext = {
      secrets: mockSecrets,
    };
    
    // Mock that properly handles default values
    mockConfig = {
      get: vi.fn((key: string, defaultValue?: any) => defaultValue),
      update: vi.fn(),
    };
    
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig);
    configManager.initialize(mockContext as any);
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ConfigurationManager.getInstance();
      const instance2 = ConfigurationManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getProviderId', () => {
    it('should return default provider when not configured', () => {
      // mockConfig.get returns defaultValue when called
      const provider = configManager.getProviderId();
      expect(provider).toBe('github');
    });

    it('should return configured provider', () => {
      mockConfig.get.mockReturnValue('openai');
      const provider = configManager.getProviderId();
      expect(provider).toBe('openai');
    });
  });

  describe('getModelId', () => {
    it('should return default model when not configured', () => {
      const model = configManager.getModelId();
      expect(model).toBe('gpt-4o-mini');
    });

    it('should return configured model', () => {
      mockConfig.get.mockReturnValue('gpt-4o');
      const model = configManager.getModelId();
      expect(model).toBe('gpt-4o');
    });
  });

  describe('setProviderId', () => {
    it('should update provider configuration', async () => {
      await configManager.setProviderId('gemini');
      expect(mockConfig.update).toHaveBeenCalledWith(
        'provider',
        'gemini',
        vscode.ConfigurationTarget.Global
      );
    });
  });

  describe('setModelId', () => {
    it('should update model configuration', async () => {
      await configManager.setModelId('gemini-pro');
      expect(mockConfig.update).toHaveBeenCalledWith(
        'model',
        'gemini-pro',
        vscode.ConfigurationTarget.Global
      );
    });
  });

  describe('isStrictMode', () => {
    it('should return true by default', () => {
      const isStrict = configManager.isStrictMode();
      expect(isStrict).toBe(true);
    });

    it('should return configured strict mode', () => {
      mockConfig.get.mockReturnValue(false);
      const isStrict = configManager.isStrictMode();
      expect(isStrict).toBe(false);
    });
  });

  describe('API Key Management', () => {
    it('should return undefined when secrets not initialized', async () => {
      configManager.initialize({} as any);
      const key = await configManager.getApiKey('openai');
      expect(key).toBeUndefined();
    });

    it('should store API key securely', async () => {
      await configManager.setApiKey('openai', 'test-api-key');
      expect(mockSecrets.store).toHaveBeenCalledWith(
        'promptRefiner.openai.apiKey',
        'test-api-key'
      );
    });

    it('should retrieve API key from secrets', async () => {
      mockSecrets.get.mockResolvedValue('stored-api-key');
      const key = await configManager.getApiKey('openai');
      expect(key).toBe('stored-api-key');
      expect(mockSecrets.get).toHaveBeenCalledWith('promptRefiner.openai.apiKey');
    });

    it('should throw error when setting key without secrets', async () => {
      configManager.initialize({} as any);
      await expect(configManager.setApiKey('openai', 'key')).rejects.toThrow(
        'Secrets not initialized'
      );
    });
  });

  describe('getOllamaEndpoint', () => {
    it('should return default endpoint', () => {
      const endpoint = configManager.getOllamaEndpoint();
      expect(endpoint).toBe('http://localhost:11434');
    });

    it('should return configured endpoint', () => {
      mockConfig.get.mockReturnValue('http://custom:11434');
      const endpoint = configManager.getOllamaEndpoint();
      expect(endpoint).toBe('http://custom:11434');
    });
  });
});
