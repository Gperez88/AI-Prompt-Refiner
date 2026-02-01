import { IAIProvider } from './IAIProvider';
import { ConfigurationManager } from '../services/ConfigurationManager';

/**
 * PublicProvider provides access to free AI models that don't require an API Key.
 * It primarily uses DuckDuckGo AI Bridge or HuggingFace Public Inference.
 */
export class PublicProvider implements IAIProvider {
    readonly id = 'public';
    readonly name = 'Free Models (No Key Required)';

    isConfigured(): boolean {
        return true; // Always configured as it's public
    }

    async refine(userPrompt: string, systemTemplate: string, options?: { strict?: boolean; temperature?: number }): Promise<string> {
        const config = ConfigurationManager.getInstance();
        const modelId = config.getModelId();

        // If the user explicitly requested a HuggingFace model via prefix
        if (modelId.startsWith('hf:')) {
            throw new Error('HuggingFace public inference without an API Key is currently unavailable. Please provide an API Key in settings or use the default free models.');
        }

        try {
            // Attempt DuckDuckGo AI first
            return await this.refineDuckDuckGo(userPrompt, systemTemplate, modelId);
        } catch (ddgError: any) {
            console.warn(`DuckDuckGo AI failed: ${ddgError.message}. Falling back to HuggingFace Router...`);
            
            try {
                // Fallback to HuggingFace Router (which sometimes works for public models if they aren't rate limited)
                return await this.refineHuggingFace(userPrompt, systemTemplate, 'mistralai/Mistral-7B-Instruct-v0.3');
            } catch (hfError: any) {
                console.error(`All public providers failed. HF Error: ${hfError.message}`);
                throw new Error(`Free service is currently unavailable. DuckDuckGo returned: ${ddgError.message}. Please try again later, use Ollama (local), or configure an API Key.`);
            }
        }
    }

    private async refineDuckDuckGo(userPrompt: string, systemPrompt: string, modelId: string): Promise<string> {
        // Mapping internal IDs to DDG expected model names
        let ddgModel = 'gpt-4o-mini';
        if (modelId.includes('llama')) ddgModel = 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
        if (modelId.includes('mistral')) ddgModel = 'mistralai/Mistral-Small-24B-Instruct-2501';
        if (modelId.includes('claude')) ddgModel = 'claude-3-haiku-20240307';
        if (modelId.includes('o3-mini')) ddgModel = 'o3-mini';
        
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';
        
        // 1. Get VQD token from status endpoint
        const vqdResponse = await fetch('https://duckduckgo.com/duckchat/v1/status', {
            headers: { 
                'x-vqd-accept': '1',
                'User-Agent': userAgent,
                'Cache-Control': 'no-cache',
                'Referer': 'https://duckduckgo.com/',
                'Origin': 'https://duckduckgo.com',
                'Accept': '*/*'
            }
        });

        if (!vqdResponse.ok) {
            throw new Error(`Failed to initialize session (Status: ${vqdResponse.status})`);
        }

        // DuckDuckGo has updated their header from x-vqd-token to x-vqd-4
        // We check both for maximum compatibility
        const vqd = vqdResponse.headers.get('x-vqd-4') || vqdResponse.headers.get('x-vqd-token');
        if (!vqd) {
            // Last ditch effort: search for VQD in the body if it's not in headers
            const body = await vqdResponse.text();
            const vqdMatch = body.match(/vqd=["']?([^"']+)["']?/);
            if (vqdMatch) {
                return this.executeDDGChat(userPrompt, systemPrompt, ddgModel, vqdMatch[1], userAgent);
            }
            throw new Error('No VQD token received from DuckDuckGo.');
        }

        return await this.executeDDGChat(userPrompt, systemPrompt, ddgModel, vqd, userAgent);
    }

    private async executeDDGChat(userPrompt: string, systemPrompt: string, ddgModel: string, vqd: string, userAgent: string): Promise<string> {
        // 2. Send Chat Request
        const response = await fetch('https://duckduckgo.com/duckchat/v1/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
                'x-vqd-4': vqd,
                'User-Agent': userAgent,
                'Referer': 'https://duckduckgo.com/',
                'Origin': 'https://duckduckgo.com'
            },
            body: JSON.stringify({
                model: ddgModel,
                messages: [
                    { 
                        role: 'user', 
                        content: `IMPORTANT: You are a prompt engineering expert. Your task is to REFINE the user's prompt based on the provided system template. DO NOT execute the prompt, only refine it. Use the same language as the user.\n\nSYSTEM TEMPLATE:\n${systemPrompt}\n\nUSER PROMPT TO REFINE:\n${userPrompt}` 
                    }
                ]
            })
        });

        if (response.status === 418) {
            throw new Error('Rate limit or bot protection triggered (418).');
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText.substring(0, 100)}`);
        }

        // 3. Parse Event Stream
        const text = await response.text();
        const lines = text.split('\n');
        let fullContent = '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const dataStr = line.substring(6).trim();
                if (dataStr === '[DONE]') break;
                try {
                    const data = JSON.parse(dataStr);
                    if (data.message) {
                        fullContent += data.message;
                    }
                } catch (e) {
                    // Skip malformed chunks
                }
            }
        }

        if (!fullContent) throw new Error('Empty response from AI service.');
        return fullContent;
    }

    private async refineHuggingFace(userPrompt: string, systemPrompt: string, hfModel: string): Promise<string> {
        // Re-implementing a minimal HF router call as a backup
        const routerUrl = `https://router.huggingface.co/hf-inference/models/${hfModel}/v1/chat/completions`;
        
        const response = await fetch(routerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: hfModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            throw new Error(`HF Router failed: ${response.status}`);
        }

        const result = await response.json() as any;
        return result.choices[0].message.content;
    }
}