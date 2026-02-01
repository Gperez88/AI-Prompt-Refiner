import * as vscode from 'vscode';
import { PromptRefinerService } from '../services/PromptRefinerService';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'promptRefiner.chatView';
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

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'refinePrompt': {
                    const prompt = data.value;
                    if (!prompt) return;

                    try {
                        const service = PromptRefinerService.getInstance();
                        const refined = await service.refine(prompt);
                        this._view?.webview.postMessage({ type: 'addMessage', role: 'assistant', content: refined });
                    } catch (error: any) {
                        this._view?.webview.postMessage({ type: 'addMessage', role: 'error', content: `Error: ${error.message}` });
                    }
                    break;
                }
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        padding: 0;
                        margin: 0;
                        display: flex;
                        flex-direction: column;
                        height: 100vh;
                        box-sizing: border-box;
                        background-color: var(--vscode-sideBar-background);
                    }
                    #chat-container {
                        flex-grow: 1;
                        overflow-y: auto;
                        padding: 10px;
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    }
                    .message {
                        padding: 10px 14px;
                        border-radius: 8px;
                        max-width: 85%;
                        white-space: pre-wrap;
                        font-size: 13px;
                        line-height: 1.5;
                        word-wrap: break-word;
                    }
                    .user {
                        align-self: flex-end;
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border-bottom-right-radius: 2px;
                    }
                    .assistant {
                        align-self: flex-start;
                        background-color: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-panel-border);
                        border-bottom-left-radius: 2px;
                        position: relative;
                        padding-bottom: 30px; /* Space for copy button */
                    }
                    .copy-btn {
                        position: absolute;
                        bottom: 4px;
                        right: 4px;
                        background: transparent;
                        color: var(--vscode-foreground);
                        border: none;
                        width: 24px;
                        height: 24px;
                        cursor: pointer;
                        border-radius: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        opacity: 0.6;
                        transition: opacity 0.2s, background-color 0.2s;
                    }
                    .copy-btn:hover {
                        opacity: 1;
                        background-color: var(--vscode-toolbar-hoverBackground);
                    }
                    .copy-btn svg {
                        width: 14px;
                        height: 14px;
                        fill: currentColor;
                    }
                    .error {
                        align-self: center;
                        background-color: var(--vscode-errorForeground);
                        color: var(--vscode-button-foreground);
                        opacity: 0.9;
                        font-size: 12px;
                    }
                    #input-area {
                        padding: 12px;
                        background-color: var(--vscode-sideBar-background);
                        border-top: 1px solid var(--vscode-panel-border);
                    }
                    .input-container {
                        position: relative;
                        background: var(--vscode-input-background);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 6px;
                        display: flex;
                        flex-direction: column;
                        transition: border-color 0.2s;
                    }
                    .input-container:focus-within {
                        border-color: var(--vscode-focusBorder);
                    }
                    textarea {
                        width: 100%;
                        background: transparent;
                        color: var(--vscode-input-foreground);
                        border: none;
                        padding: 12px 12px 40px 12px;
                        border-radius: 6px;
                        resize: none;
                        font-family: inherit;
                        font-size: 13px;
                        box-sizing: border-box;
                        outline: none;
                        min-height: 80px;
                    }
                    .input-actions {
                        position: absolute;
                        bottom: 8px;
                        right: 8px;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    #send-btn {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        width: 28px;
                        height: 28px;
                        cursor: pointer;
                        border-radius: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: background 0.2s;
                    }
                    #send-btn:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    #send-btn svg {
                        width: 16px;
                        height: 16px;
                        fill: currentColor;
                    }
                    .loading-dots {
                        display: inline-block;
                        padding-left: 4px;
                    }
                    .loading-dots::after {
                        content: '...';
                        animation: dots 1.5s steps(5, end) infinite;
                    }
                    @keyframes dots {
                        0%, 20% { content: ''; }
                        40% { content: '.'; }
                        60% { content: '..'; }
                        80%, 100% { content: '...'; }
                    }
                </style>
            </head>
            <body>
                <div id="chat-container"></div>
                <div id="input-area">
                    <div class="input-container">
                        <textarea id="prompt-input" placeholder="Describe qué quieres refinar..."></textarea>
                        <div class="input-actions">
                            <button id="send-btn" title="Refinar (Enter)">
                                <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    const chatContainer = document.getElementById('chat-container');
                    const promptInput = document.getElementById('prompt-input');
                    const sendBtn = document.getElementById('send-btn');

                    function addMessage(role, content) {
                        const msgDiv = document.createElement('div');
                        msgDiv.className = 'message ' + role;
                        
                        const textSpan = document.createElement('span');
                        textSpan.textContent = content;
                        msgDiv.appendChild(textSpan);

                        if (role === 'assistant') {
                            const copyBtn = document.createElement('button');
                            copyBtn.className = 'copy-btn';
                            copyBtn.title = 'Copiar prompt';
                            copyBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"></path></svg>';
                            
                            copyBtn.addEventListener('click', () => {
                                navigator.clipboard.writeText(content);
                                copyBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path></svg>';
                                setTimeout(() => {
                                    copyBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"></path></svg>';
                                }, 2000);
                            });
                            
                            msgDiv.appendChild(copyBtn);
                        }

                        chatContainer.appendChild(msgDiv);
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                    }

                    sendBtn.addEventListener('click', () => {
                        const text = promptInput.value.trim();
                        if (text) {
                            addMessage('user', text);
                            vscode.postMessage({ type: 'refinePrompt', value: text });
                            promptInput.value = '';
                            promptInput.style.height = 'auto'; // Reset height
                            addMessage('assistant loading', 'Refinando...');
                        }
                    });

                    promptInput.addEventListener('input', () => {
                        promptInput.style.height = 'auto';
                        promptInput.style.height = (promptInput.scrollHeight) + 'px';
                    });

                    promptInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendBtn.click();
                        }
                    });

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'addMessage': {
                                // Eliminar el mensaje de "Refinando..."
                                const loadings = document.querySelectorAll('.loading');
                                loadings.forEach(l => l.remove());
                                
                                addMessage(message.role, message.content);
                                break;
                            }
                        }
                    });
                </script>
            </body>
            </html>`;
    }
}
