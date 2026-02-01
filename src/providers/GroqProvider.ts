import { IAIProvider } from './IAIProvider';
import Groq from 'groq-sdk';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { promptForApiKey } from '../commands/settingsCommands';

export class GroqProvider implements IAIProvider {
    readonly id = 'groq';
    readonly name = 'Groq (LLaMA/Mixtral)';

    isConfigured(): boolean {
        return true;
    }

    async refine(userPrompt: string, systemTemplate: string, options?: { strict?: boolean; temperature?: number }): Promise<string> {
        const config = ConfigurationManager.getInstance();
        const apiKey = await config.getApiKey(this.id);

        if (!apiKey) {
            await promptForApiKey(this.id);
            const keyAfterPrompt = await config.getApiKey(this.id);
            if (!keyAfterPrompt) {
                throw new Error('API Key is required to use Groq.');
            }
            return this.executeRefinement(keyAfterPrompt, userPrompt, systemTemplate, config.getModelId());
        }

        return this.executeRefinement(apiKey, userPrompt, systemTemplate, config.getModelId());
    }

    private async executeRefinement(apiKey: string, userPrompt: string, systemPrompt: string, modelId: string): Promise<string> {
        try {
            const groq = new Groq({
                apiKey: apiKey,
            });

            // Fallback default if user switched provider but kept old model ID
            let effModelId = modelId;
            if (!modelId || modelId.startsWith('gemini') || modelId.startsWith('gpt')) {
                effModelId = 'llama3-70b-8192';
            }

            const response = await groq.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                model: effModelId,
            });

            return response.choices[0]?.message?.content || '';
        } catch (error: any) {
            throw new Error(`Groq Error: ${error.message}`);
        }
    }
}
