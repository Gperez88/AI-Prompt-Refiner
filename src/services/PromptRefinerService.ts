import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IAIProvider } from '../providers/IAIProvider';
import { ProviderManager } from './ProviderManager';
import { ConfigurationManager } from './ConfigurationManager';

export class PromptRefinerService {
    private static instance: PromptRefinerService;
    private providerManager: ProviderManager;
    private context: vscode.ExtensionContext | undefined;

    private constructor() {
        this.providerManager = new ProviderManager();
    }

    public static getInstance(): PromptRefinerService {
        if (!PromptRefinerService.instance) {
            PromptRefinerService.instance = new PromptRefinerService();
        }
        return PromptRefinerService.instance;
    }

    public initialize(context: vscode.ExtensionContext) {
        this.context = context;
        ConfigurationManager.getInstance().initialize(context);
    }

    public async refine(userPrompt: string): Promise<string> {
        if (!this.context) {
            throw new Error('Service not initialized. Call initialize() first.');
        }

        // Determine template based on strict mode
        const isStrict = ConfigurationManager.getInstance().isStrictMode();
        const templateName = isStrict ? 'prompt_template_strict.md' : 'prompt_template.md';
        const templatePath = this.context.asAbsolutePath(path.join('dist', 'templates', templateName));

        // Fallback checks for dev environment
        let systemTemplate = '';
        try {
            systemTemplate = fs.readFileSync(templatePath, 'utf-8');
        } catch (error) {
            // Try src path if dist fails (debug mode)
            const srcPath = this.context.asAbsolutePath(path.join('src', 'templates', templateName));
            try {
                systemTemplate = fs.readFileSync(srcPath, 'utf-8');
            } catch (err) {
                console.error('Could not load template', error, err);
                return "Error: Could not load prompt template.";
            }
        }

        const activeProvider = this.providerManager.getActiveProvider();
        return activeProvider.refine(userPrompt, systemTemplate, { strict: isStrict });
    }
}
