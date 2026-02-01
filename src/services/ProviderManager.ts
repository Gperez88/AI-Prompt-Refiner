import * as vscode from 'vscode';
import { IAIProvider } from '../providers/IAIProvider';
import { MockProvider } from '../providers/MockProvider';
import { GeminiProvider } from '../providers/GeminiProvider';
import { ConfigurationManager } from './ConfigurationManager';
import { OpenAIProvider } from '../providers/OpenAIProvider';
import { OllamaProvider } from '../providers/OllamaProvider';
import { GroqProvider } from '../providers/GroqProvider';
import { HuggingFaceProvider } from '../providers/HuggingFaceProvider';
import { PublicProvider } from '../providers/PublicProvider';
import { GitHubProvider } from '../providers/GitHubProvider';
import { AnthropicProvider } from '../providers/AnthropicProvider';
import { logger } from './Logger';
import { IProviderManager } from './IProviderManager';

export class ProviderManager implements IProviderManager {
    private providers: Map<string, IAIProvider>;

    constructor() {
        this.providers = new Map();
    }

    /**
     * Get or create provider instance (lazy loading)
     */
    private getOrCreateProvider(id: string): IAIProvider | undefined {
        // Return existing instance
        if (this.providers.has(id)) {
            return this.providers.get(id);
        }

        // Create new instance based on id
        let provider: IAIProvider | undefined;
        
        switch (id) {
        case 'mock':
            provider = new MockProvider();
            break;
        case 'gemini':
            provider = new GeminiProvider();
            break;
        case 'openai':
            provider = new OpenAIProvider();
            break;
        case 'ollama':
            provider = new OllamaProvider();
            break;
        case 'groq':
            provider = new GroqProvider();
            break;
        case 'huggingface':
            provider = new HuggingFaceProvider();
            break;
        case 'public':
            provider = new PublicProvider();
            break;
        case 'github':
            provider = new GitHubProvider();
            break;
        case 'anthropic':
            provider = new AnthropicProvider();
            break;
        default:
            return undefined;
        }

        if (provider) {
            this.providers.set(id, provider);
            logger.debug('Provider lazy-loaded', { providerId: id });
        }
        
        return provider;
    }

    public getActiveProvider(): IAIProvider {
        const configId = ConfigurationManager.getInstance().getProviderId();
        const provider = this.getOrCreateProvider(configId);

        if (!provider) {
            // Fallback to Mock if config is invalid
            logger.warn(`Provider ${configId} not found. Falling back to Mock.`);
            return this.getOrCreateProvider('mock')!;
        }

        return provider;
    }

    /**
     * Preload a provider (for faster first use)
     */
    public preloadProvider(id: string): void {
        if (!this.providers.has(id)) {
            this.getOrCreateProvider(id);
            logger.debug('Provider preloaded', { providerId: id });
        }
    }

    /**
     * Get loaded provider count (for debugging)
     */
    public getLoadedCount(): number {
        return this.providers.size;
    }

    /**
     * Clear all provider instances (for cleanup)
     */
    public clear(): void {
        this.providers.clear();
        logger.debug('All provider instances cleared');
    }
}
