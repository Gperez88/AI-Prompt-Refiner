import { IAIProvider } from './IAIProvider';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { ModelRegistry } from '../services/ModelRegistry';
import { logger } from '../services/Logger';
import { getApiModelId } from '../utils/ModelMappings';

/**
 * GitHubProvider integrates with GitHub Marketplace models.
 * Requires a GitHub Personal Access Token (classic) or Fine-grained token.
 */
export class GitHubProvider implements IAIProvider {
    readonly id = 'github';
    readonly name = 'GitHub Marketplace';

    isConfigured(): boolean {
        // Configuration check will happen during refine call
        return true;
    }

    async refine(userPrompt: string, systemTemplate: string, options?: { strict?: boolean; temperature?: number }): Promise<string> {
        const config = ConfigurationManager.getInstance();
        const apiKey = await config.getApiKey(this.id);
        const modelId = config.getModelId();
        const registry = ModelRegistry.getInstance();

        if (!apiKey) {
            throw new Error('GitHub Personal Access Token is not configured. Please set it in the extension settings.');
        }

        // Validate that the selected model is supported using ModelRegistry
        const isValidModel = await registry.validateModel(this.id, modelId);
        if (!isValidModel) {
            const supportedModels = await registry.getSupportedModels(this.id);
            const modelList = supportedModels.map(m => m.id).join(', ');
            throw new Error(`Model "${modelId}" is not supported by GitHub Marketplace. Supported models: ${modelList}`);
        }

        // GitHub Marketplace models usually follow OpenAI-compatible chat completions API
        const endpoint = 'https://models.inference.ai.azure.com/chat/completions';
        
        // Convert UI model ID to API model ID
        const apiModelId = getApiModelId(modelId, this.id);
        if (!apiModelId) {
            throw new Error(`Unable to map model "${modelId}" to API model ID for ${this.id} provider`);
        }
        const githubModel = apiModelId;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: systemTemplate },
                        { role: 'user', content: userPrompt }
                    ],
                    model: githubModel,
                    temperature: options?.temperature ?? 0.3,
                    max_tokens: 4096,
                    top_p: 1
                })
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`GitHub API Error (${response.status}): ${errorBody}`);
            }

            const data = await response.json() as any;
            if (data.choices && data.choices.length > 0) {
                // Report success to ModelRegistry for telemetry
                await registry.reportModelSuccess(this.id, modelId);
                return data.choices[0].message.content;
            }

            throw new Error('No content returned from GitHub Marketplace.');

        } catch (error: any) {
            // Report failure to ModelRegistry for telemetry
            const registry = ModelRegistry.getInstance();
            await registry.reportModelFailure(this.id, modelId, error);
            
            throw new Error(`GitHub Provider Error: ${error.message}`);
        }
    }
}
