/**
 * Model ID mapping utilities
 * Converts UI-friendly model IDs to provider-specific API names
 */

export interface ModelMapping {
    uiId: string;           // ID shown in UI (user-friendly)
    apiId: string;          // ID used in API calls (provider-specific)
    provider: string;       // Provider ID
    name: string;           // Display name
}

/**
 * Centralized model mappings for all providers
 * This ensures UI uses friendly IDs while APIs get correct names
 */
export const MODEL_MAPPINGS: ModelMapping[] = [
    // GitHub Models
    { uiId: 'github-gpt-4o', apiId: 'gpt-4o', provider: 'github', name: 'GPT-4o' },
    { uiId: 'github-gpt-4o-mini', apiId: 'gpt-4o-mini', provider: 'github', name: 'GPT-4o Mini' },
    // NOTE: LLaMA and Mistral models removed temporarily due to API name issues
    // { uiId: 'github-llama-3.1-70b', apiId: 'Meta-Llama-3.1-70B-Instruct', provider: 'github', name: 'LLaMA 3.1 70B' },
    // { uiId: 'github-mistral-large', apiId: 'mistralai/Mistral-large', provider: 'github', name: 'Mistral Large' },
    
    // OpenAI Models
    { uiId: 'openai-gpt-4o', apiId: 'gpt-4o', provider: 'openai', name: 'GPT-4o' },
    { uiId: 'openai-gpt-4o-mini', apiId: 'gpt-4o-mini', provider: 'openai', name: 'GPT-4o Mini' },
    
    // Gemini Models (using Gemini 2.0 - available in v1beta API)
    { uiId: 'gemini-flash', apiId: 'gemini-2.0-flash', provider: 'gemini', name: 'Gemini 2.0 Flash' },
    { uiId: 'gemini-pro', apiId: 'gemini-2.0-pro', provider: 'gemini', name: 'Gemini 2.0 Pro' },
    
    // Groq Models (Updated 2025 - llama3-70b-8192 deprecated, using llama-3.3-70b-versatile)
    { uiId: 'groq-llama3-70b', apiId: 'llama-3.3-70b-versatile', provider: 'groq', name: 'Llama 3.3 70B' },
    // Note: mixtral-8x7b-32768 has been decommissioned without direct replacement
    
    // Ollama Models
    { uiId: 'ollama-custom', apiId: 'custom', provider: 'ollama', name: 'Active Ollama Model' }
];

/**
 * Legacy model ID mappings for automatic migration
 * Maps old incorrect IDs to new correct IDs
 */
export const LEGACY_MODEL_MAPPINGS: Record<string, { provider: string; newId: string }> = {
    // Old GitHub IDs -> New UI IDs
    'llama-3.1-70b': { provider: 'github', newId: 'github-llama-3.1-70b' },
    'mistral-large': { provider: 'github', newId: 'github-mistral-large' },
    'Meta-Llama-3.1-70B-Instruct': { provider: 'github', newId: 'github-llama-3.1-70b' },
    'mistralai/Mistral-large': { provider: 'github', newId: 'github-mistral-large' },
    
    // Old Public provider IDs (disabled but for reference)
    'gpt-4o-mini': { provider: 'github', newId: 'github-gpt-4o-mini' },
    'llama3': { provider: 'github', newId: 'github-llama-3.1-70b' }
};

/**
 * Get the API-specific model ID from a UI model ID or API model ID
 * If uiId is already an API ID, returns it as-is
 */
export function getApiModelId(uiId: string, provider: string): string | undefined {
    // First, try to find it as a UI ID
    const mapping = MODEL_MAPPINGS.find(m => m.uiId === uiId && m.provider === provider);
    if (mapping) {
        return mapping.apiId;
    }
    
    // If not found as UI ID, check if it's already an API ID
    const apiMapping = MODEL_MAPPINGS.find(m => m.apiId === uiId && m.provider === provider);
    if (apiMapping) {
        return uiId; // It's already an API ID, return as-is
    }
    
    return undefined;
}

/**
 * Get the UI-friendly model ID from an API model ID
 */
export function getUiModelId(apiId: string, provider: string): string | undefined {
    const mapping = MODEL_MAPPINGS.find(m => m.apiId === apiId && m.provider === provider);
    return mapping?.uiId;
}

/**
 * Migrate legacy model ID to new format
 * Returns the new ID or undefined if no migration needed
 */
export function migrateLegacyModelId(oldId: string, provider: string): string | undefined {
    const legacy = LEGACY_MODEL_MAPPINGS[oldId];
    if (legacy && legacy.provider === provider) {
        return legacy.newId;
    }
    return undefined;
}

/**
 * Check if a model ID is valid for a provider
 */
export function isValidModelId(modelId: string, provider: string): boolean {
    // Check in current mappings
    const inCurrent = MODEL_MAPPINGS.some(m => 
        (m.uiId === modelId || m.apiId === modelId) && m.provider === provider
    );
    
    if (inCurrent) return true;
    
    // Check if it's a legacy ID that can be migrated
    const legacy = LEGACY_MODEL_MAPPINGS[modelId];
    return legacy !== undefined && legacy.provider === provider;
}

/**
 * Get all UI models for a provider
 */
export function getUiModelsForProvider(provider: string): Array<{ id: string; name: string; description: string }> {
    return MODEL_MAPPINGS
        .filter(m => m.provider === provider)
        .map(m => ({
            id: m.uiId,
            name: m.name,
            description: `${m.name} (${m.apiId})`
        }));
}

/**
 * Get model name from any ID (UI or API)
 */
export function getModelName(modelId: string, provider: string): string | undefined {
    const mapping = MODEL_MAPPINGS.find(m => 
        (m.uiId === modelId || m.apiId === modelId) && m.provider === provider
    );
    return mapping?.name;
}
