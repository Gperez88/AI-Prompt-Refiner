import { IAIProvider } from './IAIProvider';
import { ConfigurationManager } from '../services/ConfigurationManager';

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

        if (!apiKey) {
            throw new Error('GitHub Personal Access Token is not configured. Please set it in the extension settings.');
        }

        // GitHub Marketplace models usually follow OpenAI-compatible chat completions API
        const endpoint = 'https://models.inference.ai.azure.com/chat/completions';
        
        // GitHub model names often need mapping or prefixes
        let githubModel = modelId;
        // Default mapping for common names if not explicitly provided
        if (modelId === 'gpt-4o') githubModel = 'gpt-4o';
        if (modelId === 'gpt-4o-mini') githubModel = 'gpt-4o-mini';
        if (modelId === 'llama-3.1-70b' || modelId === 'llama3') githubModel = 'meta-llama-3.1-70b-instruct';
        if (modelId === 'mistral-large') githubModel = 'mistral-large-latest';

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
                return data.choices[0].message.content;
            }

            throw new Error('No content returned from GitHub Marketplace.');

        } catch (error: any) {
            throw new Error(`GitHub Provider Error: ${error.message}`);
        }
    }
}
