import * as vscode from 'vscode';
import { PromptRefinerService } from '../services/PromptRefinerService';
import { logger } from '../services/Logger';
import { ErrorHandler, RateLimiter, InputValidator } from '../utils/ErrorHandler';
import { SessionManager } from '../services/SessionManager';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { RoleId, isValidRoleId, getRoleById, PREDEFINED_ROLES } from '../types/Role';
import { Analytics } from '../services/Analytics';

/**
 * Message types for webview communication
 */
type WebviewMessage =
  | { type: 'refinePrompt'; value: string }
  | { type: 'editMessage'; messageId: string; newContent: string }
  | { type: 'deleteMessage'; messageId: string }
  | { type: 'reRefine'; content: string }
  | { type: 'clearSession' }
  | { type: 'searchMessages'; query: string }
  | { type: 'startEditing'; messageId: string }
  | { type: 'cancelEditing' }
  | { type: 'createSession'; name?: string; role?: string }
  | { type: 'requestSessionName' }
  | { type: 'requestRoleSelection'; name?: string }
  | { type: 'switchSession'; sessionId: string }
  | { type: 'renameSession'; sessionId: string; newName: string }
  | { type: 'deleteSession'; sessionId: string }
  | { type: 'archiveSession'; sessionId: string }
  | { type: 'unarchiveSession'; sessionId: string }
  | { type: 'exportSession'; sessionId: string }
  | { type: 'importSession'; json: string }
  | { type: 'getAllSessions' }
  | { type: 'getSessionStats' }
  | { type: 'saveInputState'; value: string }
  | { type: 'loadInitialState' }
  | { type: 'openSettings' }
  | { type: 'exportAllSessions' }
  | { type: 'clearAllSessions' };

