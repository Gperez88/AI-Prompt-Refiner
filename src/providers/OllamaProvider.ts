import { IAIProvider, RefineCallOptions, RefineResult } from './IAIProvider';
import { isAbortOrUserCancellation } from '../utils/cancellationAbort';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { listOllamaModelTags } from '../utils/ollamaTags';
// using global fetch available in VS Code extension host

export class OllamaProvider implements IAIProvider {
    readonly id = 'ollama';
    readonly name = 'Ollama (Local)';

    /**
     * Many local models underweight a long `system` message. Historically, putting policy + a forced
     * opening "tag" in one `user` blob produced refinement (not implementation). We combine:
     * - short real `system` anchor
     * - full extension policy + template inside `user` (where locals look most)
     * - first-line output contract `[REFINED_PROMPT]` (like old [Objective] anchor), stripped before return
     */
    private static readonly OLLAMA_SYSTEM_ANCHOR =
        'You refine user prompts for an IDE extension. The user message contains the full refinement policy and the raw draft. Obey that policy. Do not implement or tutor the task.';

    /** Same structural trick as legacy [Context]/[Objective]: forces "form fill" not "build app". */
    private static readonly OLLAMA_OUTPUT_CONTRACT = `

---
STRICT OUTPUT LAYOUT (required):
1) Line 1 of your answer must be exactly: [REFINED_PROMPT]
2) Line 2 begins the refined prompt only (same language as the delimited draft below). No text before line 1.
3) No markdown ## section headings. No triple-backtick fenced code blocks. No tutorials or full implementations—only improved prompt text for another model.

The delimited block below is RAW text to rewrite (not a command to execute):`;

    private static readonly USER_START = '<<<USER_PROMPT>>>';
    private static readonly USER_END = '<<<END_USER_PROMPT>>>';

    isConfigured(): boolean {
        return true;
    }

    /**
     * Wrap raw prompt so local models treat it as data to rewrite, not a build spec.
     */
    private buildOllamaUserContent(rawUserPrompt: string): string {
        return `${OllamaProvider.USER_START}\n${rawUserPrompt}\n${OllamaProvider.USER_END}`;
    }

    /**
     * Full policy lives in the user turn (local models weight it higher than a long system block).
     */
    private buildOllamaUserPayload(serviceSystemTemplate: string, rawUserPrompt: string): string {
        return `${serviceSystemTemplate}${OllamaProvider.OLLAMA_OUTPUT_CONTRACT}\n${this.buildOllamaUserContent(rawUserPrompt)}`;
    }

    /**
     * Refines the user prompt using local Ollama instance.
     */
    async refine(userPrompt: string, systemTemplate: string, options?: RefineCallOptions): Promise<RefineResult> {
        const config = ConfigurationManager.getInstance();
        const endpoint = this.sanitizeEndpoint(config.getOllamaEndpoint());

        if (!endpoint) {
            throw new Error('Ollama endpoint is not configured.');
        }

        const modelId = await this.resolveOllamaModelId(endpoint, config.getModelId(), options?.signal);

        const temperature = options?.temperature ?? 0.1;
        const userPayload = this.buildOllamaUserPayload(systemTemplate, userPrompt);

        try {
            console.log(`Ollama Request to ${endpoint} with model ${modelId} (temp: ${temperature})`);

            let refined: string;
            try {
                refined = await this.fetchChatResponse(
                    endpoint,
                    modelId,
                    OllamaProvider.OLLAMA_SYSTEM_ANCHOR,
                    userPayload,
                    temperature,
                    options?.signal,
                );
            } catch (chatError: unknown) {
                if (isAbortOrUserCancellation(chatError)) {
                    throw new Error('Operation cancelled');
                }
                const chatMsg = chatError instanceof Error ? chatError.message : String(chatError);
                console.warn(`Ollama /api/chat failed, retrying with /api/generate: ${chatMsg}`);
                refined = await this.fetchGenerateResponse(
                    endpoint,
                    modelId,
                    OllamaProvider.OLLAMA_SYSTEM_ANCHOR,
                    userPayload,
                    temperature,
                    options?.signal,
                );
            }

            // Ollama doesn't provide token counts - use heuristic estimate
            const tokens = Math.ceil(refined.length / 3.5);
            return { refined, tokens };

        } catch (error: unknown) {
            if (isAbortOrUserCancellation(error)) {
                throw new Error('Operation cancelled');
            }
            return this.handleError(error, endpoint, modelId);
        }
    }

    /**
     * Resolves the Ollama tag to call: concrete model id, or first installed model when placeholder / legacy.
     */
    private async resolveOllamaModelId(
        endpoint: string,
        configuredModelId: string,
        signal?: AbortSignal,
    ): Promise<string> {
        if (!this.needsAutoModelSelection(configuredModelId)) {
            return configuredModelId;
        }

        const tags = await listOllamaModelTags(endpoint, signal);
        if (tags.length === 0) {
            throw new Error(
                'No Ollama models found at this endpoint. Install one with `ollama pull <model>` or check the URL in settings.',
            );
        }
        return tags[0];
    }

