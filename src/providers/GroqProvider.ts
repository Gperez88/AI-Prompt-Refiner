import Groq, {
    APIError,
    AuthenticationError,
    PermissionDeniedError,
    RateLimitError,
} from 'groq-sdk';
import { IAIProvider, RefineCallOptions } from './IAIProvider';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { getApiModelId } from '../utils/ModelMappings';
import { isAbortOrUserCancellation } from '../utils/cancellationAbort';
import { promptForApiKey } from '../commands/settingsCommands';
import { logger } from '../services/Logger';

type GroqErrorBody = {
    message?: unknown;
    type?: unknown;
    code?: unknown;
};

function groqFailureDetail(error: unknown): {
    status?: number;
    apiMessage: string;
    nestedType?: string;
    nestedCode?: string;
} {
    if (error instanceof APIError) {
        const body = error.error as GroqErrorBody | undefined;
        const apiMessage =
            typeof body?.message === 'string' ? body.message : error.message;
        return {
            status: typeof error.status === 'number' ? error.status : undefined,
            apiMessage,
            nestedType: typeof body?.type === 'string' ? body.type : undefined,
            nestedCode: typeof body?.code === 'string' ? body.code : undefined,
        };
    }
    return { apiMessage: error instanceof Error ? error.message : String(error) };
}

/** True only when Groq's message/code clearly refers to the model id, not generic 400s. */
function groqErrorSuggestsInvalidModel(detail: ReturnType<typeof groqFailureDetail>): boolean {
    const { apiMessage, nestedCode } = detail;
    const m = apiMessage.toLowerCase();

    if (nestedCode === 'model_decommissioned') {
        return false;
    }
    if (
        nestedCode &&
        /\bmodel\b/i.test(nestedCode) &&
        /invalid|not_found|unknown|unsupported|deprecated/i.test(nestedCode)
    ) {
        return true;
    }

    const modelNeedles = [
        'the model `',
        "the model '",
        'the model "',
        'the model ',
        'invalid model',
        'unknown model',
        'model not found',
        'no such model',
        'unsupported model',
        'model has been',
        'model is not',
        'no longer supported',
        'has been decommissioned',
    ];
    if (modelNeedles.some((n) => m.includes(n))) {
        return true;
    }
    if (/\bmodel\b/i.test(m) && /\b(does not exist|not found|not supported|is not available)\b/i.test(m)) {
        return true;
    }
    return false;
}

export class GroqProvider implements IAIProvider {
    readonly id = 'groq';
    readonly name = 'Groq (LLaMA 3.3)';

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
                throw new Error('API Key is required to use Groq.');
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
            const groq = new Groq({
                apiKey: apiKey,
            });

            const resolved = getApiModelId(modelId, this.id) ?? modelId;

            // Fallback default if user switched provider but kept old model ID
            let effModelId = resolved;
            if (!resolved || resolved.startsWith('gemini') || resolved.startsWith('gpt')) {
                effModelId = 'llama-3.3-70b-versatile';
            }

            // Handle deprecated model IDs
            if (resolved === 'llama3-70b-8192' || resolved === 'mixtral-8x7b-32768') {
                effModelId = 'llama-3.3-70b-versatile';
            }

            const reqOptions = options?.signal ? { signal: options.signal } : undefined;
            const response = await groq.chat.completions.create(
                {
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    model: effModelId,
                },
                reqOptions,
            );

            return response.choices[0]?.message?.content || '';
        } catch (error: unknown) {
            if (isAbortOrUserCancellation(error)) {
                throw new Error('Operation cancelled');
            }

            if (error instanceof AuthenticationError) {
                throw new Error(
                    'AUTH_ERROR|Invalid or expired Groq API key. ' +
                        'Please check your API key in the settings or generate a new one at https://console.groq.com/keys',
                );
            }

            if (error instanceof RateLimitError) {
                throw new Error(
                    'RATE_LIMIT|Groq API rate limit exceeded. ' +
                        'Please wait a moment and try again. ' +
                        'Check your usage at https://console.groq.com/usage',
                );
            }

            const detail = groqFailureDetail(error);
            const { apiMessage, nestedCode, nestedType, status } = detail;

            logger.debug('Groq API error detail', {
                status,
                nestedType,
                nestedCode,
                apiMessage: apiMessage.slice(0, 500),
            });

            if (
                nestedCode === 'model_decommissioned' ||
                apiMessage.includes('decommissioned') ||
                apiMessage.includes('no longer supported')
            ) {
                throw new Error(
                    `MODEL_DEPRECATED|The model "${modelId}" has been decommissioned by Groq. ` +
                        'Please select a different model. ' +
                        'Check https://console.groq.com/docs/deprecations for current models.',
                );
            }

            if (groqErrorSuggestsInvalidModel(detail)) {
                throw new Error(
                    `INVALID_MODEL|The model "${modelId}" is not available on Groq. ` +
                        `API: ${apiMessage}`,
                );
            }

            if (error instanceof PermissionDeniedError || status === 403) {
                throw new Error(`PROVIDER_ERROR|Groq denied this request (403). ${apiMessage}`);
            }

            const prefix =
                status !== undefined ? `Groq Error (${status})` : 'Groq Error';
            throw new Error(`PROVIDER_ERROR|${prefix}: ${apiMessage}`);
        }
    }
}
