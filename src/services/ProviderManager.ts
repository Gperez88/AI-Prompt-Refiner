import * as vscode from 'vscode';
import { IAIProvider } from '../providers/IAIProvider';
import { MockProvider } from '../providers/MockProvider';
import { GeminiProvider } from '../providers/GeminiProvider';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { OpenAIProvider } from '../providers/OpenAIProvider';
import { OllamaProvider } from '../providers/OllamaProvider';
import { GroqProvider } from '../providers/GroqProvider';
import { HuggingFaceProvider } from '../providers/HuggingFaceProvider';
import { PublicProvider } from '../providers/PublicProvider';
import { GitHubProvider } from '../providers/GitHubProvider';

export class ProviderManager {
    private providers: Map<string, IAIProvider>;

    constructor() {
        this.providers = new Map();

        // Register available providers
        const mock = new MockProvider();
        const gemini = new GeminiProvider();
        const openai = new OpenAIProvider();
        const ollama = new OllamaProvider();
        const groq = new GroqProvider();
        const hf = new HuggingFaceProvider();
        const publicProv = new PublicProvider();
        const github = new GitHubProvider();

        this.providers.set(mock.id, mock);
        this.providers.set(gemini.id, gemini);
        this.providers.set(openai.id, openai);
        this.providers.set(ollama.id, ollama);
        this.providers.set(groq.id, groq);
        this.providers.set(hf.id, hf);
        this.providers.set(publicProv.id, publicProv);
        this.providers.set(github.id, github);
    }

    public getActiveProvider(): IAIProvider {
        const configId = ConfigurationManager.getInstance().getProviderId();
        const provider = this.providers.get(configId);

        if (!provider) {
            // Fallback to Mock if config is invalid
            console.warn(`Provider ${configId} not found. Falling back to Mock.`);
            return this.providers.get('mock')!;
        }

        return provider;
    }
}
