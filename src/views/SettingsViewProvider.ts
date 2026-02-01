import * as vscode from 'vscode';
import { ConfigurationManager } from '../services/ConfigurationManager';

export class SettingsViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'promptRefiner.settingsView';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
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
                    
                    await config.setProviderId(provider);
                    await config.setModelId(model);
                    
                    if (apiKey !== undefined && apiKey !== '********') {
                        await config.setApiKey(provider, apiKey);
                    }
                    
                    if (ollamaEndpoint) {
                        await vscode.workspace.getConfiguration('promptRefiner').update('ollamaEndpoint', ollamaEndpoint, vscode.ConfigurationTarget.Global);
                    }
                    
                    vscode.window.showInformationMessage('Configuración guardada correctamente.');
                    this._updateHtml(); // Refresh UI
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
        const hasKey = await config.getApiKey(currentProvider);

        const providers = [
            { id: 'public', name: 'Gratis (DDG/HF)' },
            { id: 'github', name: 'GitHub Marketplace' },
            { id: 'openai', name: 'OpenAI' },
            { id: 'gemini', name: 'Google Gemini' },
            { id: 'groq', name: 'Groq' },
            { id: 'ollama', name: 'Ollama (Local)' }
        ];

        const modelsByProvider: Record<string, {id: string, name: string}[]> = {
            'public': [
                { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
                { id: 'llama-3.1-70b', name: 'LLaMA 3.1 70B' },
                { id: 'claude-3-haiku', name: 'Claude 3 Haiku' },
                { id: 'hf:mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B (HF)' }
            ],
            'github': [
                { id: 'gpt-4o', name: 'GPT-4o' },
                { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
                { id: 'llama-3.1-70b', name: 'LLaMA 3.1 70B' },
                { id: 'mistral-large', name: 'Mistral Large' }
            ],
            'openai': [
                { id: 'gpt-4o', name: 'GPT-4o' },
                { id: 'gpt-4o-mini', name: 'GPT-4o Mini' }
            ],
            'gemini': [
                { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
                { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' }
            ],
            'groq': [
                { id: 'llama3-70b-8192', name: 'LLaMA 3 70B' },
                { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' }
            ],
            'ollama': [
                { id: 'custom', name: 'Usar modelo local activo' }
            ]
        };

        return `<!DOCTYPE html>
            <html lang="es">
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
                        margin-bottom: 12px;
                    }
                    label {
                        display: block;
                        margin-bottom: 4px;
                        font-size: 12px;
                    }
                    select, input {
                        width: 100%;
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        padding: 6px;
                        border-radius: 4px;
                        box-sizing: border-box;
                    }
                    .hint {
                        font-size: 11px;
                        color: var(--vscode-descriptionForeground);
                        margin-top: 4px;
                    }
                    button {
                        width: 100%;
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px;
                        cursor: pointer;
                        border-radius: 4px;
                        font-weight: bold;
                    }
                    button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    .hidden { display: none; }
                </style>
            </head>
            <body>
                <div class="section">
                    <div class="section-title">API Configuration</div>
                    
                    <div class="form-group">
                        <label>Provider</label>
                        <select id="provider-select">
                            ${providers.map(p => `<option value="${p.id}" ${p.id === currentProvider ? 'selected' : ''}>${p.name}</option>`).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Model</label>
                        <select id="model-select"></select>
                    </div>

                    <div id="api-key-group" class="form-group ${currentProvider === 'public' || currentProvider === 'ollama' ? 'hidden' : ''}">
                        <label>API Key / Token</label>
                        <input type="password" id="api-key-input" placeholder="${hasKey ? '********' : 'Introduce tu clave aquí...'}" value="${hasKey ? '********' : ''}">
                        <div class="hint" id="key-hint"></div>
                    </div>

                    <div id="ollama-group" class="form-group ${currentProvider === 'ollama' ? '' : 'hidden'}">
                        <label>Ollama Endpoint</label>
                        <input type="text" id="ollama-input" value="${ollamaEndpoint}">
                    </div>
                </div>

                <button id="save-btn">Guardar Configuración</button>

                <script>
                    const vscode = acquireVsCodeApi();
                    const modelsByProvider = ${JSON.stringify(modelsByProvider)};
                    
                    const providerSelect = document.getElementById('provider-select');
                    const modelSelect = document.getElementById('model-select');
                    const apiKeyGroup = document.getElementById('api-key-group');
                    const apiKeyInput = document.getElementById('api-key-input');
                    const ollamaGroup = document.getElementById('ollama-group');
                    const keyHint = document.getElementById('key-hint');
                    const saveBtn = document.getElementById('save-btn');

                    function updateUI() {
                        const provider = providerSelect.value;
                        
                        // Update models
                        const models = modelsByProvider[provider] || [];
                        modelSelect.innerHTML = models.map(m => \`<option value="\${m.id}" \${m.id === '${currentModel}' ? 'selected' : ''}>\${m.name}</option>\`).join('');
                        
                        // Show/Hide fields
                        apiKeyGroup.classList.toggle('hidden', provider === 'public' || provider === 'ollama');
                        ollamaGroup.classList.toggle('hidden', provider !== 'ollama');

                        // Update hints
                        if (provider === 'github') keyHint.textContent = 'Requiere Token con permiso "GitHub Models".';
                        else if (provider === 'public') keyHint.textContent = '';
                        else keyHint.textContent = 'La clave se guarda de forma segura.';
                    }

                    providerSelect.addEventListener('change', updateUI);
                    
                    saveBtn.addEventListener('click', () => {
                        vscode.postMessage({
                            type: 'saveSettings',
                            value: {
                                provider: providerSelect.value,
                                model: modelSelect.value,
                                apiKey: apiKeyInput.value,
                                ollamaEndpoint: document.getElementById('ollama-input').value
                            }
                        });
                    });

                    updateUI();
                </script>
            </body>
            </html>`;
    }
}
