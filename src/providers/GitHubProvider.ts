import { IAIProvider, RefineCallOptions } from './IAIProvider';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { ModelRegistry } from '../services/ModelRegistry';
import { getApiModelId } from '../utils/ModelMappings';
import { isAbortOrUserCancellation } from '../utils/cancellationAbort';

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

    async refine(userPrompt: string, systemTemplate: string, options?: RefineCallOptions): Promise<string> {
        const config = ConfigurationManager.getInstance();
        const apiKey = await config.getApiKey(this.id);
        // Registry + settings options use UI IDs (e.g. github-gpt-4o); getModelId() returns API IDs for calls.
        const uiModelId = config.getModelIdForUI();
        const registry = ModelRegistry.getInstance();

        if (!apiKey) {
            throw new Error('GitHub Personal Access Token is not configured. Please set it in the extension settings.');
        }

        // Validate that the selected model is supported using ModelRegistry
        const isValidModel = await registry.validateModel(this.id, uiModelId);
        if (!isValidModel) {
            const supportedModels = await registry.getSupportedModels(this.id);
            const modelList = supportedModels.map(m => m.id).join(', ');
            throw new Error(`Model "${uiModelId}" is not supported by GitHub Marketplace. Supported models: ${modelList}`);
        }

        // GitHub Marketplace models usually follow OpenAI-compatible chat completions API
        const endpoint = 'https://models.inference.ai.azure.com/chat/completions';
        
        // Convert UI model ID to API model ID
        const apiModelId = getApiModelId(uiModelId, this.id);
        if (!apiModelId) {
            throw new Error(`Unable to map model "${uiModelId}" to API model ID for ${this.id} provider`);
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
                }),
                signal: options?.signal,
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`GitHub API Error (${response.status}): ${errorBody}`);
            }

            const data = await response.json() as any;
            if (data.choices && data.choices.length > 0) {
                // Report success to ModelRegistry for telemetry
                await registry.reportModelSuccess(this.id, uiModelId);
                return data.choices[0].message.content;
            }

            throw new Error('No content returned from GitHub Marketplace.');

        } catch (error: unknown) {
            if (isAbortOrUserCancellation(error)) {
                throw new Error('Operation cancelled');
            }
            // Report failure to ModelRegistry for telemetry
            const registry = ModelRegistry.getInstance();
            const errObj = error instanceof Error ? error : new Error(String(error));
            await registry.reportModelFailure(this.id, uiModelId, errObj);
            const msg = error instanceof Error ? error.message : String(error);
            throw new Error(`GitHub Provider Error: ${msg}`);
        }
    }
}
