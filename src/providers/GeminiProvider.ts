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
            // Handle specific Gemini errors
            const errorMessage = error.message || '';
            
            // Detect quota exceeded errors (429)
            if (errorMessage.includes('429') || 
                errorMessage.includes('quota') || 
                errorMessage.includes('rate limit') ||
                errorMessage.includes('exceeded') ||
                errorMessage.includes('Too Many Requests')) {
                
                // Extract retry delay if available
                const retryMatch = errorMessage.match(/retry in\s+(\d+(?:\.\d+)?)\s*s/i);
                const retryTime = retryMatch ? `${Math.ceil(parseFloat(retryMatch[1]))} seconds` : 'a few minutes';
                
                throw new Error(
                    'QUOTA_EXCEEDED|Google Gemini API quota exceeded. ' +
                    'You\'ve reached your daily or per-minute request limit. ' +
                    `Please wait ${retryTime} before trying again, ` +
                    'or consider upgrading your plan at https://ai.google.dev/gemini-api/docs/rate-limits'
                );
            }
            
            // Detect authentication errors (401/403)
            if (errorMessage.includes('401') || 
                errorMessage.includes('403') || 
                errorMessage.includes('API key') ||
                errorMessage.includes('invalid') ||
                errorMessage.includes('not valid')) {
                throw new Error(
                    'AUTH_ERROR|Invalid or expired Google Gemini API key. ' +
                    'Please check your API key in the settings or generate a new one at https://aistudio.google.com/app/apikey'
                );
            }
            
            // Detect model not found errors (404)
            if (errorMessage.includes('404') || 
                errorMessage.includes('not found') ||
                errorMessage.includes('does not exist')) {
                throw new Error(
                    'MODEL_ERROR|The selected model is not available. ' +
                    'Please select a different model or try again later.'
                );
            }
            
            // Default error with original message
            throw new Error(`Gemini Error: ${error.message}`);
        }
    }
}
