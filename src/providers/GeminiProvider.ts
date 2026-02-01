import { IAIProvider, ProviderMeta } from './IAIProvider';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { promptForApiKey } from '../commands/settingsCommands';

export class GeminiProvider implements IAIProvider {
    readonly id = 'gemini';
    readonly name = 'Google Gemini';

    isConfigured(): boolean {
        // Will check async in refine(), but technically we rely on the manager
        return true;
    }

    async refine(userPrompt: string, systemTemplate: string, options?: { strict?: boolean; temperature?: number }): Promise<string> {
        const config = ConfigurationManager.getInstance();
        const apiKey = await config.getApiKey(this.id);

        if (!apiKey) {
            await promptForApiKey(this.id);
            // Try getting it again
            const keyAfterPrompt = await config.getApiKey(this.id);
            if (!keyAfterPrompt) {
                throw new Error('API Key is required to use Google Gemini.');
            }
            return this.executeRefinement(keyAfterPrompt, userPrompt, systemTemplate, config.getModelId());
        }

        return this.executeRefinement(apiKey, userPrompt, systemTemplate, config.getModelId());
    }

    private async executeRefinement(apiKey: string, userPrompt: string, systemPrompt: string, modelId: string): Promise<string> {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: modelId,
                systemInstruction: systemPrompt
            });

            const result = await model.generateContent(userPrompt);
            const response = await result.response;
            return response.text();

        } catch (error: any) {
            // Handle specific Gemini errors if needed
            throw new Error(`Gemini Error: ${error.message}`);
        }
    }
}
