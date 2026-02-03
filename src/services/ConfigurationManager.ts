import * as vscode from 'vscode';
import { getApiModelId, getUiModelId, migrateLegacyModelId, isValidModelId, getModelName } from '../utils/ModelMappings';
import { logger } from './Logger';

export class ConfigurationManager {
    private static instance: ConfigurationManager;
    private context: vscode.ExtensionContext | undefined;
    private secrets: vscode.SecretStorage | undefined;
    private migrationChecked: boolean = false;

    private constructor() {
        // Private constructor to prevent direct instantiation - use getInstance()
    }

    public static getInstance(): ConfigurationManager {
        if (!ConfigurationManager.instance) {
            ConfigurationManager.instance = new ConfigurationManager();
        }
        return ConfigurationManager.instance;
    }

    public initialize(context: vscode.ExtensionContext) {
        this.context = context;
        this.secrets = context.secrets;
        // Check and migrate legacy model IDs on initialization
        this.checkAndMigrateLegacyModels();
    }

    public getProviderId(): string {
        return vscode.workspace.getConfiguration('promptRefiner').get<string>('provider', 'github');
    }

    /**
     * Get the model ID for API calls (provider-specific format)
     * Automatically migrates legacy IDs and converts UI IDs to API IDs
     */
    public getModelId(): string {
        const provider = this.getProviderId();
        const storedId = vscode.workspace.getConfiguration('promptRefiner').get<string>('model', 'gpt-4o-mini');
        
        // First, check if it's a legacy ID that needs migration
        const migratedId = migrateLegacyModelId(storedId, provider);
        if (migratedId) {
            logger.info(`Migrating legacy model ID: ${storedId} -> ${migratedId}`);
            // Update storage with new ID (fire and forget)
            this.setModelId(migratedId).catch(err => 
                logger.error('Failed to migrate model ID', err)
            );
            
            // Return the API ID for the migrated UI ID
            const apiId = getApiModelId(migratedId, provider);
            return apiId || migratedId;
        }
        
        // Check if stored ID is a UI ID, convert to API ID
        const apiId = getApiModelId(storedId, provider);
        if (apiId) {
            return apiId;
        }
        
        // If it's already an API ID or unknown, return as-is
        // Provider will validate and throw appropriate error
        return storedId;
    }

    /**
     * Get the UI-friendly model ID for display purposes
     */
    public getModelIdForUI(): string {
        const provider = this.getProviderId();
        const storedId = vscode.workspace.getConfiguration('promptRefiner').get<string>('model', 'gpt-4o-mini');
        
        // If stored ID is an API ID, convert to UI ID
        const uiId = getUiModelId(storedId, provider);
        if (uiId) {
            return uiId;
        }
        
        // Check if it's a UI ID already
        if (isValidModelId(storedId, provider)) {
            return storedId;
        }
        
        return storedId;
    }

    /**
     * Get the model name for display
     */
    public getModelName(): string | undefined {
        const provider = this.getProviderId();
        const storedId = vscode.workspace.getConfiguration('promptRefiner').get<string>('model', 'gpt-4o-mini');
        return getModelName(storedId, provider);
    }

    /**
     * Set the model ID (accepts UI-friendly ID)
     * Stores the UI ID but API calls will get the correct API ID
     */
    public async setModelId(modelId: string): Promise<void> {
        // If it's an API ID, convert to UI ID for storage
        const provider = this.getProviderId();
        const uiId = getUiModelId(modelId, provider);
        const idToStore = uiId || modelId;
        
        await vscode.workspace.getConfiguration('promptRefiner').update('model', idToStore, vscode.ConfigurationTarget.Global);
        logger.info(`Model set to: ${idToStore} (API: ${getApiModelId(idToStore, provider) || modelId})`);
    }

    public async setProviderId(providerId: string): Promise<void> {
        await vscode.workspace.getConfiguration('promptRefiner').update('provider', providerId, vscode.ConfigurationTarget.Global);
    }

    public isStrictMode(): boolean {
        return vscode.workspace.getConfiguration('promptRefiner').get<boolean>('strictMode', true);
    }

    public async getApiKey(providerId: string): Promise<string | undefined> {
        if (!this.secrets) {
            return undefined;
        }
        return this.secrets.get(`promptRefiner.${providerId}.apiKey`);
    }

    public async setApiKey(providerId: string, key: string): Promise<void> {
        if (!this.secrets) {
            throw new Error('Secrets not initialized');
        }
        await this.secrets.store(`promptRefiner.${providerId}.apiKey`, key);
    }

    public getOllamaEndpoint(): string {
        return vscode.workspace.getConfiguration('promptRefiner').get<string>('ollamaEndpoint', 'http://localhost:11434');
    }

