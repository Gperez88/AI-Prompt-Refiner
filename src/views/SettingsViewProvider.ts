import * as vscode from 'vscode';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { logger } from '../services/Logger';
import { InputValidator } from '../utils/ErrorHandler';
import { t } from '../i18n';

export class SettingsViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'promptRefiner.settingsView';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext,
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        this._updateHtml();

        webviewView.webview.onDidReceiveMessage(async (data) => {
            const config = ConfigurationManager.getInstance();
            switch (data.type) {
            case 'saveSettings': {
                const { provider, model, apiKey, ollamaEndpoint } = data.value;
                    
                // Validate API key if provided
                if (apiKey && apiKey !== '********' && provider !== 'public' && provider !== 'ollama') {
                    const validation = InputValidator.validateApiKey(apiKey, provider);
                    if (!validation.valid) {
                        this._view?.webview.postMessage({
                            type: 'showError',
                            message: validation.error
                        });
                        return;
                    }
                }
                    
                try {
                    await config.setProviderId(provider);
                    await config.setModelId(model);
                        
                    if (apiKey !== undefined && apiKey !== '********') {
                        await config.setApiKey(provider, apiKey);
                    }
                        
                    if (ollamaEndpoint) {
                        await vscode.workspace.getConfiguration('promptRefiner').update('ollamaEndpoint', ollamaEndpoint, vscode.ConfigurationTarget.Global);
                    }
                        
                    vscode.window.showInformationMessage(t('settingsSaved'));
                    this._updateHtml(); // Refresh UI
                    logger.info('Settings saved', { provider, model });
                } catch (error) {
                    logger.error('Failed to save settings', error as Error);
                    this._view?.webview.postMessage({
                        type: 'showError',
                        message: 'Failed to save settings'
                    });
                }
                break;
            }
            case 'refresh': {
                this._updateHtml();
                break;
            }
            }
        });
    }

    private async _updateHtml() {
        if (!this._view) return;
        this._view.webview.html = await this._getHtmlForWebview(this._view.webview);
    }

    private async _getHtmlForWebview(webview: vscode.Webview) {
        const config = ConfigurationManager.getInstance();
        const currentProvider = config.getProviderId();
        const currentModel = config.getModelId();
        const ollamaEndpoint = config.getOllamaEndpoint();
        const isStrictMode = config.isStrictMode();
        const hasKey = await config.getApiKey(currentProvider);

        const providers = [
            { id: 'public', name: t('provider') + ': ' + 'Free (DDG/HF)', description: 'No API key required. Uses free public models.' },
            { id: 'github', name: t('provider') + ': ' + 'GitHub Marketplace', description: 'Requires GitHub token with Models permission.' },
            { id: 'openai', name: t('provider') + ': ' + 'OpenAI', description: 'Requires OpenAI API key (sk-...).' },
            { id: 'gemini', name: t('provider') + ': ' + 'Google Gemini', description: 'Requires Google AI API key.' },
            { id: 'groq', name: t('provider') + ': ' + 'Groq', description: 'Requires Groq API key. Fast inference.' },
            { id: 'ollama', name: t('provider') + ': ' + 'Ollama (Local)', description: 'Runs locally. No API key needed.' }
        ];

        const modelsByProvider: Record<string, {id: string, name: string, description: string}[]> = {
            'public': [
                { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and efficient for most tasks' },
                { id: 'llama-3.1-70b', name: 'LLaMA 3.1 70B', description: 'Large open-source model' },
                { id: 'claude-3-haiku', name: 'Claude 3 Haiku', description: 'Fast and cost-effective' },
                { id: 'hf:mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B (HF)', description: 'Stable public model' }
            ],
            'github': [
                { id: 'gpt-4o', name: 'GPT-4o', description: 'Latest GPT-4 optimized model' },
                { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Smaller, faster version' },
                { id: 'llama-3.1-70b', name: 'LLaMA 3.1 70B', description: 'Meta\'s open-source model' },
                { id: 'mistral-large', name: 'Mistral Large', description: 'Powerful European model' }
            ],
            'openai': [
                { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable model' },
                { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable' }
            ],
            'gemini': [
                { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast and efficient' },
                { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Most capable Gemini model' }
            ],
            'groq': [
                { id: 'llama3-70b-8192', name: 'LLaMA 3 70B', description: 'Ultra-fast inference' },
                { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'Mixture of experts model' }
            ],
            'ollama': [
                { id: 'custom', name: 'Active Ollama Model', description: 'Uses whatever model is currently loaded in Ollama' }
            ]
        };

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        padding: 15px;
                        line-height: 1.6;
                    }
                    .section {
                        margin-bottom: 20px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                        padding-bottom: 15px;
                    }
                    .section-title {
                        font-weight: bold;
                        font-size: 11px;
                        text-transform: uppercase;
                        margin-bottom: 10px;
                        color: var(--vscode-descriptionForeground);
                    }
                    .form-group {
                        margin-bottom: 15px;
                    }
                    label {
                        display: block;
                        margin-bottom: 6px;
                        font-size: 12px;
                        font-weight: 500;
                    }
                    select, input {
                        width: 100%;
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        padding: 8px;
                        border-radius: 4px;
                        box-sizing: border-box;
                        font-size: 13px;
                    }
                    select:focus, input:focus {
                        outline: none;
                        border-color: var(--vscode-focusBorder);
                    }
                    .hint {
                        font-size: 11px;
                        color: var(--vscode-descriptionForeground);
                        margin-top: 6px;
                        line-height: 1.4;
                    }
                    .hint strong {
                        color: var(--vscode-foreground);
                    }
                    button {
                        width: 100%;
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 10px;
                        cursor: pointer;
                        border-radius: 4px;
                        font-weight: bold;
                        font-size: 13px;
                        transition: background 0.2s;
                    }
                    button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    button:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                    .hidden { display: none !important; }
                    .info-box {
                        background: var(--vscode-textBlockQuote-background);
                        border-left: 3px solid var(--vscode-textBlockQuote-border);
                        padding: 10px;
                        margin-bottom: 15px;
                        font-size: 12px;
                    }
                    .validation-error {
                        color: var(--vscode-errorForeground);
                        font-size: 11px;
                        margin-top: 5px;
                    }
                    .success-message {
                        color: var(--vscode-gitDecoration-addedResourceForeground);
                        font-size: 12px;
                        margin-top: 10px;
                        text-align: center;
                    }
                    .error-message {
                        color: var(--vscode-errorForeground);
                        font-size: 12px;
                        margin-top: 10px;
                        text-align: center;
                    }
                </style>
            </head>
            <body>
                <div class="info-box">
                    <strong>💡 Tip:</strong> Start with "Free (DDG/HF)" provider for instant use without API keys.
                </div>

                <div class="section">
                    <div class="section-title">API Configuration</div>
                    
                    <div class="form-group">
                        <label for="provider-select">${t('provider')} *</label>
                        <select id="provider-select">
                            ${providers.map(p => `<option value="${p.id}" ${p.id === currentProvider ? 'selected' : ''}>${p.name}</option>`).join('')}
                        </select>
                        <div class="hint" id="provider-hint">${providers.find(p => p.id === currentProvider)?.description || ''}</div>
                    </div>

                    <div class="form-group">
                        <label for="model-select">${t('model')} *</label>
                        <select id="model-select"></select>
                        <div class="hint" id="model-hint"></div>
                    </div>

                    <div id="api-key-group" class="form-group ${currentProvider === 'public' || currentProvider === 'ollama' ? 'hidden' : ''}">
                        <label for="api-key-input">${t('apiKey')}</label>
                        <input type="password" id="api-key-input" placeholder="${hasKey ? '******** (saved)' : 'Enter your API key here...'}" value="">
                        <div class="hint" id="key-hint"></div>
                        <div class="validation-error" id="key-error"></div>
                    </div>

                    <div id="ollama-group" class="form-group ${currentProvider === 'ollama' ? '' : 'hidden'}">
                        <label for="ollama-input">Ollama Endpoint</label>
                        <input type="text" id="ollama-input" value="${ollamaEndpoint}" placeholder="http://localhost:11434">
                        <div class="hint">Make sure Ollama is running on this endpoint.</div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Options</div>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="strict-mode" ${isStrictMode ? 'checked' : ''}>
                            ${t('strictMode')}
                        </label>
                        <div class="hint">${t('strictModeHint')}</div>
                    </div>
                </div>

                <button id="save-btn">${t('save')}</button>
                <div id="message-area"></div>

                <script>
                    const vscode = acquireVsCodeApi();
                    const modelsByProvider = ${JSON.stringify(modelsByProvider)};
                    
                    const providerSelect = document.getElementById('provider-select');
                    const modelSelect = document.getElementById('model-select');
                    const apiKeyGroup = document.getElementById('api-key-group');
                    const apiKeyInput = document.getElementById('api-key-input');
                    const ollamaGroup = document.getElementById('ollama-group');
                    const providerHint = document.getElementById('provider-hint');
                    const modelHint = document.getElementById('model-hint');
                    const keyHint = document.getElementById('key-hint');
                    const keyError = document.getElementById('key-error');
                    const saveBtn = document.getElementById('save-btn');
                    const messageArea = document.getElementById('message-area');
                    const strictModeCheckbox = document.getElementById('strict-mode');

                    function updateUI() {
                        const provider = providerSelect.value;
                        const providerData = modelsByProvider[provider] || [];
                        
                        // Update models dropdown
                        const currentModelId = '${currentModel}';
                        modelSelect.innerHTML = providerData.map(m => 
                            \`<option value="\${m.id}" \${m.id === currentModelId ? 'selected' : ''}>\${m.name}</option>\`
                        ).join('');
                        
                        // Update hints
                        const selectedModel = providerData.find(m => m.id === modelSelect.value);
                        modelHint.textContent = selectedModel?.description || '';
                        
                        // Show/hide API key field
                        const needsKey = provider !== 'public' && provider !== 'ollama';
                        apiKeyGroup.classList.toggle('hidden', !needsKey);
                        ollamaGroup.classList.toggle('hidden', provider !== 'ollama');

                        // Update provider hint
                        const providerInfo = ${JSON.stringify(providers)}.find(p => p.id === provider);
                        providerHint.textContent = providerInfo?.description || '';

                        // Update key hint based on provider
                        if (provider === 'github') {
                            keyHint.textContent = 'Requires GitHub Personal Access Token with "GitHub Models" permission.';
                        } else if (provider === 'openai') {
                            keyHint.textContent = 'Should start with "sk-". Get yours at platform.openai.com';
                        } else if (provider === 'gemini') {
                            keyHint.textContent = 'Get your API key at makersuite.google.com';
                        } else if (provider === 'groq') {
                            keyHint.textContent = 'Get your API key at console.groq.com';
                        } else {
                            keyHint.textContent = '';
                        }
                    }

                    function validateApiKey() {
                        keyError.textContent = '';
                        const provider = providerSelect.value;
                        const key = apiKeyInput.value;
                        
                        if (!key || key.includes('***')) return true;
                        
                        if (provider === 'openai' && !key.startsWith('sk-')) {
                            keyError.textContent = 'OpenAI API key should start with "sk-"';
                            return false;
                        }
                        
                        if (provider === 'github' && !key.startsWith('ghp_') && !key.startsWith('github_pat_')) {
                            keyError.textContent = 'GitHub token format appears invalid';
                            return false;
                        }
                        
                        return true;
                    }

                    function showMessage(message, isError = false) {
                        messageArea.textContent = message;
                        messageArea.className = isError ? 'error-message' : 'success-message';
                        setTimeout(() => {
                            messageArea.textContent = '';
                            messageArea.className = '';
                        }, 5000);
                    }

                    providerSelect.addEventListener('change', updateUI);
                    modelSelect.addEventListener('change', updateUI);
                    apiKeyInput.addEventListener('input', validateApiKey);
                    
                    saveBtn.addEventListener('click', () => {
                        if (!validateApiKey()) return;
                        
                        saveBtn.disabled = true;
                        saveBtn.textContent = 'Saving...';
                        
                        vscode.postMessage({
                            type: 'saveSettings',
                            value: {
                                provider: providerSelect.value,
                                model: modelSelect.value,
                                apiKey: apiKeyInput.value,
                                ollamaEndpoint: document.getElementById('ollama-input').value,
                                strictMode: strictModeCheckbox.checked
                            }
                        });
                    });

                    window.addEventListener('message', event => {
                        const data = event.data;
                        if (data.type === 'showError') {
                            showMessage(data.message, true);
                            saveBtn.disabled = false;
                            saveBtn.textContent = '${t('save')}';
                        }
                    });

                    updateUI();
                </script>
            </body>
            </html>`;
    }
}
