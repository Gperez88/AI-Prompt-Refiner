import * as fs from 'fs';
import * as path from 'path';
import { logger } from './Logger';
import { ConfigurationManager } from './ConfigurationManager';
import { MODEL_MAPPINGS } from '../utils/ModelMappings';
import {
    normalizeGeminiModelsResponse,
    normalizeGitHubCatalogResponse,
    normalizeOpenAICompatibleModels,
} from './modelCatalog';

/**
 * Model information for a provider
 */
export interface ModelInfo {
    id: string;
    name: string;
    description: string;
    isVerified: boolean;
    lastTested?: number;
}

/**
 * Provider model configuration
 */
export interface ProviderModels {
    lastUpdated: string;
    models: ModelInfo[];
    endpoint?: string;
}

/**
 * Centralized model registry that maintains supported models for all providers
 * Uses a hybrid approach:
 * 1. Local JSON file as fallback (offline support)
 * 2. Periodic API fetching for updates
 * 3. Runtime validation before each API call
 * 4. Auto-reporting of model failures
 */
export class ModelRegistry {
    private static instance: ModelRegistry;
    private modelsCache: Map<string, ProviderModels> = new Map();
    private lastFetchTime: Map<string, number> = new Map();
    private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
    private readonly MODELS_FILE_PATH: string;

    private constructor() {
        // Path to the supported-models.json file
        this.MODELS_FILE_PATH = path.join(__dirname, '..', '..', 'config', 'supported-models.json');
    }

    public static getInstance(): ModelRegistry {
        if (!ModelRegistry.instance) {
            ModelRegistry.instance = new ModelRegistry();
        }
        return ModelRegistry.instance;
    }

    /**
     * Initialize the registry by loading local models
     */
    public async initialize(): Promise<void> {
        await this.loadLocalModels();
    }

    /**
     * Load models from local JSON file (offline fallback)
     */
    private async loadLocalModels(): Promise<void> {
        try {
            if (fs.existsSync(this.MODELS_FILE_PATH)) {
                const data = fs.readFileSync(this.MODELS_FILE_PATH, 'utf8');
                const models = JSON.parse(data);
                
                for (const [provider, info] of Object.entries(models)) {
                    this.modelsCache.set(provider, info as ProviderModels);
                }
                
                logger.info('ModelRegistry initialized with local models', {
                    providers: Object.keys(models).length
                });
            } else {
                logger.warn('No local models file found, using hardcoded defaults');
                this.loadDefaultModels();
            }
        } catch (error) {
            logger.error('Failed to load local models', error as Error);
            this.loadDefaultModels();
        }
    }

    /**
     * Load hardcoded default models as ultimate fallback
     */
    private loadDefaultModels(): void {
        const defaults: Record<string, ProviderModels> = {
            github: {
                lastUpdated: new Date().toISOString(),
                models: ModelRegistry.modelsFromMappings('github'),
            },
            openai: {
                lastUpdated: new Date().toISOString(),
                models: ModelRegistry.modelsFromMappings('openai'),
            },
            gemini: {
                lastUpdated: new Date().toISOString(),
                models: ModelRegistry.modelsFromMappings('gemini'),
            },
            groq: {
                lastUpdated: new Date().toISOString(),
                models: ModelRegistry.modelsFromMappings('groq'),
            },
        };

        for (const [provider, info] of Object.entries(defaults)) {
            this.modelsCache.set(provider, info);
        }
    }

    /** Defaults and GitHub catalog fallback: only models defined in MODEL_MAPPINGS for this provider. */
    private static modelsFromMappings(provider: string): ModelInfo[] {
        return MODEL_MAPPINGS.filter(m => m.provider === provider).map(m => ({
            id: m.uiId,
            name: m.name,
            description: `${m.name} (${m.apiId})`,
            isVerified: true,
        }));
    }

    private async fetchJson(url: string, init?: RequestInit): Promise<unknown | null> {
        try {
            const response = await fetch(url, init);
            if (!response.ok) {
                return null;
            }
            return await response.json() as unknown;
        } catch {
            return null;
        }
    }

