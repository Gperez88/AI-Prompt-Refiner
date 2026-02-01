import * as vscode from 'vscode';

export class ConfigurationManager {
    private static instance: ConfigurationManager;
    private context: vscode.ExtensionContext | undefined;
    private secrets: vscode.SecretStorage | undefined;

    private constructor() {
        // Private constructor to prevent direct instantiation - use getInstance()
    }

    public static getInstance(): ConfigurationManager {
        if (!ConfigurationManager.instance) {
            ConfigurationManager.instance = new ConfigurationManager();
        }
        return ConfigurationManager.instance;
    }

    public initialize(context: vscode.ExtensionContext) {
        this.context = context;
        this.secrets = context.secrets;
    }

    public getProviderId(): string {
        return vscode.workspace.getConfiguration('promptRefiner').get<string>('provider', 'public');
    }

    public getModelId(): string {
        return vscode.workspace.getConfiguration('promptRefiner').get<string>('model', 'gpt-4o-mini');
    }

    public async setProviderId(providerId: string): Promise<void> {
        await vscode.workspace.getConfiguration('promptRefiner').update('provider', providerId, vscode.ConfigurationTarget.Global);
    }

    public async setModelId(modelId: string): Promise<void> {
        await vscode.workspace.getConfiguration('promptRefiner').update('model', modelId, vscode.ConfigurationTarget.Global);
    }

    public isStrictMode(): boolean {
        return vscode.workspace.getConfiguration('promptRefiner').get<boolean>('strictMode', true);
    }

    public async getApiKey(providerId: string): Promise<string | undefined> {
        if (!this.secrets) {
            return undefined;
        }
        return this.secrets.get(`promptRefiner.${providerId}.apiKey`);
    }

    public async setApiKey(providerId: string, key: string): Promise<void> {
        if (!this.secrets) {
            throw new Error('Secrets not initialized');
        }
        await this.secrets.store(`promptRefiner.${providerId}.apiKey`, key);
    }

    public getOllamaEndpoint(): string {
        return vscode.workspace.getConfiguration('promptRefiner').get<string>('ollamaEndpoint', 'http://localhost:11434');
    }
}
