import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './Logger';

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
                models: [
                    { id: 'gpt-4o', name: 'GPT-4o', description: 'Latest GPT-4 optimized model', isVerified: true },
                    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Smaller, faster version', isVerified: true },
                    { id: 'Meta-Llama-3.1-70B-Instruct', name: 'LLaMA 3.1 70B', description: 'Meta open-source model', isVerified: true },
                    { id: 'mistralai/Mistral-large', name: 'Mistral Large', description: 'Powerful European model', isVerified: true }
                ]
            },
            openai: {
                lastUpdated: new Date().toISOString(),
                models: [
                    { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable model', isVerified: true },
                    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable', isVerified: true }
                ]
            },
            gemini: {
                lastUpdated: new Date().toISOString(),
                models: [
                    { id: 'gemini-flash', name: 'Gemini 2.0 Flash', description: 'Fast and efficient', isVerified: true },
                    { id: 'gemini-pro', name: 'Gemini 2.0 Pro', description: 'Most capable Gemini model', isVerified: true }
                ]
            },
            groq: {
                lastUpdated: new Date().toISOString(),
                models: [
                    { id: 'groq-llama3-70b', name: 'Llama 3.3 70B', description: 'Ultra-fast inference (current model)', isVerified: true }
                ]
            }
        };

        for (const [provider, info] of Object.entries(defaults)) {
            this.modelsCache.set(provider, info);
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
            const config = vscode.workspace.getConfiguration('promptRefiner');
            const apiKey = await config.get<string>('apiKeys.openai');
            
            if (!apiKey) return [];

            const response = await fetch('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });

            if (!response.ok) return [];

            const data = await response.json() as any;
            
            // Filter for GPT models only
            return data.data
                .filter((m: any) => m.id.startsWith('gpt-'))
                .map((m: any) => ({
                    id: m.id,
                    name: m.id,
                    description: 'OpenAI model',
                    isVerified: false // Will be verified on first use
                }));
        } catch {
            return [];
        }
    }

    /**
     * Fetch GitHub Marketplace models
     */
    private async fetchGitHubModels(): Promise<ModelInfo[]> {
        // GitHub doesn't have a public models API, use hardcoded verified list
        return [
            { id: 'gpt-4o', name: 'GPT-4o', description: 'Latest GPT-4 optimized model', isVerified: true },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Smaller, faster version', isVerified: true },
            { id: 'Meta-Llama-3.1-70B-Instruct', name: 'LLaMA 3.1 70B', description: 'Meta open-source model', isVerified: true },
            { id: 'mistralai/Mistral-large', name: 'Mistral Large', description: 'Powerful European model', isVerified: true }
        ];
    }

    /**
     * Fetch Gemini models
     */
    private async fetchGeminiModels(): Promise<ModelInfo[]> {
        // Gemini API doesn't have a public models list endpoint
        // Return verified models
        return [
            { id: 'gemini-flash', name: 'Gemini 2.0 Flash', description: 'Fast and efficient', isVerified: true },
            { id: 'gemini-pro', name: 'Gemini 2.0 Pro', description: 'Most capable Gemini model', isVerified: true }
        ];
    }

    /**
     * Fetch Groq models
     */
    private async fetchGroqModels(): Promise<ModelInfo[]> {
        // Return verified Groq models
        // Note: llama3-70b-8192 and mixtral-8x7b-32768 have been decommissioned
        // Current production model: llama-3.3-70b-versatile
        return [
            { id: 'groq-llama3-70b', name: 'Llama 3.3 70B', description: 'Ultra-fast inference (current model)', isVerified: true }
        ];
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
