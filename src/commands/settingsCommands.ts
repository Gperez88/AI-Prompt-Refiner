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
        // Free providers temporarily disabled
        // { label: '$(zap) GPT-4o Mini (Gratis - DDG)', description: 'gpt-4o-mini', provider: 'public' },
        // { label: '$(zap) LLaMA 3.1 70B (Gratis - DDG)', description: 'llama-3.1-70b', provider: 'public' },
        // { label: '$(zap) Claude 3 Haiku (Gratis - DDG)', description: 'claude-3-haiku', provider: 'public' },
        // { label: '$(zap) Mistral 7B (HF Public - Estable)', description: 'hf:mistralai/Mistral-7B-Instruct-v0.3', provider: 'public' },
        // { label: '$(zap) Qwen 2.5 7B (HF Public)', description: 'hf:Qwen/Qwen2.5-7B-Instruct', provider: 'public' },
        // { label: '$(zap) Phi-3.5 Mini (HF Public)', description: 'hf:microsoft/Phi-3.5-mini-instruct', provider: 'public' },
        { label: 'Google Gemini 2.0 Flash', description: 'gemini-flash', provider: 'gemini' },
        { label: 'Google Gemini 2.0 Pro', description: 'gemini-pro', provider: 'gemini' },
        { label: 'OpenAI GPT-4o', description: 'gpt-4o', provider: 'openai' },
        { label: 'Groq Llama 3.3 70B', description: 'groq-llama3-70b', provider: 'groq' },
        { label: 'HuggingFace BLOOM', description: 'bigscience/bloom', provider: 'huggingface' },
        { label: 'GitHub: GPT-4o', description: 'github-gpt-4o', provider: 'github' },
        { label: 'GitHub: GPT-4o Mini', description: 'github-gpt-4o-mini', provider: 'github' },
        // NOTE: LLaMA and Mistral models removed temporarily due to API name issues
        // { label: 'GitHub: LLaMA 3.1 70B', description: 'github-llama-3.1-70b', provider: 'github' },
        // { label: 'GitHub: Mistral Large', description: 'github-mistral-large', provider: 'github' },
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

/**
 * Show configuration status for all providers
 */
export async function showProvidersStatus() {
    const config = ConfigurationManager.getInstance();
    const allProviders = await config.getAllProvidersConfigurationStatus();
    
    const configuredProviders = allProviders.filter(p => p.isConfigured);
    const unconfiguredProviders = allProviders.filter(p => !p.isConfigured && p.requiresApiKey);
    
    let message = '## Providers Configuration Status\n\n';
    
    if (configuredProviders.length > 0) {
        message += `✅ **Configured (${configuredProviders.length}):**\n`;
        configuredProviders.forEach(p => {
            message += `  • ${p.name}${p.requiresApiKey ? ' (API Key Set)' : ''}\n`;
        });
        message += '\n';
    }
    
    if (unconfiguredProviders.length > 0) {
        message += `⚠️ **Need Configuration (${unconfiguredProviders.length}):**\n`;
        unconfiguredProviders.forEach(p => {
            message += `  • ${p.name} (API Key Required)\n`;
        });
    }
    
    const action = await vscode.window.showInformationMessage(
        message,
        { modal: false, detail: `${configuredProviders.length} of ${allProviders.length} providers ready to use` },
        'Set API Key',
        'Close'
    );
    
    if (action === 'Set API Key') {
        await setApiKeyCommand();
    }
}

/**
 * Clear API key for a specific provider
 */
export async function clearApiKeyCommand() {
    const config = ConfigurationManager.getInstance();
    const allProviders = await config.getAllProvidersConfigurationStatus();
    
    // Only show providers that have API keys set
    const providersWithKeys = allProviders.filter(p => p.hasApiKey);
    
    if (providersWithKeys.length === 0) {
        vscode.window.showInformationMessage('No API keys are currently configured.');
        return;
    }
    
    const items = providersWithKeys.map(p => ({
        label: p.name,
        description: 'API Key is set',
        id: p.id
    }));
    
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a provider to clear its API Key',
        title: 'Prompt Refiner: Clear API Key'
    });
    
    if (selected) {
        const confirmation = await vscode.window.showWarningMessage(
            `Are you sure you want to clear the API Key for ${selected.label}?`,
            { modal: true },
            'Yes',
            'No'
        );
        
        if (confirmation === 'Yes') {
            await config.clearApiKey(selected.id);
            vscode.window.showInformationMessage(`API Key for ${selected.label} has been cleared.`);
        }
    }
}

/**
 * Quick switch between configured providers
 */
export async function switchProviderCommand() {
    const config = ConfigurationManager.getInstance();
    const allProviders = await config.getAllProvidersConfigurationStatus();
    
    // Get only configured providers
    const configuredProviders = allProviders.filter(p => p.isConfigured);
    
    if (configuredProviders.length < 2) {
        vscode.window.showInformationMessage(
            `Only ${configuredProviders.length} provider(s) configured. Configure more providers to switch between them.`,
            'Set API Key'
        ).then(action => {
            if (action === 'Set API Key') {
                setApiKeyCommand();
            }
        });
        return;
    }
    
    const currentProviderId = config.getProviderId();
    
    const items = configuredProviders.map(p => ({
        label: `${p.id === currentProviderId ? '$(check) ' : ''}${p.name}`,
        description: p.id === currentProviderId ? 'Currently Active' : 'Click to activate',
        id: p.id
    }));
    
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a provider to activate (all configured providers are shown)',
        title: `Prompt Refiner: Switch Provider (${configuredProviders.length} configured)`
    });
    
    if (selected && selected.id !== currentProviderId) {
        await config.setProviderId(selected.id);
        
        // Set a default model for the new provider
        const defaultModels: Record<string, string> = {
            'github': 'github-gpt-4o',
            'openai': 'gpt-4o',
            'gemini': 'gemini-flash',
            'groq': 'groq-llama3-70b',
            'huggingface': 'bigscience/bloom',
            'anthropic': 'claude-3-haiku',
            'ollama': 'custom'
        };
        
        const defaultModel = defaultModels[selected.id] || 'custom';
        await config.setModelId(defaultModel);
        
        vscode.window.showInformationMessage(`Switched to ${selected.label.replace('$(check) ', '')}`);
    }
}