    /**
     * Get supported models for a provider
     * Returns cached models, fetching from API if cache is stale
     */
    public async getSupportedModels(provider: string): Promise<ModelInfo[]> {
        const cached = this.modelsCache.get(provider);
        
        // If we have cached models and they're fresh, return them
        if (cached && this.isCacheFresh(provider)) {
            return cached.models;
        }

        // Try to fetch fresh models from API
        try {
            const freshModels = await this.fetchModelsFromAPI(provider);
            if (freshModels && freshModels.length > 0) {
                await this.updateCache(provider, freshModels);
                return freshModels;
            }
        } catch (error) {
            logger.warn(`Failed to fetch fresh models for ${provider}`, error as Error);
        }

        // Return cached or default models as fallback
        return cached?.models || [];
    }

    /**
     * Check if cache is still fresh (within 24 hours)
     */
    private isCacheFresh(provider: string): boolean {
        const lastFetch = this.lastFetchTime.get(provider);
        if (!lastFetch) return false;
        
        return (Date.now() - lastFetch) < this.CACHE_DURATION;
    }

    /**
     * Fetch models from provider API
     * Each provider implements this differently
     */
    private async fetchModelsFromAPI(provider: string): Promise<ModelInfo[]> {
        switch (provider) {
        case 'openai':
            return this.fetchOpenAIModels();
        case 'github':
            return this.fetchGitHubModels();
        case 'gemini':
            return this.fetchGeminiModels();
        case 'groq':
            return this.fetchGroqModels();
        default:
            return [];
        }
    }

