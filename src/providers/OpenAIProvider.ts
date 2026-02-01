import { IAIProvider } from './IAIProvider';
import OpenAI from 'openai';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { promptForApiKey } from '../commands/settingsCommands';

export class OpenAIProvider implements IAIProvider {
    readonly id = 'openai';
    readonly name = 'OpenAI (GPT)';

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
                throw new Error('API Key is required to use OpenAI.');
            }
            return this.executeRefinement(keyAfterPrompt, userPrompt, systemTemplate, config.getModelId());
        }

        return this.executeRefinement(apiKey, userPrompt, systemTemplate, config.getModelId());
    }

    private async executeRefinement(apiKey: string, userPrompt: string, systemPrompt: string, modelId: string): Promise<string> {
        try {
            const openai = new OpenAI({
                apiKey: apiKey,
            });

            // Adjust model name if user left default gemini one
            const effModelId = modelId.startsWith('gemini') ? 'gpt-4o-mini' : modelId;

            const response = await openai.chat.completions.create({
                model: effModelId,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
            });

            return response.choices[0].message.content || '';
        } catch (error: any) {
            throw new Error(`OpenAI Error: ${error.message}`);
        }
    }
}