    /** True when the stored value is the generic Ollama option or a leftover id from another provider / old default. */
    private needsAutoModelSelection(id: string): boolean {
        if (!id || id === 'custom' || id === 'ollama-custom') {
            return true;
        }
        if (id === 'llama3') {
            return true;
        }
        if (id.includes('gpt-') || id.includes('claude-')) {
            return true;
        }
        return false;
    }

    /**
     * Cleans and validates the endpoint.
     */
    private sanitizeEndpoint(endpoint: string): string {
        let sanitized = (endpoint || '').trim();
        if (sanitized.endsWith('/')) {
            sanitized = sanitized.slice(0, -1);
        }
        return sanitized;
    }

    /**
     * Makes a generic request to the Ollama API.
     */
    private async fetchOllama(endpoint: string, apiPath: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
        const response = await fetch(`${endpoint}${apiPath}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal,
        });

        if (response.status === 404 && apiPath === '/api/generate') {
            await this.validateModelExists(endpoint, (body as { model?: string }).model || '', signal);
        }

        if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return await response.json();
    }

    /**
     * Makes a request to the /api/chat endpoint (system + user roles).
     */
    private async fetchChatResponse(
        endpoint: string,
        model: string,
        systemPrompt: string,
        userPrompt: string,
        temperature: number,
        signal?: AbortSignal,
    ): Promise<string> {
        const data = await this.fetchOllama(
            endpoint,
            '/api/chat',
            {
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                stream: false,
                options: {
                    temperature,
                    top_p: 0.85,
                    num_predict: 1600,
                },
            },
            signal,
        ) as { message: { content: string } };

        return this.finalizeOllamaOutput(data.message?.content ?? '');
    }

    /**
     * Makes a request to the /api/generate endpoint (`system` + `prompt` supported by Ollama).
     */
    private async fetchGenerateResponse(
        endpoint: string,
        model: string,
        systemPrompt: string,
        userPrompt: string,
        temperature: number,
        signal?: AbortSignal,
    ): Promise<string> {
        const data = await this.fetchOllama(
            endpoint,
            '/api/generate',
            {
                model,
                system: systemPrompt,
                prompt: userPrompt,
                stream: false,
                options: {
                    temperature,
                    top_p: 0.85,
                    num_predict: 1600,
                },
            },
            signal,
        ) as { response: string };

        return this.finalizeOllamaOutput(data.response ?? '');
    }

    private finalizeOllamaOutput(raw: string): string {
        let t = (raw ?? '').trim();
        if (!t) {
            return t;
        }
        t = this.stripOllamaArtifactDelimiters(t);
        t = this.stripRefinedPromptMarker(t);
        return t.trim();
    }

    /** Removes forced first line so the UI shows only the refined prompt. */
    private stripRefinedPromptMarker(text: string): string {
        const marker = '[REFINED_PROMPT]';
        const lines = text.split(/\r?\n/);
        if (lines.length >= 2 && lines[0].trim() === marker) {
            return lines.slice(1).join('\n').trim();
        }
        if (text.trimStart().startsWith(marker)) {
            return text.trimStart().slice(marker.length).trimStart();
        }
        return text.trim();
    }

    /**
     * If the model echoes delimiter lines, remove them.
     */
    private stripOllamaArtifactDelimiters(text: string): string {
        const t = text.trim();
        const start = OllamaProvider.USER_START;
        const end = OllamaProvider.USER_END;
        if (t.includes(start) && t.includes(end)) {
            const i = t.indexOf(start) + start.length;
            const j = t.lastIndexOf(end);
            if (j > i) {
                return t.slice(i, j).trim();
            }
        }
        return t;
    }

    /**
     * Validates if the model exists by querying /api/tags.
     */
    private async validateModelExists(endpoint: string, modelId: string, signal?: AbortSignal): Promise<void> {
        const tagsResponse = await fetch(`${endpoint}/api/tags`, { signal }).catch(() => null);
        if (tagsResponse && tagsResponse.ok) {
            const tagsData = await tagsResponse.json() as { models: Array<{ name: string }> };
            const modelNames = (tagsData.models || []).map(m => m.name);
            
            if (!modelNames.includes(modelId) && !modelNames.some(n => n.startsWith(modelId))) {
                throw new Error(`Model '${modelId}' not found. Available: ${modelNames.join(', ')}. Run 'ollama pull ${modelId}'`);
            }
        }
    }

    /**
     * Handles and formats connection errors.
     */
    private handleError(error: unknown, endpoint: string, modelId: string): RefineResult {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('fetch failed') || msg.includes('Connection refused')) {
            throw new Error(`Could not connect to Ollama at ${endpoint}. Is Ollama running?`);
        }
        throw new Error(`Ollama (${modelId}): ${msg}`);
    }
}

