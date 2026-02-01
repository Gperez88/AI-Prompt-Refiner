import { IAIProvider } from './IAIProvider';
import { ConfigurationManager } from '../services/ConfigurationManager';
// using global fetch available in VS Code extension host

export class OllamaProvider implements IAIProvider {
    readonly id = 'ollama';
    readonly name = 'Ollama (Local)';

    isConfigured(): boolean {
        return true;
    }

    /**
     * Refines the user prompt using local Ollama instance.
     */
    async refine(userPrompt: string, systemTemplate: string, options?: { strict?: boolean; temperature?: number }): Promise<string> {
        const config = ConfigurationManager.getInstance();
        const endpoint = this.sanitizeEndpoint(config.getOllamaEndpoint());
        const modelId = this.getEffectiveModelId(config.getModelId());

        if (!endpoint) {
            throw new Error('Ollama endpoint is not configured.');
        }

        const fullPrompt = this.buildFullPrompt(userPrompt, systemTemplate);
        const temperature = options?.temperature ?? 0.3;

        try {
            console.log(`Ollama Request to ${endpoint} with model ${modelId} (temp: ${temperature})`);

            // Try first with /api/chat (recommended for chat models)
            try {
                return await this.fetchChatResponse(endpoint, modelId, fullPrompt, temperature);
            } catch (chatError: any) {
                console.warn(`Ollama /api/chat failed, retrying with /api/generate: ${chatError.message}`);
                // Fallback to /api/generate
                return await this.fetchGenerateResponse(endpoint, modelId, fullPrompt, temperature);
            }

        } catch (error: any) {
            return this.handleError(error, endpoint, modelId);
        }
    }

    /**
     * Selects the effective model ID, applying defaults if necessary.
     */
    private getEffectiveModelId(configuredModelId: string): string {
        if (configuredModelId === 'custom' || !configuredModelId || 
            configuredModelId.includes('gpt-') || configuredModelId.includes('claude-')) {
            return 'llama3';
        }
        return configuredModelId;
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
     * Builds the complete prompt using the system template and minimal reinforcements for Ollama.
     */
    private buildFullPrompt(userPrompt: string, systemTemplate: string): string {
        const isSpanish = this.isSpanish(userPrompt);
        
        // Specific reinforcement for local models (Ollama) to ensure they follow the service template
        const localBooster = isSpanish 
            ? '\n\nREGLA CRÍTICA PARA MODELO LOCAL:\n- Empieza tu respuesta DIRECTAMENTE con la etiqueta [Context] o [Objective].\n- NO incluyas introducciones, preámbulos ni etiquetas inventadas (ej. [Evaluación]).\n- Responde exclusivamente con el prompt refinado siguiendo el template anterior.'
            : '\n\nCRITICAL RULE FOR LOCAL MODEL:\n- Start your response DIRECTLY with the [Context] or [Objective] tag.\n- DO NOT include introductions, preambles, or invented tags (e.g., [Evaluation]).\n- Respond exclusively with the refined prompt following the template above.';

        return `${systemTemplate}${localBooster}\n\nPrompt original del usuario: "${userPrompt}"`;
    }

    /**
     * Detects if the prompt is in Spanish using a simple heuristic.
     */
    private isSpanish(text: string): boolean {
        const spanishWords = ['el', 'la', 'los', 'las', 'un', 'una', 'y', 'que', 'en', 'para', 'con', 'por', 'como', 'esta', 'este', 'esa', 'ese'];
        const words = text.toLowerCase().split(/\W+/);
        return words.some(word => spanishWords.includes(word));
    }

    /**
     * Makes a generic request to the Ollama API.
     */
    private async fetchOllama(endpoint: string, apiPath: string, body: any): Promise<any> {
        const response = await fetch(`${endpoint}${apiPath}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (response.status === 404 && apiPath === '/api/generate') {
            await this.validateModelExists(endpoint, body.model);
        }

        if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return await response.json();
    }

    /**
     * Makes a request to the /api/chat endpoint.
     */
    private async fetchChatResponse(endpoint: string, model: string, prompt: string, temperature: number): Promise<string> {
        const data = await this.fetchOllama(endpoint, '/api/chat', {
            model,
            messages: [{ role: 'user', content: prompt }],
            stream: false,
            options: { temperature }
        }) as { message: { content: string } };

        return data.message.content;
    }

    /**
     * Makes a request to the /api/generate endpoint.
     */
    private async fetchGenerateResponse(endpoint: string, model: string, prompt: string, temperature: number): Promise<string> {
        const data = await this.fetchOllama(endpoint, '/api/generate', {
            model,
            prompt,
            stream: false,
            options: { temperature }
        }) as { response: string };

        return data.response;
    }

    /**
     * Validates if the model exists by querying /api/tags.
     */
    private async validateModelExists(endpoint: string, modelId: string): Promise<void> {
        const tagsResponse = await fetch(`${endpoint}/api/tags`).catch(() => null);
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
    private handleError(error: any, endpoint: string, modelId: string): never {
        if (error.message.includes('fetch failed') || error.message.includes('Connection refused')) {
            throw new Error(`Could not connect to Ollama at ${endpoint}. Is Ollama running?`);
        }
        throw new Error(`Ollama (${modelId}): ${error.message}`);
    }
}

