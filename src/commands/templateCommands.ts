import * as vscode from 'vscode';
import { TemplateManager } from '../services/TemplateManager';
import { logger } from '../services/Logger';
import { t } from '../i18n';

/**
 * Commands for managing custom templates
 */
export function registerTemplateCommands(context: vscode.ExtensionContext): void {
    const templateManager = TemplateManager.getInstance();
    templateManager.initialize(context);

    // Command: Select Template
    context.subscriptions.push(
        vscode.commands.registerCommand('promptRefiner.selectTemplate', async () => {
            const templates = await templateManager.getAllTemplates();
            
            const items = templates.map(t => ({
                label: `$(file-text) ${t.name}`,
                description: t.description,
                detail: `${t.isBuiltIn ? 'Built-in' : 'Custom'} • ${t.category}`,
                template: t,
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Choose a refinement template',
                title: 'Select Template',
            });

            if (selected) {
                // Store selected template in configuration
                await vscode.workspace.getConfiguration('promptRefiner').update(
                    'selectedTemplate',
                    selected.template.id,
                    vscode.ConfigurationTarget.Global
                );
                
                vscode.window.showInformationMessage(
                    `Template "${selected.template.name}" selected!`
                );
                logger.info('Template selected', { templateId: selected.template.id });
            }
        })
    );

    // Command: Create Custom Template
    context.subscriptions.push(
        vscode.commands.registerCommand('promptRefiner.createTemplate', async () => {
            // Get template name
            const name = await vscode.window.showInputBox({
                prompt: 'Template name',
                placeHolder: 'e.g., Code Review Helper',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Name is required';
                    }
                    if (value.length > 50) {
                        return 'Name too long (max 50 characters)';
                    }
                    return null;
                },
            });

            if (!name) return;

            // Get description
            const description = await vscode.window.showInputBox({
                prompt: 'Template description',
                placeHolder: 'Brief description of what this template does...',
            });

            if (description === undefined) return;

            // Get category
            const categories = ['coding', 'writing', 'analysis', 'general', 'custom'];
            const category = await vscode.window.showQuickPick(categories, {
                placeHolder: 'Select template category',
            });

            if (!category) return;

            // Get template content
            const content = await vscode.window.showInputBox({
                prompt: 'Template content (system instructions)',
                placeHolder: 'Enter the system prompt template...',
                value: `## PROMPT TEMPLATE - ${name}

Act as an expert in [your domain].

Refine the user's prompt to be:
- Clear and specific
- Include relevant context
- Define expected output

### Output Format:
[Context]
[Objective]
[Constraints]
[Expected Output]

Maintain the original language of the user's prompt.`,
                ignoreFocusOut: true,
            });

            if (!content) return;

            try {
                const template = await templateManager.createTemplate({
                    name: name.trim(),
                    description: description.trim(),
                    content: content.trim(),
                    category: category as any,
                });

                vscode.window.showInformationMessage(
                    `Template "${template.name}" created successfully!`
                );
                logger.info('Custom template created', { templateId: template.id });
            } catch (error) {
                logger.error('Failed to create template', error as Error);
                vscode.window.showErrorMessage('Failed to create template');
            }
        })
    );

    // Command: Manage Templates (Export/Import)
    context.subscriptions.push(
        vscode.commands.registerCommand('promptRefiner.manageTemplates', async () => {
            const action = await vscode.window.showQuickPick([
                { label: '$(cloud-download) Export Templates', description: 'Save custom templates to file', action: 'export' },
                { label: '$(cloud-upload) Import Templates', description: 'Load templates from file', action: 'import' },
                { label: '$(trash) Delete Custom Template', description: 'Remove a custom template', action: 'delete' },
            ], {
                placeHolder: 'What would you like to do?',
                title: 'Manage Custom Templates',
            });

            if (!action) return;

            switch (action.action) {
            case 'export': {
                await templateManager.exportTemplates();
                break;
            }
            case 'import': {
                await templateManager.importTemplates();
                break;
            }
            case 'delete': {
                const customTemplates = await templateManager.getCustomTemplates();
                if (customTemplates.length === 0) {
                    vscode.window.showWarningMessage('No custom templates to delete');
                    return;
                }
                    
                const toDelete = await vscode.window.showQuickPick(
                    customTemplates.map(t => ({
                        label: t.name,
                        description: t.description,
                        id: t.id,
                    })),
                    { placeHolder: 'Select template to delete' }
                );
                    
                if (toDelete) {
                    const confirmed = await vscode.window.showWarningMessage(
                        `Are you sure you want to delete "${toDelete.label}"?`,
                        { modal: true },
                        'Delete'
                    );
                        
                    if (confirmed === 'Delete') {
                        await templateManager.deleteTemplate(toDelete.id);
                        vscode.window.showInformationMessage('Template deleted');
                    }
                }
                break;
            }
            }
        })
    );

    // Command: Re-refine with Feedback
    context.subscriptions.push(
        vscode.commands.registerCommand('promptRefiner.reRefine', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor');
                return;
            }

            const selection = editor.selection;
            const text = editor.document.getText(selection);

            if (!text) {
                vscode.window.showWarningMessage('Please select text to re-refine');
                return;
            }

            // Ask for feedback/improvements
            const feedback = await vscode.window.showInputBox({
                prompt: 'What improvements would you like?',
                placeHolder: 'e.g., Make it more specific about error handling',
                ignoreFocusOut: true,
            });

            if (!feedback) return;

            // This would need access to the previous result
            // For now, we'll use the selected text as both original and previous
            vscode.window.showInformationMessage('Re-refinement feature - to be implemented with history');
        })
    );

    // Command: Validate Output
    context.subscriptions.push(
        vscode.commands.registerCommand('promptRefiner.validateOutput', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor');
                return;
            }

            const text = editor.document.getText(editor.selection);
            if (!text) {
                vscode.window.showWarningMessage('Please select a refined prompt to validate');
                return;
            }

            const { OutputValidator } = await import('../utils/OutputValidator');
            const result = OutputValidator.validate(text, true);

            const panel = vscode.window.createWebviewPanel(
                'validationResult',
                'Prompt Validation',
                vscode.ViewColumn.Beside,
                {}
            );

            panel.webview.html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: var(--vscode-font-family); padding: 20px; }
                        .score { font-size: 24px; font-weight: bold; margin-bottom: 20px; }
                        .score.good { color: var(--vscode-gitDecoration-addedResourceForeground); }
                        .score.warning { color: var(--vscode-editorWarning-foreground); }
                        .score.bad { color: var(--vscode-editorError-foreground); }
                        .section { margin-bottom: 20px; }
                        .issue { margin: 10px 0; padding: 10px; border-radius: 4px; }
                        .issue.error { background: var(--vscode-inputValidation-errorBackground); }
                        .issue.warning { background: var(--vscode-inputValidation-warningBackground); }
                        .issue.info { background: var(--vscode-inputValidation-infoBackground); }
                    </style>
                </head>
                <body>
                    <div class="score ${result.score >= 80 ? 'good' : result.score >= 60 ? 'warning' : 'bad'}">
                        Score: ${result.score}/100
                    </div>
                    
                    ${result.issues.length > 0 ? `
                    <div class="section">
                        <h3>Issues (${result.issues.length})</h3>
                        ${result.issues.map(i => `
                            <div class="issue ${i.type}">
                                <strong>${i.type.toUpperCase()}:</strong> ${i.message}
                                ${i.section ? `<br><em>Section: ${i.section}</em>` : ''}
                            </div>
                        `).join('')}
                    </div>
                    ` : '<div class="section"><h3>No issues found!</h3></div>'}
                    
                    ${result.suggestions.length > 0 ? `
                    <div class="section">
                        <h3>Suggestions</h3>
                        <ul>
                            ${result.suggestions.map(s => `<li>${s}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}
                </body>
                </html>
            `;
        })
    );
}
