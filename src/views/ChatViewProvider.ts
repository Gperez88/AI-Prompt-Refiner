import * as vscode from 'vscode';
import { PromptRefinerService } from '../services/PromptRefinerService';
import { logger } from '../services/Logger';
import { ErrorHandler, RateLimiter, InputValidator } from '../utils/ErrorHandler';
import { ChatHistoryManager, ChatMessage } from '../services/ChatHistoryManager';
import { ConfigurationManager } from '../services/ConfigurationManager';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'promptRefiner.chatView';
    private _view?: vscode.WebviewView;
    private rateLimiter!: RateLimiter;
    private historyManager: ChatHistoryManager;
    private editingMessageId: string | null = null;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext,
    ) {
        this.rateLimiter = new RateLimiter(1000);
        this.historyManager = ChatHistoryManager.getInstance();
    }

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

        // Initialize history manager
        this.historyManager.initialize(this._context);

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Load initial history
        this._loadHistory();

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
            case 'refinePrompt': {
                await this._handleRefinePrompt(data.value);
                break;
            }
            case 'editMessage': {
                await this._handleEditMessage(data.messageId, data.newContent);
                break;
            }
            case 'deleteMessage': {
                await this._handleDeleteMessage(data.messageId);
                break;
            }
            case 'reRefine': {
                await this._handleReRefine(data.content);
                break;
            }
            case 'clearHistory': {
                await this._handleClearHistory();
                break;
            }
            case 'searchHistory': {
                await this._handleSearch(data.query);
                break;
            }
            case 'startEditing': {
                this.editingMessageId = data.messageId;
                break;
            }
            case 'cancelEditing': {
                this.editingMessageId = null;
                break;
            }
            }
        });
    }

    private async _handleRefinePrompt(prompt: string) {
        if (!prompt) return;

        // Rate limiting
        const rateLimit = this.rateLimiter.canProceed();
        if (!rateLimit.allowed) {
            const waitSeconds = Math.ceil((rateLimit.remainingMs || 0) / 1000);
            this._view?.webview.postMessage({
                type: 'showError',
                content: `Please wait ${waitSeconds} seconds before sending another request.`
            });
            return;
        }

        // Validation
        const validation = InputValidator.validatePromptLength(prompt);
        if (!validation.valid) {
            this._view?.webview.postMessage({
                type: 'showError',
                content: validation.error
            });
            return;
        }

        const config = ConfigurationManager.getInstance();
        const provider = config.getProviderId();
        const model = config.getModelId();

        // Add user message to history
        const userMessage = await this.historyManager.addMessage({
            role: 'user',
            content: prompt,
            provider,
            model
        });

        this._view?.webview.postMessage({
            type: 'addMessage',
            message: userMessage
        });

        // Show loading
        this._view?.webview.postMessage({ type: 'setLoading', loading: true });

        logger.info('Chat refinement started', { textLength: prompt.length, provider, model });

        try {
            const service = PromptRefinerService.getInstance();
            const result = await service.refine(prompt);
            const refined = result.refined;

            // Add assistant message to history
            const assistantMessage = await this.historyManager.addMessage({
                role: 'assistant',
                content: refined,
                provider,
                model
            });

            this._view?.webview.postMessage({
                type: 'addMessage',
                message: assistantMessage
            });

            logger.info('Chat refinement completed successfully');
        } catch (error: any) {
            const errorInfo = ErrorHandler.classifyError(error);
            logger.error('Chat refinement failed', error, errorInfo);

            // Add error message to history
            const errorMessage = await this.historyManager.addMessage({
                role: 'error',
                content: errorInfo.userMessage,
                provider,
                model
            });

            this._view?.webview.postMessage({
                type: 'addMessage',
                message: errorMessage
            });
        } finally {
            this._view?.webview.postMessage({ type: 'setLoading', loading: false });
        }
    }

    private async _handleEditMessage(messageId: string, newContent: string) {
        if (!newContent.trim()) return;

        const updated = await this.historyManager.updateMessage(messageId, {
            content: newContent,
            timestamp: Date.now() // Update timestamp to reflect edit
        });

        if (updated) {
            this._view?.webview.postMessage({
                type: 'updateMessage',
                message: updated
            });
            this.editingMessageId = null;
        }
    }

    private async _handleDeleteMessage(messageId: string) {
        const deleted = await this.historyManager.deleteMessage(messageId);
        if (deleted) {
            this._view?.webview.postMessage({
                type: 'removeMessage',
                messageId
            });
        }
    }

    private async _handleReRefine(content: string) {
        // Put the content back in the input for re-refinement
        this._view?.webview.postMessage({
            type: 'setInput',
            content
        });
    }

    private async _handleClearHistory() {
        await this.historyManager.clearHistory();
        this._view?.webview.postMessage({ type: 'clearAll' });
    }

    private async _handleSearch(query: string) {
        if (!query.trim()) {
            await this._loadHistory();
            return;
        }

        const results = await this.historyManager.searchHistory(query);
        this._view?.webview.postMessage({
            type: 'loadHistory',
            messages: results
        });
    }

    private async _loadHistory() {
        const history = await this.historyManager.getHistory();
        this._view?.webview.postMessage({
            type: 'loadHistory',
            messages: history
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'assets', 'icon.png'));
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prompt Refiner Chat</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        /* Header */
        .header {
            padding: 10px 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            gap: 10px;
            align-items: center;
            background-color: var(--vscode-sideBar-background);
        }
        
        .search-box {
            flex: 1;
            padding: 6px 10px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-size: 13px;
        }
        
        .search-box:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        .header-btn {
            padding: 6px 10px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: background 0.2s;
        }
        
        .header-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        /* Chat Container */
        #chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 15px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .message {
            max-width: 90%;
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 13px;
            line-height: 1.5;
            position: relative;
            animation: fadeIn 0.3s ease;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .message.user {
            align-self: flex-end;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-bottom-right-radius: 2px;
        }
        
        .message.assistant {
            align-self: flex-start;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-bottom-left-radius: 2px;
        }
        
        .message.error {
            align-self: center;
            background-color: var(--vscode-errorBackground, rgba(255, 0, 0, 0.1));
            border: 1px solid var(--vscode-errorForeground);
            color: var(--vscode-errorForeground);
            font-size: 12px;
        }
        
        .message-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
            font-size: 11px;
            opacity: 0.7;
        }
        
        .message-role {
            font-weight: bold;
            text-transform: capitalize;
        }
        
        .message-time {
            font-size: 10px;
        }
        
        .message-content {
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        .message-actions {
            display: flex;
            gap: 5px;
            margin-top: 8px;
            opacity: 0;
            transition: opacity 0.2s;
        }
        
        .message:hover .message-actions {
            opacity: 1;
        }
        
        .action-btn {
            padding: 4px 8px;
            background: transparent;
            border: 1px solid var(--vscode-panel-border);
            color: var(--vscode-foreground);
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .action-btn:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }
        
        /* Edit Mode */
        .edit-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .edit-textarea {
            width: 100%;
            min-height: 60px;
            padding: 8px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-family: inherit;
            font-size: 13px;
            resize: vertical;
        }
        
        .edit-actions {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        }
        
        .edit-btn {
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .edit-btn.save {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .edit-btn.cancel {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        /* Input Area */
        #input-area {
            padding: 15px;
            border-top: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-sideBar-background);
        }
        
        .input-wrapper {
            position: relative;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 8px;
            padding: 12px;
            transition: border-color 0.2s;
        }
        
        .input-wrapper:focus-within {
            border-color: var(--vscode-focusBorder);
        }
        
        .input-wrapper.loading {
            opacity: 0.7;
            pointer-events: none;
        }
        
        textarea {
            width: 100%;
            min-height: 60px;
            max-height: 200px;
            background: transparent;
            border: none;
            color: var(--vscode-input-foreground);
            font-family: inherit;
            font-size: 13px;
            resize: none;
            outline: none;
        }
        
        .input-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 8px;
        }
        
        .char-count {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
        
        .send-btn {
            padding: 8px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: background 0.2s;
        }
        
        .send-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .send-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        /* Loading Indicator */
        .loading-indicator {
            display: none;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        
        .loading-indicator.active {
            display: flex;
        }
        
        .spinner {
            width: 16px;
            height: 16px;
            border: 2px solid var(--vscode-panel-border);
            border-top-color: var(--vscode-button-background);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        /* Empty State */
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: var(--vscode-descriptionForeground);
        }
        
        .empty-state h3 {
            margin-bottom: 10px;
            font-weight: normal;
        }
        
        .empty-state p {
            font-size: 12px;
        }
        
        /* Logo Section */
        .logo-section {
            padding: 15px 0 5px 0;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: var(--vscode-sideBar-background);
        }
        
        .logo-section img {
            width: 48px;
            height: 48px;
            object-fit: contain;
        }
    </style>
</head>
<body>
    <!-- Logo -->
    <div class="logo-section">
        <img src="${iconUri}" alt="AI Prompt Refiner Logo" />
    </div>

    <!-- Header -->
    <div class="header">
        <input type="text" class="search-box" id="search-box" placeholder="Search history...">
        <button class="header-btn" id="clear-btn" title="Clear History">Clear</button>
    </div>

    <!-- Chat Container -->
    <div id="chat-container">
        <div class="empty-state" id="empty-state">
            <h3>No messages yet</h3>
            <p>Type a prompt below to start refining</p>
        </div>
    </div>

    <!-- Input Area -->
    <div id="input-area">
        <div class="input-wrapper" id="input-wrapper">
            <textarea id="prompt-input" placeholder="Describe what you want to refine..." rows="3"></textarea>
            <div class="input-footer">
                <span class="char-count" id="char-count">0/4000</span>
                <div class="loading-indicator" id="loading-indicator">
                    <div class="spinner"></div>
                    <span>Refining...</span>
                </div>
                <button class="send-btn" id="send-btn">
                    <span>Refine</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                </button>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const chatContainer = document.getElementById('chat-container');
        const promptInput = document.getElementById('prompt-input');
        const sendBtn = document.getElementById('send-btn');
        const charCount = document.getElementById('char-count');
        const loadingIndicator = document.getElementById('loading-indicator');
        const inputWrapper = document.getElementById('input-wrapper');
        const emptyState = document.getElementById('empty-state');
        const searchBox = document.getElementById('search-box');
        const clearBtn = document.getElementById('clear-btn');

        let messages = [];
        let editingId = null;

        // Send message
        function sendMessage() {
            const text = promptInput.value.trim();
            if (!text || inputWrapper.classList.contains('loading')) return;

            vscode.postMessage({ type: 'refinePrompt', value: text });
            promptInput.value = '';
            updateCharCount();
        }

        // Update character count
        function updateCharCount() {
            const count = promptInput.value.length;
            charCount.textContent = \`\${count}/4000\`;
            charCount.style.color = count > 4000 ? 'var(--vscode-errorForeground)' : 'var(--vscode-descriptionForeground)';
        }

        // Create message element
        function createMessageElement(message) {
            const div = document.createElement('div');
            div.className = \`message \${message.role}\`;
            div.dataset.id = message.id;

            const date = new Date(message.timestamp);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            if (editingId === message.id) {
                // Edit mode
                div.innerHTML = \`
                    <div class="edit-container">
                        <textarea class="edit-textarea" id="edit-\${message.id}">\${escapeHtml(message.content)}</textarea>
                        <div class="edit-actions">
                            <button class="edit-btn cancel" onclick="cancelEdit()">Cancel</button>
                            <button class="edit-btn save" onclick="saveEdit('\${message.id}')">Save</button>
                        </div>
                    </div>
                \`;
            } else {
                // Normal mode
                div.innerHTML = \`
                    <div class="message-header">
                        <span class="message-role">\${message.role}</span>
                        <span class="message-time">\${timeStr}</span>
                    </div>
                    <div class="message-content">\${escapeHtml(message.content)}</div>
                    <div class="message-actions">
                        <button class="action-btn" onclick="copyMessage('\${message.id}')" title="Copy">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                            </svg>
                            Copy
                        </button>
                        \${message.role === 'user' ? \`
                        <button class="action-btn" onclick="startEdit('\${message.id}')" title="Edit">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                            Edit
                        </button>
                        \` : \`
                        <button class="action-btn" onclick="reRefine('\${message.id}')" title="Re-refine">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                            </svg>
                            Re-refine
                        </button>
                        \`}
                        <button class="action-btn" onclick="deleteMessage('\${message.id}')" title="Delete">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                            Delete
                        </button>
                    </div>
                \`;
            }

            return div;
        }

        // Escape HTML to prevent XSS
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Action handlers
        function copyMessage(id) {
            const message = messages.find(m => m.id === id);
            if (message) {
                navigator.clipboard.writeText(message.content);
                showToast('Copied to clipboard');
            }
        }

        function startEdit(id) {
            editingId = id;
            vscode.postMessage({ type: 'startEditing', messageId: id });
            renderMessages();
        }

        function cancelEdit() {
            editingId = null;
            vscode.postMessage({ type: 'cancelEditing' });
            renderMessages();
        }

        function saveEdit(id) {
            const textarea = document.getElementById(\`edit-\${id}\`);
            if (textarea) {
                vscode.postMessage({
                    type: 'editMessage',
                    messageId: id,
                    newContent: textarea.value
                });
            }
        }

        function deleteMessage(id) {
            if (confirm('Are you sure you want to delete this message?')) {
                vscode.postMessage({ type: 'deleteMessage', messageId: id });
            }
        }

        function reRefine(id) {
            const message = messages.find(m => m.id === id);
            if (message) {
                promptInput.value = message.content;
                updateCharCount();
                promptInput.focus();
            }
        }

        function showToast(message) {
            // Simple toast notification
            const toast = document.createElement('div');
            toast.style.cssText = \`
                position: fixed;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                padding: 8px 16px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 1000;
            \`;
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        }

        // Render all messages
        function renderMessages() {
            chatContainer.innerHTML = '';
            
            if (messages.length === 0) {
                chatContainer.appendChild(emptyState);
                return;
            }

            messages.forEach(message => {
                chatContainer.appendChild(createMessageElement(message));
            });

            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        // Event listeners
        sendBtn.addEventListener('click', sendMessage);
        
        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        promptInput.addEventListener('input', updateCharCount);

        searchBox.addEventListener('input', (e) => {
            vscode.postMessage({ type: 'searchHistory', query: e.target.value });
        });

        clearBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all history?')) {
                vscode.postMessage({ type: 'clearHistory' });
            }
        });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const data = event.data;
            
            switch (data.type) {
                case 'loadHistory':
                    messages = data.messages || [];
                    renderMessages();
                    break;
                    
                case 'addMessage':
                    messages.push(data.message);
                    if (emptyState.parentNode) {
                        emptyState.remove();
                    }
                    chatContainer.appendChild(createMessageElement(data.message));
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                    break;
                    
                case 'updateMessage':
                    const index = messages.findIndex(m => m.id === data.message.id);
                    if (index !== -1) {
                        messages[index] = data.message;
                        editingId = null;
                        renderMessages();
                    }
                    break;
                    
                case 'removeMessage':
                    messages = messages.filter(m => m.id !== data.messageId);
                    renderMessages();
                    if (messages.length === 0) {
                        chatContainer.appendChild(emptyState);
                    }
                    break;
                    
                case 'clearAll':
                    messages = [];
                    chatContainer.innerHTML = '';
                    chatContainer.appendChild(emptyState);
                    break;
                    
                case 'setLoading':
                    if (data.loading) {
                        inputWrapper.classList.add('loading');
                        loadingIndicator.classList.add('active');
                        sendBtn.disabled = true;
                    } else {
                        inputWrapper.classList.remove('loading');
                        loadingIndicator.classList.remove('active');
                        sendBtn.disabled = false;
                    }
                    break;
                    
                case 'showError':
                    showToast(data.content);
                    break;
                    
                case 'setInput':
                    promptInput.value = data.content;
                    updateCharCount();
                    promptInput.focus();
                    break;
            }
        });

        // Initial char count
        updateCharCount();
    </script>
</body>
</html>`;
    }
}
