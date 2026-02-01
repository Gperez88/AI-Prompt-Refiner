import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IAIProvider } from '../providers/IAIProvider';
import { IProviderManager } from './IProviderManager';
import { ProviderManager } from './ProviderManager';
import { ConfigurationManager } from './ConfigurationManager';
import { logger } from './Logger';
import { InputValidator } from '../utils/ErrorHandler';
import { TemplateManager, CustomTemplate } from './TemplateManager';
import { OutputValidator, ValidationResult } from '../utils/OutputValidator';
import { LRUCache, refinementCache } from '../utils/Cache';
import { getCircuitBreaker, CircuitBreakerError } from '../utils/CircuitBreaker';
import { withRetry } from '../utils/Retry';

export interface RefinementOptions {
    templateId?: string;
    validateOutput?: boolean;
    iteration?: number;
}

export interface RefinementResult {
    refined: string;
    validation?: ValidationResult;
    templateUsed: string;
    iteration: number;
}

export interface IPromptRefinerService {
    refine(userPrompt: string, token?: vscode.CancellationToken, options?: RefinementOptions): Promise<RefinementResult>;
    initialize(context: vscode.ExtensionContext): void;
}

export class PromptRefinerService implements IPromptRefinerService {
    private static instance: PromptRefinerService;
    private providerManager: IProviderManager;
    private templateManager: TemplateManager;
    private context: vscode.ExtensionContext | undefined;

    /**
     * Private constructor - use getInstance() or createWithDependencies() for instantiation
     */
    private constructor(providerManager?: IProviderManager, templateManager?: TemplateManager) {
        this.providerManager = providerManager ?? new ProviderManager();
        this.templateManager = templateManager ?? TemplateManager.getInstance();
    }

    /**
     * Get the singleton instance (uses default dependencies)
     */
    public static getInstance(): PromptRefinerService {
        if (!PromptRefinerService.instance) {
            PromptRefinerService.instance = new PromptRefinerService();
        }
        return PromptRefinerService.instance;
    }

    /**
     * Create instance with custom dependencies (for testing and DI)
     */
    public static createWithDependencies(
        providerManager: IProviderManager,
        templateManager: TemplateManager
    ): PromptRefinerService {
        return new PromptRefinerService(providerManager, templateManager);
    }

    /**
     * Reset singleton instance (for testing)
     */
    public static resetInstance(): void {
        PromptRefinerService.instance = undefined as any;
    }

    public initialize(context: vscode.ExtensionContext) {
        this.context = context;
        ConfigurationManager.getInstance().initialize(context);
        this.templateManager.initialize(context);
    }