    /**
     * Fetch OpenAI models
     */
    private async fetchOpenAIModels(): Promise<ModelInfo[]> {
        try {
            const apiKey = await ConfigurationManager.getInstance().getApiKey('openai');

            if (!apiKey) {
                return [];
            }

            const data = await this.fetchJson('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${apiKey}` },
            });
            if (data === null) {
                return ModelRegistry.modelsFromMappings('openai');
            }

            const mapped = normalizeOpenAICompatibleModels(data, 'openai');
            return mapped.length > 0 ? mapped : ModelRegistry.modelsFromMappings('openai');
        } catch {
            return [];
        }
    }

    /**
     * Fetch GitHub Models catalog (REST); fallback to MODEL_MAPPINGS when empty or on error.
     */
    private async fetchGitHubModels(): Promise<ModelInfo[]> {
        try {
            const apiKey = await ConfigurationManager.getInstance().getApiKey('github');
            if (!apiKey) {
                return [];
            }

            const data = await this.fetchJson('https://models.github.ai/catalog/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                },
            });
            if (data === null) {
                return ModelRegistry.modelsFromMappings('github');
            }

            const mapped = normalizeGitHubCatalogResponse(data);
            return mapped.length > 0 ? mapped : ModelRegistry.modelsFromMappings('github');
        } catch {
            return [];
        }
    }

    /**
     * Fetch Gemini models from Generative Language API.
     */
    private async fetchGeminiModels(): Promise<ModelInfo[]> {
        try {
            const apiKey = await ConfigurationManager.getInstance().getApiKey('gemini');
            if (!apiKey) {
                return [];
            }

            const url =
                `https://generativelanguage.googleapis.com/v1beta/models?pageSize=256&key=${encodeURIComponent(apiKey)}`;
            const data = await this.fetchJson(url);
            if (data === null) {
                return ModelRegistry.modelsFromMappings('gemini');
            }

            const mapped = normalizeGeminiModelsResponse(data);
            return mapped.length > 0 ? mapped : ModelRegistry.modelsFromMappings('gemini');
        } catch {
            return [];
        }
    }

    /**
     * Fetch Groq models (OpenAI-compatible list endpoint).
     */
    private async fetchGroqModels(): Promise<ModelInfo[]> {
        try {
            const apiKey = await ConfigurationManager.getInstance().getApiKey('groq');
            if (!apiKey) {
                return [];
            }

            const data = await this.fetchJson('https://api.groq.com/openai/v1/models', {
                headers: { 'Authorization': `Bearer ${apiKey}` },
            });
            if (data === null) {
                return ModelRegistry.modelsFromMappings('groq');
            }

            const mapped = normalizeOpenAICompatibleModels(data, 'groq');
            return mapped.length > 0 ? mapped : ModelRegistry.modelsFromMappings('groq');
        } catch {
            return [];
        }
    }

    /**
     * Update cache with fresh models
     */
    private async updateCache(provider: string, models: ModelInfo[]): Promise<void> {
        this.modelsCache.set(provider, {
            lastUpdated: new Date().toISOString(),
            models
        });
        this.lastFetchTime.set(provider, Date.now());
        
        // Persist to local JSON file
        await this.saveToLocalFile();
    }

    /**
     * Validate a model at runtime before API call
     * Returns true if model is supported, false otherwise
     */
    public async validateModel(provider: string, modelId: string): Promise<boolean> {
        const models = await this.getSupportedModels(provider);
        return models.some(m => m.id === modelId);
    }

    /**
     * Report a model failure for telemetry
     * This helps track which models are actually working
     */
    public async reportModelFailure(provider: string, modelId: string, error: Error): Promise<void> {
        logger.error(`Model failure reported: ${provider}/${modelId}`, error);
        
        // Check if error indicates model is no longer available
        const errorMessage = error.message.toLowerCase();
        const isModelUnavailable = 
            errorMessage.includes('unknown_model') ||
            errorMessage.includes('model not found') ||
            errorMessage.includes('invalid model') ||
            errorMessage.includes('deprecated');

        if (isModelUnavailable) {
            // Mark model as unverified in cache
            const models = this.modelsCache.get(provider)?.models || [];
            const model = models.find(m => m.id === modelId);
            if (model) {
                model.isVerified = false;
                model.lastTested = Date.now();
                await this.saveToLocalFile();
                
                logger.warn(`Model ${provider}/${modelId} marked as unverified due to failure`);
            }
        }
    }

    /**
     * Report a model success for telemetry
     */
    public async reportModelSuccess(provider: string, modelId: string): Promise<void> {
        const models = this.modelsCache.get(provider)?.models || [];
        const model = models.find(m => m.id === modelId);
        
        if (model && !model.isVerified) {
            model.isVerified = true;
            model.lastTested = Date.now();
            await this.saveToLocalFile();
            
            logger.info(`Model ${provider}/${modelId} verified as working`);
        }
    }

    /**
     * Save current cache to local JSON file
     */
    private async saveToLocalFile(): Promise<void> {
        try {
            const data: Record<string, ProviderModels> = {};
            
            for (const [provider, info] of this.modelsCache.entries()) {
                data[provider] = info;
            }

            // Ensure directory exists
            const dir = path.dirname(this.MODELS_FILE_PATH);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(
                this.MODELS_FILE_PATH,
                JSON.stringify(data, null, 2),
                'utf8'
            );
            
            logger.debug('ModelRegistry saved to local file');
        } catch (error) {
            logger.error('Failed to save models to local file', error as Error);
        }
    }

    /**
     * Get the last updated timestamp for a provider
     */
    public getLastUpdated(provider: string): string | undefined {
        return this.modelsCache.get(provider)?.lastUpdated;
    }

    /**
     * Force refresh models from APIs
     * Call this from CI/CD or user action
     */
    public async forceRefresh(): Promise<void> {
        this.lastFetchTime.clear();
        
        const providers = ['openai', 'github', 'gemini', 'groq'];
        
        for (const provider of providers) {
            try {
                await this.forceRefreshProvider(provider);
            } catch (error) {
                logger.error(`Failed to refresh models for ${provider}`, error as Error);
            }
        }
        
        logger.info('ModelRegistry force refresh completed');
    }

    /**
     * Force refresh a specific provider
     * Used by CLI script
     */
    public async forceRefreshProvider(provider: string): Promise<void> {
        this.lastFetchTime.delete(provider);
        
        try {
            const models = await this.fetchModelsFromAPI(provider);
            if (models.length > 0) {
                await this.updateCache(provider, models);
                logger.info(`Refreshed models for ${provider}`, { count: models.length });
            } else {
                logger.warn(`No models fetched for ${provider}`);
            }
        } catch (error) {
            logger.error(`Failed to refresh models for ${provider}`, error as Error);
            throw error;
        }
    }
}