    /**
     * List of all providers that require API keys
     */
    public static readonly API_KEY_PROVIDERS = [
        { id: 'github', name: 'GitHub Marketplace', requiresApiKey: true },
        { id: 'openai', name: 'OpenAI', requiresApiKey: true },
        { id: 'gemini', name: 'Google Gemini', requiresApiKey: true },
        { id: 'groq', name: 'Groq', requiresApiKey: true }
        // Hidden providers (not shown in UI):
        // { id: 'huggingface', name: 'Hugging Face', requiresApiKey: true },
        // { id: 'anthropic', name: 'Anthropic', requiresApiKey: true }
    ];

    /**
     * Check if a specific provider is fully configured (has API key if required)
     */
    public async isProviderConfigured(providerId: string): Promise<boolean> {
        const providerInfo = ConfigurationManager.API_KEY_PROVIDERS.find(p => p.id === providerId);
        
        // Providers that don't require API keys are always "configured"
        if (!providerInfo || !providerInfo.requiresApiKey) {
            return true;
        }

        // Check if API key exists
        const apiKey = await this.getApiKey(providerId);
        return !!apiKey && apiKey.trim().length > 0;
    }

    /**
     * Get configuration status for all providers
     * Returns an array of objects with provider info and configuration status
     */
    public async getAllProvidersConfigurationStatus(): Promise<Array<{
        id: string;
        name: string;
        requiresApiKey: boolean;
        isConfigured: boolean;
        hasApiKey: boolean;
    }>> {
        const results = [];

        // Add all providers that require API keys
        for (const provider of ConfigurationManager.API_KEY_PROVIDERS) {
            const apiKey = await this.getApiKey(provider.id);
            const hasApiKey = !!apiKey && apiKey.trim().length > 0;
            
            results.push({
                id: provider.id,
                name: provider.name,
                requiresApiKey: provider.requiresApiKey,
                isConfigured: hasApiKey,
                hasApiKey: hasApiKey
            });
        }

        // Add providers that don't require API keys
        const noApiKeyProviders = [
            { id: 'ollama', name: 'Ollama (Local)', requiresApiKey: false },
            { id: 'mock', name: 'Mock Provider', requiresApiKey: false }
        ];

        for (const provider of noApiKeyProviders) {
            results.push({
                id: provider.id,
                name: provider.name,
                requiresApiKey: provider.requiresApiKey,
                isConfigured: true,
                hasApiKey: false
            });
        }

        return results;
    }

    /**
     * Get count of configured providers (those with API keys set)
     */
    public async getConfiguredProviderCount(): Promise<number> {
        let count = 0;
        for (const provider of ConfigurationManager.API_KEY_PROVIDERS) {
            const isConfigured = await this.isProviderConfigured(provider.id);
            if (isConfigured) {
                count++;
            }
        }
        return count;
    }

    /**
     * Get list of configured provider IDs
     */
    public async getConfiguredProviderIds(): Promise<string[]> {
        const configured: string[] = [];
        for (const provider of ConfigurationManager.API_KEY_PROVIDERS) {
            const isConfigured = await this.isProviderConfigured(provider.id);
            if (isConfigured) {
                configured.push(provider.id);
            }
        }
        return configured;
    }

    /**
     * Check if multiple providers are configured (useful for switching)
     */
    public async hasMultipleProvidersConfigured(): Promise<boolean> {
        const count = await this.getConfiguredProviderCount();
        return count > 1;
    }

    /**
     * Clear API key for a specific provider
     */
    public async clearApiKey(providerId: string): Promise<void> {
        if (!this.secrets) {
            throw new Error('Secrets not initialized');
        }
        await this.secrets.delete(`promptRefiner.${providerId}.apiKey`);
        logger.info(`API key cleared for provider: ${providerId}`);
    }

    /**
     * Clear all API keys (use with caution)
     */
    public async clearAllApiKeys(): Promise<void> {
        if (!this.secrets) {
            throw new Error('Secrets not initialized');
        }
        
        for (const provider of ConfigurationManager.API_KEY_PROVIDERS) {
            await this.secrets.delete(`promptRefiner.${provider.id}.apiKey`);
        }
        
        logger.info('All API keys cleared');
    }

    /**
     * Check and migrate legacy model IDs on startup
     */
    private async checkAndMigrateLegacyModels(): Promise<void> {
        if (this.migrationChecked) return;
        
        const provider = this.getProviderId();
        const storedId = vscode.workspace.getConfiguration('promptRefiner').get<string>('model', '');
        
        if (!storedId) {
            this.migrationChecked = true;
            return;
        }
        
        const migratedId = migrateLegacyModelId(storedId, provider);
        if (migratedId) {
            logger.info(`Auto-migrating legacy model ID on startup: ${storedId} -> ${migratedId}`);
            await this.setModelId(migratedId);
            
            // Show notification to user
            vscode.window.showInformationMessage(
                `Model configuration updated: ${storedId} -> ${migratedId}`
            );
        }
        
        this.migrationChecked = true;
    }
}
