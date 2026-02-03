import * as vscode from 'vscode';
import * as path from 'path';
import { PromptRefinerService } from './services/PromptRefinerService';
import { selectModel, setApiKeyCommand, showProvidersStatus, clearApiKeyCommand, switchProviderCommand } from './commands/settingsCommands';
import { registerTemplateCommands } from './commands/templateCommands';
import { ConfigurationManager } from './services/ConfigurationManager';
import { ChatViewProvider } from './views/ChatViewProvider';
import { SettingsViewProvider } from './views/SettingsViewProvider';
import { logger, LogLevel } from './services/Logger';
import { ErrorHandler, ErrorType } from './utils/ErrorHandler';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    // Initialize logger
    logger.initialize(context);
    logger.info('AI Prompt Refiner extension activating...');

    // Initialize Service
    const service = PromptRefinerService.getInstance();
    service.initialize(context);
    
    // Get configuration reference for logging
    const config = ConfigurationManager.getInstance();

    // Register Chat View Provider
    const chatProvider = new ChatViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatProvider)
    );

    // Register Settings View Provider
    const settingsProvider = new SettingsViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SettingsViewProvider.viewType, settingsProvider)
    );

    // Create Status Bar Item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'promptRefiner.selectModel';
    context.subscriptions.push(statusBarItem);
    updateStatusBarItem();
    statusBarItem.show();

    // Register Command
    const disposable = vscode.commands.registerCommand('promptRefiner.refineSelection', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor found.');
            return;
        }

        const selection = editor.selection;
        const text = editor.document.getText(selection);

        if (!text) {
            vscode.window.showWarningMessage('Please select the prompt text you want to refine.');
            return;
        }

        // UX: Show progress with cancellation support
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Refining prompt...',
            cancellable: true
        }, async (progress, token) => {
            logger.info('Starting prompt refinement', { 
                provider: config.getProviderId(), 
                model: config.getModelId(),
                textLength: text.length 
            });

            try {
                const result = await service.refine(text, token);

                if (token.isCancellationRequested) {
                    logger.info('Prompt refinement cancelled by user');
                    return;
                }

                const refinedText = result.refined;

                // Diff View Implementation
                // 1. Create a URI for the original content (Left Side)
                const originalUri = vscode.Uri.parse(`prompt-refiner:original?${encodeURIComponent(JSON.stringify({ content: text }))}`);

                // 2. Create a URI for the refined content (Right Side)
                const refinedDocument = await vscode.workspace.openTextDocument({
                    content: refinedText,
                    language: 'markdown'
                });

                // 3. Open the Diff View
                await vscode.commands.executeCommand('vscode.diff',
                    originalUri,
                    refinedDocument.uri,
                    'Original vs Refined Prompt'
                );

                // 4. Show action buttons after diff view opens
                const action = await vscode.window.showInformationMessage(
                    'Prompt refined successfully! What would you like to do?',
                    { modal: false },
                    'Copy to Clipboard',
                    'Apply to Editor',
                    'Dismiss'
                );

                if (action === 'Copy to Clipboard') {
                    await vscode.env.clipboard.writeText(refinedText);
                    vscode.window.showInformationMessage('Refined prompt copied to clipboard!');
                    logger.info('User copied refined prompt to clipboard');
                } else if (action === 'Apply to Editor') {
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        await editor.edit(editBuilder => {
                            editBuilder.replace(editor.selection, refinedText);
                        });
                        vscode.window.showInformationMessage('Refined prompt applied to editor!');
                        logger.info('User applied refined prompt to editor');
                    }
                } else {
                    logger.info('User dismissed refined prompt');
                }

                // Show validation warning if score is low
                if (result.validation && result.validation.score < 70) {
                    const { OutputValidator } = await import('./utils/OutputValidator');
                    const validationMessage = OutputValidator.formatResult(result.validation);
                    
                    const showDetails = await vscode.window.showWarningMessage(
                        `Refined prompt quality score: ${result.validation.score}/100`,
                        'View Details',
                        'Dismiss'
                    );
                    
                    if (showDetails === 'View Details') {
                        const doc = await vscode.workspace.openTextDocument({
                            content: validationMessage,
                            language: 'plaintext'
                        });
                        await vscode.window.showTextDocument(doc);
                    }
                }

                logger.info('Prompt refinement completed successfully', {
                    score: result.validation?.score,
                    valid: result.validation?.valid
                });

            } catch (error: any) {
                const errorInfo = ErrorHandler.classifyError(error);
                logger.error('Prompt refinement failed', error, errorInfo);
                
                const action = await vscode.window.showErrorMessage(
                    errorInfo.userMessage,
                    errorInfo.action || 'Dismiss'
                );

                if (action === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'promptRefiner');
                } else if (action === 'Set API Key') {
                    vscode.commands.executeCommand('promptRefiner.setApiKey');
                } else if (action === 'View Logs') {
                    logger.show();
                }
            }
        });
    });

    // Register Text Document Content Provider for 'prompt-refiner' scheme
    const myProvider = new class implements vscode.TextDocumentContentProvider {
        provideTextDocumentContent(uri: vscode.Uri): string {
            try {
                const params = JSON.parse(decodeURIComponent(uri.query));
                return params.content || '';
            } catch {
                return '';
            }
        }
    };
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('prompt-refiner', myProvider));

    context.subscriptions.push(disposable);

    // Register Select Model Command
    context.subscriptions.push(vscode.commands.registerCommand('promptRefiner.selectModel', async () => {
        await selectModel();
    }));

    // Register Set API Key Command
    context.subscriptions.push(vscode.commands.registerCommand('promptRefiner.setApiKey', async () => {
        await setApiKeyCommand();
    }));

    // Register Show Providers Status Command
    context.subscriptions.push(vscode.commands.registerCommand('promptRefiner.showProvidersStatus', async () => {
        await showProvidersStatus();
    }));

    // Register Clear API Key Command
    context.subscriptions.push(vscode.commands.registerCommand('promptRefiner.clearApiKey', async () => {
        await clearApiKeyCommand();
    }));

    // Register Switch Provider Command
    context.subscriptions.push(vscode.commands.registerCommand('promptRefiner.switchProvider', async () => {
        await switchProviderCommand();
        updateStatusBarItem(); // Update status bar to show new provider
    }));

    // Register Refresh Models Command
    context.subscriptions.push(vscode.commands.registerCommand('promptRefiner.refreshModels', async () => {
        const { ModelRegistry } = await import('./services/ModelRegistry');
        const registry = ModelRegistry.getInstance();
        await registry.initialize();
        await registry.forceRefresh();
        vscode.window.showInformationMessage('✅ Supported models refreshed successfully!');
    }));

    // Register Template Commands
    registerTemplateCommands(context);

    // Register Save as Snippet Command
    context.subscriptions.push(vscode.commands.registerCommand('promptRefiner.saveAsSnippet', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }

        const selection = editor.selection;
        const text = editor.document.getText(selection);

        if (!text) {
            vscode.window.showWarningMessage('Please select text to save as snippet');
            return;
        }

        // Ask for snippet name
        const name = await vscode.window.showInputBox({
            prompt: 'Snippet name',
            placeHolder: 'e.g., refined-auth-prompt',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Name is required';
                }
                if (!/^[a-z0-9-]+$/.test(value)) {
                    return 'Use only lowercase letters, numbers, and hyphens';
                }
                return null;
            },
        });

        if (!name) return;

        // Ask for prefix (trigger text)
        const prefix = await vscode.window.showInputBox({
            prompt: 'Snippet prefix (trigger text)',
            placeHolder: 'e.g., auth-prompt',
            value: name.replace(/-/g, ''),
        });

        if (!prefix) return;

        // Create snippet configuration
        const snippet = {
            [name]: {
                prefix: prefix,
                body: text.split('\n'),
                description: `Refined prompt: ${name}`,
            }
        };

        // Open user snippets file
        const snippetsFile = vscode.Uri.file(
            path.join(context.globalStorageUri.fsPath, '..', '..', 'snippets', 'prompt-refiner.json')
        );

        try {
            // Try to read existing snippets
            let existingSnippets = {};
            try {
                const content = await vscode.workspace.fs.readFile(snippetsFile);
                existingSnippets = JSON.parse(content.toString());
            } catch {
                // File doesn't exist yet
            }

            // Merge with new snippet
            const updatedSnippets = { ...existingSnippets, ...snippet };
            
            // Ensure directory exists
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(snippetsFile.fsPath)));
            
            // Write snippets file
            await vscode.workspace.fs.writeFile(
                snippetsFile,
                Buffer.from(JSON.stringify(updatedSnippets, null, 2), 'utf8')
            );

            vscode.window.showInformationMessage(
                `Snippet "${name}" saved! Use prefix "${prefix}" to insert it.`
            );
            logger.info('Snippet saved', { name, prefix });
        } catch (error) {
            logger.error('Failed to save snippet', error as Error);
            vscode.window.showErrorMessage('Failed to save snippet');
        }
    }));

    // Register Export History Command
    context.subscriptions.push(vscode.commands.registerCommand('promptRefiner.exportHistory', async () => {
        const { ChatHistoryManager } = await import('./services/ChatHistoryManager');
        const historyManager = ChatHistoryManager.getInstance();
        historyManager.initialize(context);
        
        const history = await historyManager.getHistory();
        
        if (history.length === 0) {
            vscode.window.showWarningMessage('No chat history to export');
            return;
        }

        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            messages: history,
        };

        const jsonContent = JSON.stringify(exportData, null, 2);
        
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('prompt-refiner-history.json'),
            filters: { 'JSON': ['json'] },
        });

        if (uri) {
            try {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(jsonContent, 'utf8'));
                vscode.window.showInformationMessage(`Exported ${history.length} messages!`);
                logger.info('History exported', { count: history.length });
            } catch (error) {
                logger.error('Failed to export history', error as Error);
                vscode.window.showErrorMessage('Failed to export history');
            }
        }
    }));

    // Update Status Bar on Config Change
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('promptRefiner.model') || e.affectsConfiguration('promptRefiner.provider')) {
            updateStatusBarItem();
        }
    }));
}

function updateStatusBarItem(): void {
    const config = ConfigurationManager.getInstance();
    const model = config.getModelId();
    const provider = config.getProviderId();
    
    // Show different icon based on provider type
    const icon = provider === 'ollama' ? '$(zap)' : '$(sparkle)';
    
    statusBarItem.text = `${icon} ${model}`;
    statusBarItem.tooltip = new vscode.MarkdownString(
        '**Prompt Refiner**\n\n' +
        `**Model:** ${model}\n` +
        `**Provider:** ${provider}\n\n` +
        '$(sync) Click to change model\n' +
        '$(gear) Configure in settings'
    );
    statusBarItem.tooltip.isTrusted = true;
}

export function deactivate() {
    logger.info('AI Prompt Refiner extension deactivating...');
    logger.dispose();
}
