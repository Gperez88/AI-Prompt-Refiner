import { IAIProvider } from './IAIProvider';
import Groq from 'groq-sdk';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { promptForApiKey } from '../commands/settingsCommands';

export class GroqProvider implements IAIProvider {
    readonly id = 'groq';
    readonly name = 'Groq (LLaMA 3.3)';

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
                effModelId = 'llama-3.3-70b-versatile';
            }
            
            // Handle deprecated model IDs
            if (modelId === 'llama3-70b-8192' || modelId === 'mixtral-8x7b-32768') {
                effModelId = 'llama-3.3-70b-versatile';
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
            // Handle specific Groq errors
            const errorMessage = error.message || '';
            const errorCode = error.code || '';
            
            // Detect decommissioned/deprecated model errors
            if (errorCode === 'model_decommissioned' || 
                errorMessage.includes('decommissioned') ||
                errorMessage.includes('no longer supported')) {
                throw new Error(
                    `MODEL_DEPRECATED|The model "${modelId}" has been decommissioned by Groq. ` +
                    'Please select a different model. ' +
                    'Check https://console.groq.com/docs/deprecations for current models.'
                );
            }
            
            // Detect invalid model errors
            if (errorCode === 'invalid_request_error' || 
                errorMessage.includes('invalid_request_error') ||
                errorMessage.includes('not found') ||
                errorMessage.includes('does not exist')) {
                throw new Error(
                    `INVALID_MODEL|The model "${modelId}" is not available on Groq. ` +
                    'Please check your settings and select a valid model.'
                );
            }
            
            // Detect authentication errors
            if (errorMessage.includes('401') || 
                errorMessage.includes('Unauthorized') ||
                errorMessage.includes('API key') ||
                errorMessage.includes('authentication')) {
                throw new Error(
                    'AUTH_ERROR|Invalid or expired Groq API key. ' +
                    'Please check your API key in the settings or generate a new one at https://console.groq.com/keys'
                );
            }
            
            // Detect rate limit errors (429)
            if (errorMessage.includes('429') || 
                errorMessage.includes('rate limit') ||
                errorMessage.includes('Too Many Requests')) {
                throw new Error(
                    'RATE_LIMIT|Groq API rate limit exceeded. ' +
                    'Please wait a moment and try again. ' +
                    'Check your usage at https://console.groq.com/usage'
                );
            }
            
            // Default error
            throw new Error(`Groq Error: ${error.message}`);
        }
    }
}