/**
 * Provider for the chat view webview panel
 * Implements multi-session chat with persistence
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'promptRefiner.chatView';
    private _view?: vscode.WebviewView;
    private rateLimiter!: RateLimiter;
    private sessionManager: SessionManager;
    private editingMessageId: string | null = null;

    constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
    ) {
        this.rateLimiter = new RateLimiter(1000);
        this.sessionManager = SessionManager.getInstance();
    }

    /**
   * Resolve the webview view
   */
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

        // Initialize session manager
        this.sessionManager.initialize(this._context).then(() => {
            // Load initial state after initialization
            this._loadInitialState();
        });

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async (data: WebviewMessage) => {
            try {
                switch (data.type) {
                // Message handling
                case 'refinePrompt':
                    await this._handleRefinePrompt(data.value);
                    break;
                case 'editMessage':
                    await this._handleEditMessage(data.messageId, data.newContent);
                    break;
                case 'deleteMessage':
                    await this._handleDeleteMessage(data.messageId);
                    break;
                case 'reRefine':
                    await this._handleReRefine(data.content);
                    break;
                case 'clearSession':
                    await this._handleClearSession();
                    break;
                case 'searchMessages':
                    await this._handleSearchMessages(data.query);
                    break;
                case 'startEditing':
                    this.editingMessageId = data.messageId;
                    break;
                case 'cancelEditing':
                    this.editingMessageId = null;
                    break;

                    // Session management
                case 'createSession':
                    await this._handleCreateSession(data.name, data.role);
                    break;
                case 'requestSessionName':
                    await this._handleRequestSessionName();
                    break;
                case 'requestRoleSelection':
                    await this._handleRequestRoleSelection(data.name);
                    break;
                case 'switchSession':
                    await this._handleSwitchSession(data.sessionId);
                    break;
                case 'renameSession':
                    await this._handleRenameSession(data.sessionId, data.newName);
                    break;
                case 'deleteSession':
                    await this._handleDeleteSession(data.sessionId);
                    break;
                case 'archiveSession':
                    await this._handleArchiveSession(data.sessionId);
                    break;
                case 'unarchiveSession':
                    await this._handleUnarchiveSession(data.sessionId);
                    break;
                case 'exportSession':
                    await this._handleExportSession(data.sessionId);
                    break;
                case 'importSession':
                    await this._handleImportSession(data.json);
                    break;
                case 'getAllSessions':
                    await this._handleGetAllSessions();
                    break;
                case 'getSessionStats':
                    await this._handleGetSessionStats();
                    break;

                    // State management
                case 'saveInputState':
                    await this._handleSaveInputState(data.value);
                    break;
                case 'loadInitialState':
                    await this._loadInitialState();
                    break;

                    // Menu actions
                case 'openSettings':
                    await this._handleOpenSettings();
                    break;
                case 'exportAllSessions':
                    await this._handleExportAllSessions();
                    break;
                case 'clearAllSessions':
                    await this._handleClearAllSessions();
                    break;
                }
            } catch (error) {
                logger.error(`Error handling message ${data.type}`, error as Error);
                this._view?.webview.postMessage({
                    type: 'showError',
                    content: `Error: ${(error as Error).message}`
                });
            }
        });
    }

    // ==================== MESSAGE HANDLERS ====================

    /**
   * Handle prompt refinement
   */
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

        // Get or create active session
        let activeSession = await this.sessionManager.getActiveSession();
        if (!activeSession) {
            // Auto-create a session if none exists
            const suggestedName = await this.sessionManager.suggestSessionName(prompt);
            activeSession = await this.sessionManager.createSession(suggestedName);
            await this._notifySessionListChanged();
        }

        // Add user message to session
        const userMessage = await this.sessionManager.addMessageToSession(activeSession.id, {
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

        logger.info('Chat refinement started', { 
            textLength: prompt.length, 
            provider, 
            model,
            sessionId: activeSession.id 
        });

        try {
            const service = PromptRefinerService.getInstance();
            const result = await service.refine(prompt);
            const refined = result.refined;

            // Add assistant message to session
            const assistantMessage = await this.sessionManager.addMessageToSession(activeSession.id, {
                role: 'assistant',
                content: refined,
                provider,
                model
            });

            this._view?.webview.postMessage({
                type: 'addMessage',
                message: assistantMessage
            });

            // Update session metadata in UI
            await this._notifySessionListChanged();

            logger.info('Chat refinement completed successfully', { sessionId: activeSession.id });
        } catch (error: any) {
            const errorInfo = ErrorHandler.classifyError(error);
            logger.error('Chat refinement failed', error, errorInfo);

            // Add error message to session
            const errorMessage = await this.sessionManager.addMessageToSession(activeSession.id, {
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

    /**
   * Handle message editing
   */
    private async _handleEditMessage(messageId: string, newContent: string) {
        if (!newContent.trim()) return;

        const activeSession = await this.sessionManager.getActiveSession();
        if (!activeSession) return;

        const updated = await this.sessionManager.updateMessage(
            activeSession.id,
            messageId,
            { content: newContent }
        );

        if (updated) {
            this._view?.webview.postMessage({
                type: 'updateMessage',
                message: updated
            });
            this.editingMessageId = null;
        }
    }

    /**
   * Handle message deletion
   */
    private async _handleDeleteMessage(messageId: string) {
        const activeSession = await this.sessionManager.getActiveSession();
        if (!activeSession) return;

        const deleted = await this.sessionManager.deleteMessage(activeSession.id, messageId);
        if (deleted) {
            this._view?.webview.postMessage({
                type: 'removeMessage',
                messageId
            });
        }
    }

    /**
   * Handle re-refinement (load message into input)
   */
    private async _handleReRefine(content: string) {
        this._view?.webview.postMessage({
            type: 'setInput',
            content
        });
    }

    /**
   * Handle clearing the current session
   */
    private async _handleClearSession() {
        const activeSession = await this.sessionManager.getActiveSession();
        if (!activeSession) return;

        await this.sessionManager.clearSessionMessages(activeSession.id);
    
        this._view?.webview.postMessage({ 
            type: 'clearAll' 
        });
    }

    /**
   * Handle searching messages in current session
   */
    private async _handleSearchMessages(query: string) {
        const activeSession = await this.sessionManager.getActiveSession();
        if (!activeSession) return;

        if (!query.trim()) {
            // Show all messages
            const messages = await this.sessionManager.getMessages(activeSession.id);
            this._view?.webview.postMessage({
                type: 'loadSession',
                session: {
                    ...activeSession,
                    messages
                }
            });
            return;
        }

        const results = await this.sessionManager.searchMessages(activeSession.id, query);
        this._view?.webview.postMessage({
            type: 'loadMessages',
            messages: results,
            isSearchResult: true
        });
    }

    // ==================== SESSION HANDLERS ====================

    /**
   * Handle creating a new session
   */
    private async _handleCreateSession(name?: string, role?: string) {
        // Validate role and cast to RoleId if valid
        const validatedRole = role && isValidRoleId(role) ? role as RoleId : undefined;
        const session = await this.sessionManager.createSession(name, validatedRole);
        
        // Track analytics
        const roleId = validatedRole || 'programmer';
        const roleInfo = getRoleById(roleId);
        Analytics.getInstance().trackSessionCreated(roleId, roleInfo?.name || 'Programmer');
        
        await this._notifySessionListChanged();

        this._view?.webview.postMessage({
            type: 'sessionCreated',
            session
        });

        // Load the new session
        await this._loadSession(session.id);
    }

    /**
   * Handle requesting session name from user (prompt doesn't work in sandboxed webview)
   */
    private async _handleRequestSessionName() {
        const name = await vscode.window.showInputBox({
            prompt: 'Session name (optional)',
            placeHolder: 'Enter a name for the new session',
            ignoreFocusOut: true
        });
        
        // User cancelled - don't proceed
        if (name === undefined) {
            return;
        }
        
        // Now request role selection
        await this._handleRequestRoleSelection(name || undefined);
    }

    /**
   * Handle requesting role selection from user
   */
    private async _handleRequestRoleSelection(name?: string) {
        const roles = [
            { label: '💻 Programmer', description: 'Software engineering focus', id: 'programmer' },
            { label: '✍️ Writer', description: 'Professional writing focus', id: 'writer' },
            { label: '🔬 Researcher', description: 'Research and analysis focus', id: 'researcher' },
            { label: '📊 Analyst', description: 'Problem analysis focus', id: 'analyst' }
        ];
        
        const selected = await vscode.window.showQuickPick(roles, {
            placeHolder: 'Select a role for this session',
            ignoreFocusOut: true
        });
        
        // User cancelled or selected a role - create session
        const roleId = selected?.id || 'programmer';
        await this._handleCreateSession(name, roleId);
    }

    /**
   * Handle switching to a different session
   */
    private async _handleSwitchSession(sessionId: string) {
        await this.sessionManager.setActiveSession(sessionId);
        await this._loadSession(sessionId);
        await this._notifySessionListChanged();
    }

    /**
   * Handle renaming a session
   */
    private async _handleRenameSession(sessionId: string, newName: string) {
        await this.sessionManager.renameSession(sessionId, newName);
        await this._notifySessionListChanged();
    
        this._view?.webview.postMessage({
            type: 'sessionRenamed',
            sessionId,
            newName
        });
    }

    /**
   * Handle deleting a session
   */
    private async _handleDeleteSession(sessionId: string) {
        logger.info('Handling deleteSession', { sessionId });
        try {
            await this.sessionManager.deleteSession(sessionId);
            await this._notifySessionListChanged();
            
            // Load the new active session (or empty state)
            const activeSession = await this.sessionManager.getActiveSession();
            if (activeSession) {
                await this._loadSession(activeSession.id);
            } else {
                this._view?.webview.postMessage({ type: 'clearAll' });
            }
            logger.info('Session deleted successfully', { sessionId });
        } catch (error) {
            logger.error('Failed to delete session', error as Error, { sessionId });
            this._view?.webview.postMessage({
                type: 'showError',
                content: `Failed to delete session: ${(error as Error).message}`
            });
        }
    }

    /**
   * Handle archiving a session
   */
    private async _handleArchiveSession(sessionId: string) {
        await this.sessionManager.archiveSession(sessionId);
        await this._notifySessionListChanged();
    
        // If archived session was active, load the new active one
        const activeSession = await this.sessionManager.getActiveSession();
        if (activeSession) {
            await this._loadSession(activeSession.id);
        }
    }

    /**
   * Handle unarchiving a session
   */
    private async _handleUnarchiveSession(sessionId: string) {
        await this.sessionManager.unarchiveSession(sessionId);
        await this._notifySessionListChanged();
    }

    /**
   * Handle exporting a session
   */
    private async _handleExportSession(sessionId: string) {
        try {
            const json = await this.sessionManager.exportSession(sessionId);
      
            // Copy to clipboard
            await vscode.env.clipboard.writeText(json);
      
            this._view?.webview.postMessage({
                type: 'showSuccess',
                content: 'Session exported to clipboard'
            });
        } catch (error) {
            this._view?.webview.postMessage({
                type: 'showError',
                content: `Failed to export: ${(error as Error).message}`
            });
        }
    }

    /**
   * Handle importing a session
   */
    private async _handleImportSession(json: string) {
        try {
            const session = await this.sessionManager.importSession(json);
            await this._notifySessionListChanged();
      
            this._view?.webview.postMessage({
                type: 'sessionImported',
                session
            });
        } catch (error) {
            this._view?.webview.postMessage({
                type: 'showError',
                content: `Failed to import: ${(error as Error).message}`
            });
        }
    }

    /**
   * Handle getting all sessions
   */
    private async _handleGetAllSessions() {
        const sessions = await this.sessionManager.getAllSessions({ includeArchived: true });
        this._view?.webview.postMessage({
            type: 'allSessions',
            sessions
        });
    }

    /**
   * Handle getting session stats
   */
    private async _handleGetSessionStats() {
        const stats = await this.sessionManager.getStats();
        this._view?.webview.postMessage({
            type: 'sessionStats',
            stats
        });
    }

    /**
     * Handle opening settings panel
     */
    private async _handleOpenSettings() {
        // Execute the command to show settings view
        await vscode.commands.executeCommand('promptRefiner.settingsView.focus');
        logger.debug('Settings panel opened from menu');
    }

    /**
     * Handle exporting all sessions
     */
    private async _handleExportAllSessions() {
        try {
            const json = await this.sessionManager.exportAllSessions();
            await vscode.env.clipboard.writeText(json);
            this._view?.webview.postMessage({
                type: 'showSuccess',
                content: 'All sessions exported to clipboard'
            });
            logger.info('All sessions exported');
        } catch (error) {
            logger.error('Failed to export all sessions', error as Error);
            this._view?.webview.postMessage({
                type: 'showError',
                content: `Failed to export: ${(error as Error).message}`
            });
        }
    }

    /**
     * Handle clearing all sessions
     */
    private async _handleClearAllSessions() {
        logger.info('Handling clearAllSessions');
        try {
            await this.sessionManager.clearAllSessions();
            // Notify webview to update session list
            await this._notifySessionListChanged();
            // Clear the chat view
            this._view?.webview.postMessage({ type: 'clearAll' });
            this._view?.webview.postMessage({
                type: 'showSuccess',
                content: 'All sessions cleared'
            });
            logger.info('All sessions cleared successfully');
        } catch (error) {
            logger.error('Failed to clear all sessions', error as Error);
            this._view?.webview.postMessage({
                type: 'showError',
                content: `Failed to clear: ${(error as Error).message}`
            });
        }
    }

    // ==================== STATE MANAGEMENT ====================

    /**
   * Handle saving input state (for persistence)
   */
    private async _handleSaveInputState(value: string) {
    // The webview handles this via vscode.setState()
    // This is here in case we want to do server-side persistence in the future
        logger.debug('Input state saved', { length: value.length });
    }

    /**
   * Load initial state when webview opens
   */
    private async _loadInitialState() {
        const activeSession = await this.sessionManager.getActiveSession();
        const config = ConfigurationManager.getInstance();
        
        // Get current template info
        const isStrictMode = config.isStrictMode();
        const templateName = isStrictMode ? 'Strict' : 'Normal';
    
        if (activeSession) {
            // Get role info for active session
            const roleId = activeSession.metadata?.role || 'programmer';
            const role = getRoleById(roleId);
            
            // Send session info with role
            this._view?.webview.postMessage({
                type: 'initialState',
                session: {
                    ...activeSession,
                    roleInfo: role ? {
                        id: role.id,
                        name: role.name,
                        icon: role.icon
                    } : null
                },
                hasSessions: true,
                templateInfo: {
                    name: templateName,
                    isStrict: isStrictMode
                }
            });
        } else {
            // No sessions yet
            this._view?.webview.postMessage({
                type: 'initialState',
                session: null,
                hasSessions: false,
                templateInfo: {
                    name: templateName,
                    isStrict: isStrictMode
                }
            });
        }

        // Send all sessions for the selector
        await this._notifySessionListChanged();
    }

    /**
   * Load a specific session into the view
   */
    private async _loadSession(sessionId: string) {
        const session = await this.sessionManager.getSession(sessionId);
        if (!session) return;

        const messages = await this.sessionManager.getMessages(sessionId);
    
        this._view?.webview.postMessage({
            type: 'loadSession',
            session: {
                ...session,
                messages
            }
        });
    }

    /**
   * Notify the webview that session list has changed
   */
    private async _notifySessionListChanged() {
        const sessions = await this.sessionManager.getAllSessions({ includeArchived: true });
        const activeSession = await this.sessionManager.getActiveSession();
        
        // Enrich sessions with role information
        const sessionsWithRoles = sessions.map(session => {
            const roleId = session.metadata?.role || 'programmer';
            const role = getRoleById(roleId);
            return {
                ...session,
                roleInfo: role ? {
                    id: role.id,
                    name: role.name,
                    icon: role.icon
                } : null
            };
        });
    
        this._view?.webview.postMessage({
            type: 'sessionListChanged',
            sessions: sessionsWithRoles,
            activeSessionId: activeSession?.id || null
        });
    }

    // ==================== HTML GENERATION ====================

    /**
   * Generate the HTML for the webview
   */
    private _getHtmlForWebview(webview: vscode.Webview) {
        const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'assets', 'icon.png'));

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Prompt Refiner Chat</title>
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

        /* Main Panel Header */
        .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-sideBar-background);
        }

        .panel-title-wrapper {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .panel-title {
            font-size: 11px;
            font-weight: 600;
            color: var(--vscode-foreground);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .template-indicator {
            font-size: 9px;
            padding: 2px 6px;
            border-radius: 3px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            font-weight: 500;
            cursor: default;
        }

        .template-indicator.strict {
            background: var(--vscode-errorBackground);
            color: var(--vscode-errorForeground);
        }

        .panel-actions {
            display: flex;
            gap: 4px;
            align-items: center;
        }

        /* Action Buttons */
        .action-icon-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            background: transparent;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            color: var(--vscode-foreground);
            font-size: 16px;
            transition: all 0.2s;
            padding: 0;
        }

        .action-icon-btn:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }

        .action-icon-btn svg {
            width: 16px;
            height: 16px;
            fill: currentColor;
        }

        /* Session Selector */
        .session-selector {
            background-color: var(--vscode-sideBar-background);
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .session-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .session-title {
            font-size: 11px;
            font-weight: 600;
            color: var(--vscode-foreground);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .session-header-actions {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .view-all-btn {
            padding: 4px 10px;
            background: transparent;
            color: var(--vscode-textLink-foreground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            transition: all 0.2s;
        }

        .view-all-btn:hover {
            background: var(--vscode-list-hoverBackground);
            border-color: var(--vscode-focusBorder);
        }

        /* Menu Button */
        .menu-btn {
            padding: 4px 8px;
            background: transparent;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            color: var(--vscode-foreground);
            transition: all 0.2s;
            line-height: 1;
        }

        .menu-btn:hover {
            background: var(--vscode-list-hoverBackground);
            border-color: var(--vscode-focusBorder);
        }

        /* Dropdown Menu */
        .dropdown-menu {
            position: absolute;
            top: 100%;
            right: 15px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            z-index: 100;
            display: none;
            min-width: 160px;
            margin-top: 4px;
        }

        .dropdown-menu.show {
            display: block;
        }

        .dropdown-item {
            padding: 8px 12px;
            cursor: pointer;
            font-size: 12px;
            color: var(--vscode-foreground);
            display: flex;
            align-items: center;
            gap: 8px;
            transition: background 0.2s;
        }

        .dropdown-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .dropdown-item:first-child {
            border-radius: 4px 4px 0 0;
        }

        .dropdown-item:last-child {
            border-radius: 0 0 4px 4px;
        }

        .dropdown-divider {
            height: 1px;
            background: var(--vscode-panel-border);
            margin: 4px 0;
        }

        /* Session List - Vertical List Style */
        .session-list-container {
            display: flex;
            flex-direction: column;
        }

        .session-list {
            display: flex;
            flex-direction: column;
        }

        .session-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
            cursor: pointer;
            transition: background 0.2s;
        }

        .session-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .session-item.active {
            background: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }

        .session-item:last-child {
            border-bottom: none;
        }

        .session-item-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex: 1;
        }

        .session-name {
            font-weight: 500;
            font-size: 13px;
            color: var(--vscode-foreground);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .role-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            opacity: 0.8;
        }

        .session-status {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .session-meta {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            text-align: right;
            white-space: nowrap;
        }

        /* Show More Button */
        .show-more-btn {
            width: 100%;
            padding: 10px 15px;
            background: transparent;
            border: none;
            border-top: 1px solid var(--vscode-panel-border);
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
            font-size: 12px;
            text-align: center;
            transition: background 0.2s;
        }

        .show-more-btn:hover {
            background: var(--vscode-list-hoverBackground);
        }

        /* New Session Button */
        .new-session-item {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 12px 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
            cursor: pointer;
            transition: background 0.2s;
            color: var(--vscode-textLink-foreground);
            font-size: 13px;
            font-weight: 500;
        }

        .new-session-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .new-session-item::before {
            content: "+";
            margin-right: 8px;
            font-size: 16px;
            font-weight: bold;
        }

        /* Full Session List Modal */
        .session-list-full {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 90%;
            max-width: 500px;
            max-height: 70vh;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            display: none;
            flex-direction: column;
        }

        .session-list-full.expanded {
            display: flex;
        }

        .session-list-full-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .session-list-full-title {
            font-size: 14px;
            font-weight: 600;
        }

        .session-list-full-close {
            background: transparent;
            border: none;
            color: var(--vscode-foreground);
            cursor: pointer;
            font-size: 18px;
            padding: 0 5px;
        }

        .session-list-full-content {
            overflow-y: auto;
            padding: 0;
        }

        .session-item-full {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
            cursor: pointer;
            transition: background 0.2s;
        }

        .session-item-full:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .session-item-full.active {
            background: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }

        .session-info {
            flex: 1;
        }

        .session-name-full {
            font-weight: 500;
            font-size: 13px;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .role-badge-full {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            opacity: 0.8;
        }

        .session-meta-full {
            font-size: 11px;
            opacity: 0.7;
        }

        .session-actions-full {
            display: flex;
            gap: 5px;
            opacity: 0;
            transition: opacity 0.2s;
        }

        .session-item-full:hover .session-actions-full {
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
        }

        .action-btn:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }

        .action-btn.delete-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 6px;
            border: none;
            background: transparent;
            color: var(--vscode-errorForeground);
            opacity: 0.7;
        }

        .action-btn.delete-btn:hover {
            background: var(--vscode-errorBackground);
            opacity: 1;
        }

        .action-btn.delete-btn svg {
            width: 16px;
            height: 16px;
        }

        /* Confirmation Modal */
        .confirm-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 2000;
            display: none;
            justify-content: center;
            align-items: center;
        }

        .confirm-modal-overlay.show {
            display: flex;
        }

        .confirm-modal {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 20px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .confirm-modal-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 10px;
            color: var(--vscode-foreground);
        }

        .confirm-modal-message {
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 20px;
            line-height: 1.5;
        }

        .confirm-modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }

        .confirm-btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            transition: background 0.2s;
        }

        .confirm-btn-cancel {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .confirm-btn-cancel:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .confirm-btn-confirm {
            background: var(--vscode-errorBackground);
            color: var(--vscode-errorForeground);
            border: 1px solid var(--vscode-errorForeground);
        }

        .confirm-btn-confirm:hover {
            background: var(--vscode-errorForeground);
            color: var(--vscode-button-foreground);
        }

        /* Overlay for modal */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 999;
            display: none;
        }

        .modal-overlay.expanded {
            display: block;
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

        .action-btn.copy-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 4px;
            background: transparent;
            border: none;
            cursor: pointer;
            color: var(--vscode-descriptionForeground);
            opacity: 0.7;
            transition: all 0.2s;
        }

        .action-btn.copy-btn:hover {
            opacity: 1;
            color: var(--vscode-foreground);
        }

        .action-btn.copy-btn svg {
            width: 16px;
            height: 16px;
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

        /* Toast Notifications */
        .toast {
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            padding: 10px 20px;
            border-radius: 4px;
            font-size: 13px;
            z-index: 1000;
            animation: slideUp 0.3s ease;
            max-width: 80%;
            text-align: center;
        }

        .toast.error {
            background: var(--vscode-errorBackground);
            color: var(--vscode-errorForeground);
            border: 1px solid var(--vscode-errorForeground);
        }

        .toast.success {
            background: var(--vscode-gitDecoration-addedResourceForeground);
            color: var(--vscode-button-foreground);
        }

        @keyframes slideUp {
            from {
                transform: translateX(-50%) translateY(20px);
                opacity: 0;
            }
            to {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
        }

        /* Welcome State */
        .welcome-state {
            text-align: center;
            padding: 40px 20px;
            color: var(--vscode-descriptionForeground);
        }

        .welcome-state h3 {
            margin-bottom: 15px;
            font-weight: normal;
            font-size: 16px;
        }

        .welcome-state p {
            font-size: 13px;
            margin-bottom: 20px;
            line-height: 1.5;
        }

        .welcome-btn {
            padding: 10px 20px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            transition: background 0.2s;
        }

        .welcome-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <!-- Panel Header -->
    <div class="panel-header">
        <div class="panel-title-wrapper">
            <span class="panel-title">AI PROMPT REFINER</span>
            <span id="template-indicator" class="template-indicator" title="Current refinement mode"></span>
        </div>
        <div class="panel-actions">
            <!-- New Session Button -->
            <button id="new-session-btn" class="action-icon-btn" title="New Session">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
            <!-- Clear All Sessions Button -->
            <button id="clear-all-btn" class="action-icon-btn" title="Clear All Sessions">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
                </svg>
            </button>
        </div>
    </div>

    <!-- Session Selector -->
    <div class="session-selector">
        <div class="session-header">
            <span class="session-title">RECENT SESSIONS</span>
            <button id="view-all-btn" class="view-all-btn">View all</button>
        </div>

        <div class="session-list-container">
            <div class="session-list" id="session-list">
                <!-- Populated dynamically -->
            </div>
            <button class="show-more-btn" id="show-more-btn" style="display: none;">Show More</button>
        </div>
    </div>

    <!-- Confirmation Modal -->
    <div class="confirm-modal-overlay" id="confirm-modal-overlay">
        <div class="confirm-modal">
            <div class="confirm-modal-title" id="confirm-modal-title">Confirm Action</div>
            <div class="confirm-modal-message" id="confirm-modal-message">Are you sure?</div>
            <div class="confirm-modal-actions">
                <button class="confirm-btn confirm-btn-cancel" id="confirm-btn-cancel">Cancel</button>
                <button class="confirm-btn confirm-btn-confirm" id="confirm-btn-confirm">Confirm</button>
            </div>
        </div>
    </div>

    <!-- Modal Overlay -->
    <div class="modal-overlay" id="modal-overlay"></div>

    <!-- Full Session List Modal -->
    <div class="session-list-full" id="session-list-full">
        <div class="session-list-full-header">
            <span class="session-list-full-title">All Sessions</span>
            <button class="session-list-full-close" id="close-full-list">&times;</button>
        </div>
        <div class="session-list-full-content" id="session-list-full-content">
            <!-- Populated dynamically -->
        </div>
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
        const sessionList = document.getElementById('session-list');
        const showMoreBtn = document.getElementById('show-more-btn');
        const viewAllBtn = document.getElementById('view-all-btn');
        const modalOverlay = document.getElementById('modal-overlay');
        const sessionListFull = document.getElementById('session-list-full');
        const sessionListFullContent = document.getElementById('session-list-full-content');
        const closeFullListBtn = document.getElementById('close-full-list');
        const newSessionBtn = document.getElementById('new-session-btn');
        const clearAllBtn = document.getElementById('clear-all-btn');

        // Debug: Check if elements exist
        console.log('[INIT] newSessionBtn exists:', !!newSessionBtn);
        console.log('[INIT] clearAllBtn exists:', !!clearAllBtn);
        console.log('[INIT] viewAllBtn exists:', !!viewAllBtn);
        console.log('[INIT] sessionListFullContent exists:', !!sessionListFullContent);

        let currentSessionId = null;
        let sessions = [];
        let editingId = null;

        // ==================== STATE PERSISTENCE ====================

        const STATE_KEY = 'chatViewState';

        function saveState() {
            const state = {
                sessionId: currentSessionId,
                inputText: promptInput.value,
                scrollPosition: chatContainer.scrollTop,
                timestamp: Date.now()
            };
            vscode.setState(state);
            vscode.postMessage({ type: 'saveInputState', value: promptInput.value });
        }

        function restoreState() {
            const state = vscode.getState();
            if (state) {
                // Restore input text
                if (state.inputText) {
                    promptInput.value = state.inputText;
                    updateCharCount();
                }
                // Restore scroll position after messages load
                if (state.scrollPosition) {
                    setTimeout(() => {
                        chatContainer.scrollTop = state.scrollPosition;
                    }, 100);
                }
            }
        }

        // Update template indicator in header
        function updateTemplateIndicator(templateInfo) {
            const indicator = document.getElementById('template-indicator');
            if (indicator && templateInfo) {
                indicator.textContent = templateInfo.name || 'Normal';
                if (templateInfo.isStrict) {
                    indicator.classList.add('strict');
                } else {
                    indicator.classList.remove('strict');
                }
            }
        }

        // Auto-save state periodically and on events
        setInterval(saveState, 5000);
        window.addEventListener('beforeunload', saveState);
        promptInput.addEventListener('input', () => {
            updateCharCount();
            saveState();
        });

        // ==================== SESSION MANAGEMENT ====================

        const MAX_VISIBLE_SESSIONS = 3;

        function renderSessionSelector() {
            const activeSessions = sessions.filter(s => !s.metadata?.isArchived);
            const hasMoreSessions = activeSessions.length > MAX_VISIBLE_SESSIONS;
            const visibleSessions = activeSessions.slice(0, MAX_VISIBLE_SESSIONS);

            if (visibleSessions.length === 0) {
                // Show new session button as the only item
                sessionList.innerHTML = \`
                    <div class="new-session-item" id="new-session-btn-main">
                        New Session
                    </div>
                \`;
            } else {
                sessionList.innerHTML = visibleSessions.map(session => {
                    const messageCount = session.metadata?.messageCount || 0;
                    const lastUpdate = getTimeAgo(session.updatedAt);
                    const provider = session.metadata?.provider || 'Local';
                    const isCompleted = messageCount > 0 && session.messages[session.messages.length - 1]?.role === 'assistant';
                    const roleIcon = session.roleInfo?.icon || '💻';

                    return \`
                        <div class="session-item \${session.id === currentSessionId ? 'active' : ''}" 
                             data-id="\${session.id}">
                            <div class="session-item-info">
                                <div class="session-name">
                                    <span class="role-badge" title="\${session.roleInfo?.name || 'Programmer'}">\${roleIcon}</span>
                                    \${escapeHtml(session.name)}
                                </div>
                                <div class="session-status">\${isCompleted ? 'Completed' : 'In Progress'}</div>
                            </div>
                            <div class="session-meta">\${provider} • \${lastUpdate}</div>
                        </div>
                    \`;
                }).join('');
            }

            // Show/hide "Show More" button
            showMoreBtn.style.display = hasMoreSessions ? 'block' : 'none';

            // Add click handlers to session items
            sessionList.querySelectorAll('.session-item').forEach(item => {
                item.addEventListener('click', () => {
                    switchSession(item.dataset.id);
                });
            });

            // Add click handler to new session button (if present)
            const newSessionBtn = document.getElementById('new-session-btn-main');
            if (newSessionBtn) {
                newSessionBtn.addEventListener('click', createNewSession);
            }
        }

        function getTimeAgo(timestamp) {
            const now = Date.now();
            const diff = now - timestamp;
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);

            if (minutes < 1) return 'just now';
            if (minutes < 60) return \`\${minutes} min\`;
            if (hours < 24) return \`\${hours} hour\${hours > 1 ? 's' : ''}\`;
            if (days < 30) return \`\${days} day\${days > 1 ? 's' : ''}\`;
            return 'long ago';
        }

        function renderSessionListFull() {
            const activeSessions = sessions.filter(s => !s.metadata?.isArchived);
            const archivedSessions = sessions.filter(s => s.metadata?.isArchived);

            let html = '';

            // Active Sessions
            if (activeSessions.length > 0) {
                html += '<div style="margin-bottom: 15px;"><strong style="font-size: 12px; color: var(--vscode-descriptionForeground);">Active</strong></div>';
                html += activeSessions.map(session => renderFullSessionItem(session)).join('');
            }

            // Archived Sessions
            if (archivedSessions.length > 0) {
                html += '<div style="margin: 15px 0 10px 0;"><strong style="font-size: 12px; color: var(--vscode-descriptionForeground);">Archived</strong></div>';
                html += archivedSessions.map(session => renderFullSessionItem(session)).join('');
            }

            sessionListFullContent.innerHTML = html || '<div style="padding: 20px; text-align: center; color: var(--vscode-descriptionForeground);">No sessions found</div>';

            // Add click handlers for session items (switch session)
            sessionListFullContent.querySelectorAll('.session-item-full').forEach(item => {
                item.addEventListener('click', (e) => {
                    const sessionId = item.dataset.id;
                    console.log('Session item clicked, sessionId:', sessionId);
                    
                    // Check if click was on delete button or its children
                    if (e.target.closest('.delete-btn')) {
                        e.stopPropagation();
                        e.preventDefault();
                        console.log('Delete button clicked for session:', sessionId);
                        if (sessionId) {
                            showConfirmModal(
                                'Delete Session',
                                'Are you sure? This will permanently delete the session and all its messages.',
                                () => {
                                    console.log('Sending deleteSession message for:', sessionId);
                                    vscode.postMessage({ type: 'deleteSession', sessionId });
                                }
                            );
                        }
                        return;
                    }
                    
                    // Otherwise, switch to the session
                    if (sessionId) {
                        switchSession(sessionId);
                        closeFullSessionList();
                    }
                });
            });
        }

        function renderFullSessionItem(session) {
            const isArchived = session.metadata?.isArchived;
            const messageCount = session.metadata?.messageCount || 0;
            const lastUpdate = new Date(session.updatedAt).toLocaleDateString();
            const roleIcon = session.roleInfo?.icon || '💻';

            return \`
                <div class="session-item-full \${session.id === currentSessionId ? 'active' : ''}" 
                     data-id="\${session.id}">
                    <div class="session-info">
                        <div class="session-name-full">
                            <span class="role-badge-full" title="\${session.roleInfo?.name || 'Programmer'}">\${roleIcon}</span>
                            \${escapeHtml(session.name)}
                            \${isArchived ? '<span style="font-size: 10px; opacity: 0.6; margin-left: 8px;">(Archived)</span>' : ''}
                        </div>
                        <div class="session-meta-full">\${messageCount} messages • Last updated: \${lastUpdate}</div>
                    </div>
                    <div class="session-actions-full">
                        <button class="action-btn delete-btn" data-action="delete" title="Delete">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
                                <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
                            </svg>
                        </button>
                    </div>
                </div>
            \`;
        }

        function openFullSessionList() {
            renderSessionListFull();
            modalOverlay.classList.add('expanded');
            sessionListFull.classList.add('expanded');
        }

        function closeFullSessionList() {
            modalOverlay.classList.remove('expanded');
            sessionListFull.classList.remove('expanded');
        }

        function createNewSession() {
            // Request session name from extension host (prompt doesn't work in sandboxed webview)
            vscode.postMessage({ type: 'requestSessionName' });
        }

        function switchSession(sessionId) {
            vscode.postMessage({ type: 'switchSession', sessionId });
        }

        // ==================== MESSAGE MANAGEMENT ====================

        function sendMessage() {
            const text = promptInput.value.trim();
            if (!text || inputWrapper.classList.contains('loading')) return;

            vscode.postMessage({ type: 'refinePrompt', value: text });
            promptInput.value = '';
            updateCharCount();
            saveState();
        }

        function updateCharCount() {
            const count = promptInput.value.length;
            charCount.textContent = \`\${count}/4000\`;
            charCount.style.color = count > 4000 ? 'var(--vscode-errorForeground)' : 'var(--vscode-descriptionForeground)';
        }

        function createMessageElement(message) {
            const div = document.createElement('div');
            div.className = \`message \${message.role}\`;
            div.dataset.id = message.id;

            const date = new Date(message.timestamp);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            if (editingId === message.id) {
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
                div.innerHTML = \`
                    <div class="message-header">
                        <span class="message-role">\${message.role}</span>
                        <span class="message-time">\${timeStr}</span>
                    </div>
                    <div class="message-content">\${escapeHtml(message.content)}</div>
                    <div class="message-actions">
                        <button class="action-btn copy-btn" onclick="copyMessage('\${message.id}')" title="Copy">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
                                <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
                                <rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" stroke-width="2" fill="none"/>
                            </svg>
                        </button>
                    </div>
                \`;
            }

            return div;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function copyMessage(id) {
            const messageElements = document.querySelectorAll('.message');
            let messageContent = '';
            messageElements.forEach(el => {
                if (el.dataset.id === id) {
                    messageContent = el.querySelector('.message-content')?.textContent || '';
                }
            });
            if (messageContent) {
                navigator.clipboard.writeText(messageContent);
                showToast('Copied to clipboard', 'success');
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
            const messageElements = document.querySelectorAll('.message');
            messageElements.forEach(el => {
                if (el.dataset.id === id) {
                    const content = el.querySelector('.message-content')?.textContent || '';
                    if (content) {
                        promptInput.value = content;
                        updateCharCount();
                        promptInput.focus();
                    }
                }
            });
        }

        function renderMessages(messagesToRender) {
            chatContainer.innerHTML = '';
            
            const messages = messagesToRender || [];
            
            if (messages.length === 0) {
                chatContainer.appendChild(emptyState);
                return;
            }

            messages.forEach(message => {
                chatContainer.appendChild(createMessageElement(message));
            });

            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function showToast(message, type = 'info') {
            const existing = document.querySelector('.toast');
            if (existing) existing.remove();

            const toast = document.createElement('div');
            toast.className = \`toast \${type}\`;
            toast.textContent = message;
            document.body.appendChild(toast);
            
            setTimeout(() => toast.remove(), 3000);
        }

        // ==================== EVENT LISTENERS ====================

        sendBtn.addEventListener('click', sendMessage);
        
        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        viewAllBtn.addEventListener('click', openFullSessionList);
        showMoreBtn.addEventListener('click', openFullSessionList);
        closeFullListBtn.addEventListener('click', closeFullSessionList);
        modalOverlay.addEventListener('click', closeFullSessionList);

        // Confirmation Modal Functionality
        const confirmModalOverlay = document.getElementById('confirm-modal-overlay');
        const confirmModalTitle = document.getElementById('confirm-modal-title');
        const confirmModalMessage = document.getElementById('confirm-modal-message');
        const confirmBtnConfirm = document.getElementById('confirm-btn-confirm');
        const confirmBtnCancel = document.getElementById('confirm-btn-cancel');
        
        let confirmCallback = null;
        
        function showConfirmModal(title, message, onConfirm) {
            confirmModalTitle.textContent = title;
            confirmModalMessage.textContent = message;
            confirmCallback = onConfirm;
            confirmModalOverlay.classList.add('show');
        }
        
        function hideConfirmModal() {
            confirmModalOverlay.classList.remove('show');
            confirmCallback = null;
        }
        
        confirmBtnCancel.addEventListener('click', hideConfirmModal);
        confirmBtnConfirm.addEventListener('click', () => {
            if (confirmCallback) {
                confirmCallback();
            }
            hideConfirmModal();
        });
        confirmModalOverlay.addEventListener('click', (e) => {
            if (e.target === confirmModalOverlay) {
                hideConfirmModal();
            }
        });

        // ==================== MESSAGE HANDLING ====================

        window.addEventListener('message', event => {
            const data = event.data;
            
            switch (data.type) {
                // Initial load
                case 'initialState':
                    if (data.session) {
                        currentSessionId = data.session.id;
                        renderMessages(data.session.messages || []);
                    }
                    restoreState();
                    
                    // Update template indicator
                    if (data.templateInfo) {
                        updateTemplateIndicator(data.templateInfo);
                    }
                    break;

                // Session list updates
                case 'sessionListChanged':
                    sessions = data.sessions || [];
                    currentSessionId = data.activeSessionId;
                    renderSessionSelector();
                    // If modal is open, refresh it
                    if (sessionListFull.classList.contains('expanded')) {
                        renderSessionListFull();
                    }
                    break;

                case 'allSessions':
                    sessions = data.sessions || [];
                    renderSessionSelector();
                    break;

                // Session operations
                case 'sessionCreated':
                    currentSessionId = data.session?.id;
                    showToast('New session created', 'success');
                    renderMessages([]);
                    break;

                case 'sessionRenamed':
                    showToast('Session renamed', 'success');
                    break;

                case 'sessionImported':
                    showToast('Session imported', 'success');
                    break;

                // Session loading
                case 'loadSession':
                    currentSessionId = data.session?.id;
                    renderMessages(data.session?.messages || []);
                    break;

                case 'loadMessages':
                    renderMessages(data.messages || []);
                    break;

                // Message operations
                case 'addMessage':
                    if (emptyState.parentNode) {
                        emptyState.remove();
                    }
                    chatContainer.appendChild(createMessageElement(data.message));
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                    break;

                case 'updateMessage':
                    editingId = null;
                    const msgElements = document.querySelectorAll('.message');
                    msgElements.forEach(el => {
                        if (el.dataset.id === data.message?.id) {
                            const newEl = createMessageElement(data.message);
                            el.replaceWith(newEl);
                        }
                    });
                    break;

                case 'removeMessage':
                    const elements = document.querySelectorAll('.message');
                    elements.forEach(el => {
                        if (el.dataset.id === data.messageId) {
                            el.remove();
                        }
                    });
                    if (chatContainer.children.length === 0) {
                        chatContainer.appendChild(emptyState);
                    }
                    break;

                case 'clearAll':
                    chatContainer.innerHTML = '';
                    chatContainer.appendChild(emptyState);
                    // Refresh session list after clearing all
                    renderSessionSelector();
                    if (sessionListFull.classList.contains('expanded')) {
                        renderSessionListFull();
                    }
                    break;

                case 'setInput':
                    promptInput.value = data.content || '';
                    updateCharCount();
                    promptInput.focus();
                    break;

                // UI states
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

                // Notifications
                case 'showError':
                    showToast(data.content, 'error');
                    break;

                case 'showSuccess':
                    showToast(data.content, 'success');
                    break;

                // Stats
                case 'sessionStats':
                    console.log('Session stats:', data.stats);
                    break;
            }
        });

        // Initial load
        restoreState();
        vscode.postMessage({ type: 'loadInitialState' });
        vscode.postMessage({ type: 'getAllSessions' });
        
        // Panel header buttons - initialize after everything is loaded
        setTimeout(() => {
            console.log('[INIT-DELAYED] Setting up panel header buttons...');
            
            // New Session Button
            const newSessionBtnHeader = document.getElementById('new-session-btn');
            if (newSessionBtnHeader) {
                console.log('[INIT-DELAYED] Attaching listener to new-session-btn');
                newSessionBtnHeader.addEventListener('click', (e) => {
                    console.log('[CLICK] new-session-btn clicked');
                    e.preventDefault();
                    e.stopPropagation();
                    createNewSession();
                });
            } else {
                console.error('[INIT-DELAYED] ERROR: new-session-btn not found!');
            }
            
            // Clear All Button
            const clearAllBtnHeader = document.getElementById('clear-all-btn');
            if (clearAllBtnHeader) {
                console.log('[INIT-DELAYED] Attaching listener to clear-all-btn');
                clearAllBtnHeader.addEventListener('click', (e) => {
                    console.log('[CLICK] clear-all-btn clicked');
                    e.preventDefault();
                    e.stopPropagation();
                    showConfirmModal(
                        'Clear All Sessions',
                        'Are you sure you want to clear all sessions? This action cannot be undone.',
                        () => {
                            console.log('[CLICK] Sending clearAllSessions message');
                            vscode.postMessage({ type: 'clearAllSessions' });
                        }
                    );
                });
            } else {
                console.error('[INIT-DELAYED] ERROR: clear-all-btn not found!');
            }
        }, 100);
    </script>
</body>
</html>`;
    }
}
