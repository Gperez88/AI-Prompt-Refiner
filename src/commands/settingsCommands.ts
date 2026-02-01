import * as vscode from 'vscode';
import { ConfigurationManager } from '../services/ConfigurationManager';

export async function promptForApiKey(providerId: string) {
    const key = await vscode.window.showInputBox({
        title: `Enter API Key for ${providerId}`,
        password: true,
        placeHolder: `Paste your ${providerId} API Key here`,
        ignoreFocusOut: true
    });

    if (key) {
        await ConfigurationManager.getInstance().setApiKey(providerId, key);
        vscode.window.showInformationMessage(`API Key for ${providerId} saved.`);
    }
}

export async function setApiKeyCommand() {
    const providers = [
        { label: 'GitHub Marketplace', id: 'github' },
        { label: 'OpenAI', id: 'openai' },
        { label: 'Google Gemini', id: 'gemini' },
        { label: 'Groq', id: 'groq' },
        { label: 'Hugging Face', id: 'huggingface' }
    ];

    const selected = await vscode.window.showQuickPick(providers, {
        placeHolder: 'Select a provider to set its API Key',
        title: 'Prompt Refiner: Set API Key'
    });

    if (selected) {
        await promptForApiKey(selected.id);
    }
}

export async function selectModel() {
    const models = [
        { label: '$(zap) GPT-4o Mini (Gratis - DDG)', description: 'gpt-4o-mini', provider: 'public' },
        { label: '$(zap) LLaMA 3.1 70B (Gratis - DDG)', description: 'llama-3.1-70b', provider: 'public' },
        { label: '$(zap) Claude 3 Haiku (Gratis - DDG)', description: 'claude-3-haiku', provider: 'public' },
        { label: '$(zap) Mistral 7B (HF Public - Estable)', description: 'hf:mistralai/Mistral-7B-Instruct-v0.3', provider: 'public' },
        { label: '$(zap) Qwen 2.5 7B (HF Public)', description: 'hf:Qwen/Qwen2.5-7B-Instruct', provider: 'public' },
        { label: '$(zap) Phi-3.5 Mini (HF Public)', description: 'hf:microsoft/Phi-3.5-mini-instruct', provider: 'public' },
        { label: 'Google Gemini 1.5 Flash', description: 'gemini-1.5-flash', provider: 'gemini' },
        { label: 'Google Gemini 1.5 Pro', description: 'gemini-1.5-pro', provider: 'gemini' },
        { label: 'OpenAI GPT-4o', description: 'gpt-4o', provider: 'openai' },
        { label: 'Groq LLaMA 3 70B', description: 'llama3-70b-8192', provider: 'groq' },
        { label: 'HuggingFace BLOOM', description: 'bigscience/bloom', provider: 'huggingface' },
        { label: 'GitHub: GPT-4o', description: 'gpt-4o', provider: 'github' },
        { label: 'GitHub: GPT-4o Mini', description: 'gpt-4o-mini', provider: 'github' },
        { label: 'GitHub: LLaMA 3.1 70B', description: 'llama-3.1-70b', provider: 'github' },
        { label: 'GitHub: Mistral Large', description: 'mistral-large', provider: 'github' },
        { label: 'Ollama (Local)', description: 'custom', provider: 'ollama' }
    ];

    const selected = await vscode.window.showQuickPick(models, {
        placeHolder: 'Select an AI model for prompt refinement',
        title: 'Prompt Refiner: Select Model'
    });

    if (selected) {
        const config = ConfigurationManager.getInstance();
        await config.setProviderId(selected.provider);
        await config.setModelId(selected.description);
        vscode.window.showInformationMessage(`Model set to ${selected.label} (${selected.provider})`);
    }
}
