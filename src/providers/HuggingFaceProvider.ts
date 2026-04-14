import { IAIProvider, RefineCallOptions } from './IAIProvider';
import { isAbortOrUserCancellation } from '../utils/cancellationAbort';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { promptForApiKey } from '../commands/settingsCommands';

export class HuggingFaceProvider implements IAIProvider {
    readonly id = 'huggingface';
    readonly name = 'HuggingFace (Free Tier)';

    isConfigured(): boolean {
        return true;
    }

    async refine(userPrompt: string, systemTemplate: string, options?: RefineCallOptions): Promise<string> {
        const config = ConfigurationManager.getInstance();
        const apiKey = await config.getApiKey(this.id);

        if (!apiKey) {
            await promptForApiKey(this.id);
            const keyAfterPrompt = await config.getApiKey(this.id);
            if (!keyAfterPrompt) {
                throw new Error('HuggingFace Access Token is required.');
            }
            return this.executeRefinement(keyAfterPrompt, userPrompt, systemTemplate, config.getModelId(), options);
        }

        return this.executeRefinement(apiKey, userPrompt, systemTemplate, config.getModelId(), options);
    }

    private async executeRefinement(
        apiKey: string,
        userPrompt: string,
        systemPrompt: string,
        modelId: string,
        options?: RefineCallOptions,
    ): Promise<string> {
        try {
            // Default model if none selected or incompatible
            let effModelId = modelId;
            if (!modelId || modelId.startsWith('gemini') || modelId.startsWith('gpt') || modelId.startsWith('llama')) {
                effModelId = 'bigscience/bloom';
            }

            const response = await fetch(`https://router.huggingface.co/hf-inference/models/${effModelId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inputs: `System: ${systemPrompt}\nUser: ${userPrompt}\nAssistant:`,
                    parameters: {
                        max_new_tokens: 1000,
                        return_full_text: false
                    }
                }),
                signal: options?.signal,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HF Error (${response.status}): ${errorText}`);
            }

            const result = await response.json() as any;

            // HF Inference API returns an array, usually with 'generated_text'
            if (Array.isArray(result) && result.length > 0) {
                return result[0].generated_text || '';
            } else if (result.generated_text) {
                return result.generated_text;
            }

            return JSON.stringify(result);

        } catch (error: unknown) {
            if (isAbortOrUserCancellation(error)) {
                throw new Error('Operation cancelled');
            }
            const msg = error instanceof Error ? error.message : String(error);
            throw new Error(`HuggingFace Error: ${msg}`);
        }
    }
}
