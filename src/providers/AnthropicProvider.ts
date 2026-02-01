import { IAIProvider } from './IAIProvider';
import { ConfigurationManager } from '../services/ConfigurationManager';

/**
 * Anthropic Claude Provider
 * Supports Claude 3 models via Anthropic API
 */
export class AnthropicProvider implements IAIProvider {
    readonly id = 'anthropic';
    readonly name = 'Anthropic Claude';

    private readonly API_URL = 'https://api.anthropic.com/v1/messages';
    private readonly DEFAULT_MODEL = 'claude-3-haiku-20240307';

    isConfigured(): boolean {
    // Check if API key exists in configuration
        const config = ConfigurationManager.getInstance();
        return !!config.getApiKey(this.id);
    }

    async refine(
        userPrompt: string,
        systemTemplate: string,
        options?: { strict?: boolean; temperature?: number }
    ): Promise<string> {
        const config = ConfigurationManager.getInstance();
        const apiKey = await config.getApiKey(this.id);

        if (!apiKey) {
            throw new Error('Anthropic API key not configured. Please set it in settings.');
        }

        const modelId = config.getModelId();
        const model = this.mapModelId(modelId);

        try {
            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: model,
                    max_tokens: 4000,
                    temperature: options?.temperature ?? 0.7,
                    system: systemTemplate,
                    messages: [
                        {
                            role: 'user',
                            content: userPrompt,
                        },
                    ],
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Anthropic API error: ${response.status} - ${error}`);
            }

            const data = await response.json() as any;
      
            if (data.content && data.content.length > 0) {
                return data.content[0].text;
            }

            throw new Error('Empty response from Anthropic API');
        } catch (error: any) {
            throw new Error(`Anthropic refinement failed: ${error.message}`);
        }
    }

    /**
   * Map internal model IDs to Anthropic model names
   */
    private mapModelId(modelId: string): string {
        const modelMap: Record<string, string> = {
            'claude-3-opus': 'claude-3-opus-20240229',
            'claude-3-sonnet': 'claude-3-sonnet-20240229',
            'claude-3-haiku': 'claude-3-haiku-20240307',
        };

        return modelMap[modelId] || this.DEFAULT_MODEL;
    }
}
