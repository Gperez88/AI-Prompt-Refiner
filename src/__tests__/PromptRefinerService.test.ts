import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { PromptRefinerService } from '../services/PromptRefinerService';
import { IProviderManager } from '../services/IProviderManager';
import { TemplateManager } from '../services/TemplateManager';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { IAIProvider } from '../providers/IAIProvider';
import { refinementCache } from '../utils/Cache';
import { clearCircuitBreakers } from '../utils/CircuitBreaker';
import * as fs from 'fs';
import * as vscode from 'vscode';

// Mock ConfigurationManager
vi.mock('../services/ConfigurationManager', () => ({
  ConfigurationManager: {
    getInstance: vi.fn(),
  }
}));

// Mock fs
vi.mock('fs');

describe('PromptRefinerService with DI', () => {
  let service: PromptRefinerService;
  let mockContext: any;
  let mockProviderManager: IProviderManager;
  let mockTemplateManager: TemplateManager;
  let mockProvider: IAIProvider & { refine: Mock };

  beforeEach(() => {
    // Clear cache and circuit breakers before each test
    refinementCache.clear();
    clearCircuitBreakers();
    
    // Setup default ConfigurationManager mock
    (ConfigurationManager.getInstance as any).mockReturnValue({
      initialize: vi.fn(),
      isStrictMode: vi.fn().mockReturnValue(true),
      getProviderId: vi.fn().mockReturnValue('mock'),
      getModelId: vi.fn().mockReturnValue('gpt-4o-mini'),
      getOllamaEndpoint: vi.fn().mockReturnValue('http://localhost:11434'),
    });
    
    // Create mock provider
    mockProvider = {
      id: 'mock',
      name: 'Mock Provider',
      isConfigured: vi.fn().mockReturnValue(true),
      refine: vi.fn(),
    } as any;
    
    // Setup default mock behavior
    (mockProvider.refine as any).mockResolvedValue('refined result');

    // Create mock provider manager
    mockProviderManager = {
      getActiveProvider: vi.fn().mockReturnValue(mockProvider),
      preloadProvider: vi.fn(),
      getLoadedCount: vi.fn().mockReturnValue(1),
      clear: vi.fn(),
    };

    // Create mock template manager
    mockTemplateManager = {
      getAllTemplates: vi.fn().mockResolvedValue([]),
      getCustomTemplates: vi.fn().mockResolvedValue([]),
      getTemplate: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn(),
    } as any;

    // Create service with DI
    service = PromptRefinerService.createWithDependencies(mockProviderManager, mockTemplateManager);
    
    mockContext = {
      asAbsolutePath: vi.fn((path: string) => `/test/${path}`),
      secrets: {
        get: vi.fn(),
        store: vi.fn(),
      },
    };
  });

  describe('Service Creation', () => {
    it('should create service with injected dependencies', () => {
      expect(service).toBeDefined();
      expect(mockProviderManager).toBeDefined();
      expect(mockTemplateManager).toBeDefined();
    });

    it('should use singleton pattern for getInstance', () => {
      const instance1 = PromptRefinerService.getInstance();
      const instance2 = PromptRefinerService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create separate instances with createWithDependencies', () => {
      const service1 = PromptRefinerService.createWithDependencies(mockProviderManager, mockTemplateManager);
      const service2 = PromptRefinerService.createWithDependencies(mockProviderManager, mockTemplateManager);
      expect(service1).not.toBe(service2);
    });
  });

  describe('refine', () => {
    beforeEach(() => {
      service.initialize(mockContext);
      vi.mocked(fs.readFileSync).mockReturnValue('template content');
    });

    it('should call provider refine with correct parameters', async () => {
      const userPrompt = 'user prompt';
      
      const result = await service.refine(userPrompt);

      expect(mockProvider.refine).toHaveBeenCalledWith(
        userPrompt,
        expect.any(String),
        expect.objectContaining({ strict: expect.any(Boolean) })
      );
      expect(result.refined).toBe('refined result');
      expect(result.templateUsed).toBe('default');
      expect(result.iteration).toBe(1);
    });

    it('should use strict template when strict mode is enabled', async () => {
      // Mock strict mode by checking template file path
      vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
        if (path.includes('strict')) {
          return 'strict template';
        }
        return 'normal template';
      });

      await service.refine('user prompt');

      // Should try to read strict template first
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('strict'),
        'utf-8'
      );
    });

    it('should return refined result with metadata', async () => {
      (mockProvider.refine as any).mockResolvedValue('improved prompt');
      
      const result = await service.refine('original prompt');

      expect(result.refined).toBe('improved prompt');
      expect(result.iteration).toBe(1);
      expect(result.templateUsed).toBeDefined();
    });

    it('should propagate provider errors', async () => {
      (mockProvider.refine as any).mockRejectedValue(new Error('Provider error'));

      await expect(service.refine('user prompt')).rejects.toThrow('Provider error');
    });

    it('should handle template loading errors', async () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(service.refine('user prompt')).rejects.toThrow();
    });

    it('should fallback to src path if dist path fails', async () => {
      let callCount = 0;
      vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Dist path failed');
        }
        return 'template content';
      });

      await service.refine('user prompt');

      expect(fs.readFileSync).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('dist'),
        'utf-8'
      );
      expect(fs.readFileSync).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('src'),
        'utf-8'
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw error if service not initialized', async () => {
      const uninitializedService = PromptRefinerService.createWithDependencies(
        mockProviderManager,
        mockTemplateManager
      );
      // Don't initialize
      
      await expect(uninitializedService.refine('test prompt')).rejects.toThrow(
        'Service not initialized'
      );
    });

    it('should handle provider manager errors gracefully', async () => {
      mockProviderManager.getActiveProvider = vi.fn().mockImplementation(() => {
        throw new Error('Provider manager error');
      });

      service.initialize(mockContext);
      vi.mocked(fs.readFileSync).mockReturnValue('template');

      await expect(service.refine('user prompt')).rejects.toThrow('Provider manager error');
    });
  });

  describe('Caching', () => {
    it('should cache results for identical prompts', async () => {
      service.initialize(mockContext);
      vi.mocked(fs.readFileSync).mockReturnValue('template');
      
      // First call
      await service.refine('same prompt');
      
      // Second call with same prompt should use cache
      await service.refine('same prompt');
      
      // Provider should only be called once due to cache
      expect(mockProvider.refine).toHaveBeenCalledTimes(1);
    });
  });
});
