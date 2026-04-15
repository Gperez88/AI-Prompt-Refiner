import { IAIProvider, RefineCallOptions, RefineResult } from './IAIProvider';
import OpenAI from 'openai';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { getApiModelId } from '../utils/ModelMappings';
import { isAbortOrUserCancellation } from '../utils/cancellationAbort';
import { promptForApiKey } from '../commands/settingsCommands';

export class OpenAIProvider implements IAIProvider {
    readonly id = 'openai';
    readonly name = 'OpenAI (GPT)';

    isConfigured(): boolean {
        return true;
    }

    async refine(userPrompt: string, systemTemplate: string, options?: RefineCallOptions): Promise<RefineResult> {
        const config = ConfigurationManager.getInstance();
        const apiKey = await config.getApiKey(this.id);

        if (!apiKey) {
            await promptForApiKey(this.id);
            const keyAfterPrompt = await config.getApiKey(this.id);
            if (!keyAfterPrompt) {
                throw new Error('API Key is required to use OpenAI.');
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
    ): Promise<RefineResult> {
        try {
            const openai = new OpenAI({
                apiKey: apiKey,
            });

            const resolved = getApiModelId(modelId, this.id) ?? modelId;
            // Adjust model name if user left default gemini one
            const effModelId = resolved.startsWith('gemini') ? 'gpt-4o-mini' : resolved;

            const reqOptions = options?.signal ? { signal: options.signal } : undefined;
            const response = await openai.chat.completions.create(
                {
                    model: effModelId,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                },
                reqOptions,
            );

            const refined = response.choices[0].message.content || '';
            const usage = response.usage;
            const tokens = (usage?.prompt_tokens || 0) + (usage?.completion_tokens || 0);

            return { refined, tokens };
        } catch (error: unknown) {
            if (isAbortOrUserCancellation(error)) {
                throw new Error('Operation cancelled');
            }
            const msg = error instanceof Error ? error.message : String(error);
            throw new Error(`OpenAI Error: ${msg}`);
        }
    }
}