    public async refine(
        userPrompt: string, 
        token?: vscode.CancellationToken,
        options?: RefinementOptions
    ): Promise<RefinementResult> {
        if (!this.context) {
            throw new Error('Service not initialized. Call initialize() first.');
        }

        // Validate input
        const validation = InputValidator.validatePromptLength(userPrompt);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // Check cancellation before starting
        if (token?.isCancellationRequested) {
            throw new Error('Operation cancelled');
        }

        // Generate cache key
        const providerId = ConfigurationManager.getInstance().getProviderId();
        const modelId = ConfigurationManager.getInstance().getModelId();
        const templateId = options?.templateId || 'default';
        const isStrict = ConfigurationManager.getInstance().isStrictMode();
        
        const cacheKey = LRUCache.generateKey({
            prompt: userPrompt,
            provider: providerId,
            model: modelId,
            template: templateId,
            strict: isStrict,
        });

        // Check cache
        const cached = refinementCache.get(cacheKey);
        if (cached) {
            logger.info('Cache hit - returning cached refinement');
            return {
                refined: cached,
                templateUsed: templateId,
                iteration: options?.iteration || 1,
            };
        }

        logger.debug('Loading prompt template', { templateId });

        // Load template
        const systemTemplate = await this.loadTemplate(options?.templateId);

        // Check cancellation before calling provider
        if (token?.isCancellationRequested) {
            throw new Error('Operation cancelled');
        }

        logger.info('Calling provider for refinement', { 
            iteration: options?.iteration || 1,
            templateId,
            provider: providerId,
        });

        const activeProvider = this.providerManager.getActiveProvider();
        const circuitBreaker = getCircuitBreaker(providerId);
        
        try {
            // Execute with circuit breaker and retry logic
            const refined = await circuitBreaker.execute(async () => {
                return withRetry(async () => {
                    // Check cancellation before each attempt
                    if (token?.isCancellationRequested) {
                        throw new Error('Operation cancelled');
                    }
                    
                    return activeProvider.refine(userPrompt, systemTemplate, { strict: isStrict });
                }, {
                    maxRetries: 3,
                    baseDelayMs: 1000,
                    maxDelayMs: 10000,
                });
            });

            // Store in cache
            refinementCache.set(cacheKey, refined);
            
            // Validate output if requested
            let validationResult: ValidationResult | undefined;
            if (options?.validateOutput !== false) {
                validationResult = OutputValidator.validate(refined, isStrict);
                
                if (!validationResult.valid) {
                    logger.warn('Refined prompt validation failed', { 
                        score: validationResult.score,
                        issues: validationResult.issues.length 
                    });
                }
            }

            logger.info('Refinement completed successfully', { 
                score: validationResult?.score,
                valid: validationResult?.valid 
            });

            return {
                refined,
                validation: validationResult,
                templateUsed: templateId,
                iteration: options?.iteration || 1,
            };
        } catch (error) {
            // Handle circuit breaker error specially
            if (error instanceof CircuitBreakerError) {
                logger.error('Circuit breaker is open', error as Error);
                
                // Try to extract provider from error message
                const match = (error as Error).message.match(/"([^"]+)"/);
                const providerName = match ? match[1] : 'current provider';
                
                // Suggest switching provider
                const action = await vscode.window.showWarningMessage(
                    `Provider "${providerName}" is temporarily unavailable. Would you like to switch to a different provider?`,
                    'Switch Provider',
                    'Use Fallback',
                    'Dismiss'
                );
                
                if (action === 'Switch Provider') {
                    await vscode.commands.executeCommand('promptRefiner.selectModel');
                } else if (action === 'Use Fallback') {
                    // Force switch to public provider
                    await ConfigurationManager.getInstance().setProviderId('public');
                    vscode.window.showInformationMessage('Switched to public (free) provider');
                    
                    // Retry with new provider
                    return this.refine(userPrompt, token, options);
                }
            }
            
            logger.error('Refinement failed', error as Error);
            throw error;
        }
    }

    /**
     * Re-refine a prompt with additional context
     */
    public async reRefine(
        originalPrompt: string,
        previousResult: string,
        feedback: string,
        token?: vscode.CancellationToken,
        options?: RefinementOptions
    ): Promise<RefinementResult> {
        const enhancedPrompt = `Original prompt: ${originalPrompt}

Previous refined version: ${previousResult}

Feedback/Requirements for improvement: ${feedback}

Please refine the prompt again incorporating the feedback above.`;

        return this.refine(enhancedPrompt, token, {
            ...options,
            iteration: (options?.iteration || 1) + 1,
        });
    }

    /**
     * Load template content
     */
    private async loadTemplate(templateId?: string): Promise<string> {
        // If specific template requested
        if (templateId && templateId !== 'default' && templateId !== 'strict') {
            const template = await this.templateManager.getTemplate(templateId);
            if (template && template.content) {
                return template.content;
            }
        }

        // Load from file system (default or strict)
        const isStrict = ConfigurationManager.getInstance().isStrictMode();
        const templateName = isStrict ? 'prompt_template_strict.md' : 'prompt_template.md';
        const templatePath = this.context!.asAbsolutePath(path.join('dist', 'templates', templateName));

        try {
            return fs.readFileSync(templatePath, 'utf-8');
        } catch (error) {
            // Try src path if dist fails (debug mode)
            const srcPath = this.context!.asAbsolutePath(path.join('src', 'templates', templateName));
            try {
                return fs.readFileSync(srcPath, 'utf-8');
            } catch (err) {
                logger.error('Failed to load prompt template', err as Error);
                throw new Error('Could not load prompt template. Please check installation.');
            }
        }
    }

    /**
     * Select a template interactively
     */
    public async selectTemplate(): Promise<CustomTemplate | undefined> {
        const templates = await this.templateManager.getAllTemplates();
        
        const items = templates.map(t => ({
            label: t.name,
            description: t.description,
            detail: t.isBuiltIn ? 'Built-in' : 'Custom',
            id: t.id,
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a refinement template',
            title: 'Prompt Refiner: Select Template',
        });

        if (selected) {
            return this.templateManager.getTemplate(selected.id);
        }

        return undefined;
    }
}
