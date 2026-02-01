import * as vscode from 'vscode';
import { PromptRefinerService } from './services/PromptRefinerService';
import { selectModel, setApiKeyCommand } from './commands/settingsCommands';
import { ConfigurationManager } from './services/ConfigurationManager';
import { ChatViewProvider } from './views/ChatViewProvider';
import { SettingsViewProvider } from './views/SettingsViewProvider';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "prompt-refiner" is now active!');

    // Initialize Service
    const service = PromptRefinerService.getInstance();
    service.initialize(context);

    // Register Chat View Provider
    const chatProvider = new ChatViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatProvider)
    );

    // Register Settings View Provider
    const settingsProvider = new SettingsViewProvider(context.extensionUri);
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
    let disposable = vscode.commands.registerCommand('promptRefiner.refineSelection', async () => {
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

        // UX: Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Refining prompt...",
            cancellable: false
        }, async (progress) => {
            try {
                const refined = await service.refine(text);

                // Diff View Implementation
                // 1. Create a URI for the original content (Left Side)
                // We use a custom scheme to serve the content without saving a file
                const originalUri = vscode.Uri.parse(`prompt-refiner:original?${encodeURIComponent(JSON.stringify({ content: text }))}`);

                // 2. Create a URI for the refined content (Right Side)
                // We use an 'untitled' URI so it's editable and not saved yet
                const refinedDocument = await vscode.workspace.openTextDocument({
                    content: refined,
                    language: 'markdown'
                });

                // 3. Open the Diff View
                await vscode.commands.executeCommand('vscode.diff',
                    originalUri,
                    refinedDocument.uri,
                    'Original vs Refined Prompt'
                );

            } catch (error: any) {
                vscode.window.showErrorMessage(`Error refining prompt: ${error.message}`);
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
    statusBarItem.text = `$(sparkle) PR: ${model} (${provider})`;
    statusBarItem.tooltip = `Prompt Refiner: Current Model ${model} (${provider}). Click to change.`;
}

export function deactivate() { }
