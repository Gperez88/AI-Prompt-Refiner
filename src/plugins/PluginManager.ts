/**
 * Plugin System for Prompt Refiner
 * 
 * Provides extensibility through plugins:
 * - Custom providers
 * - Custom templates
 * - Custom validators
 * - Event hooks
 */

import { IAIProvider } from '../providers/IAIProvider';
import { logger } from '../services/Logger';

/**
 * Plugin interface that all plugins must implement
 */
export interface IPromptRefinerPlugin {
  /** Unique plugin identifier */
  readonly id: string;
  
  /** Plugin display name */
  readonly name: string;
  
  /** Plugin version (semver) */
  readonly version: string;
  
  /** Plugin description */
  readonly description?: string;
  
  /** Author information */
  readonly author?: string;
  
  /** Initialize the plugin */
  initialize?(context: PluginContext): Promise<void> | void;
  
  /** Clean up when plugin is deactivated */
  deactivate?(): Promise<void> | void;
}

/**
 * Plugin context provided during initialization
 */
export interface PluginContext {
  /** Register a custom AI provider */
  registerProvider(provider: IAIProvider): void;
  
  /** Register a custom template */
  registerTemplate(template: PluginTemplate): void;
  
  /** Register a custom validator */
  registerValidator(validator: PluginValidator): void;
  
  /** Subscribe to events */
  on(event: PluginEvent, handler: EventHandler): void;
  
  /** Unsubscribe from events */
  off(event: PluginEvent, handler: EventHandler): void;
  
  /** Get extension configuration */
  getConfig(): any;
  
  /** Log messages through extension logger */
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void;
}

/**
 * Plugin template definition
 */
export interface PluginTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  category: string;
}

/**
 * Plugin validator definition
 */
export interface PluginValidator {
  id: string;
  name: string;
  validate(output: string): ValidationResult;
}

/**
 * Validation result from plugin validator
 */
export interface ValidationResult {
  valid: boolean;
  score: number;
  issues: string[];
}

/**
 * Plugin events
 */
export type PluginEvent = 
  | 'beforeRefine'
  | 'afterRefine'
  | 'onError'
  | 'onCacheHit'
  | 'onCacheMiss';

/**
 * Event handler type
 */
type EventHandler = (data: any) => void;

/**
 * Plugin manager
 */
export class PluginManager {
    private static instance: PluginManager;
    private plugins: Map<string, IPromptRefinerPlugin> = new Map();
    private providers: Map<string, IAIProvider> = new Map();
    private templates: Map<string, PluginTemplate> = new Map();
    private validators: Map<string, PluginValidator> = new Map();
    private eventHandlers: Map<PluginEvent, Set<EventHandler>> = new Map();
    private context: PluginContext;

    private constructor() {
        this.context = this.createContext();
    }

    public static getInstance(): PluginManager {
        if (!PluginManager.instance) {
            PluginManager.instance = new PluginManager();
        }
        return PluginManager.instance;
    }

    /**
   * Create plugin context
   */
    private createContext(): PluginContext {
        return {
            registerProvider: (provider: IAIProvider) => {
                this.providers.set(provider.id, provider);
                logger.info('Provider registered by plugin', { providerId: provider.id });
            },

            registerTemplate: (template: PluginTemplate) => {
                this.templates.set(template.id, template);
                logger.info('Template registered by plugin', { templateId: template.id });
            },

            registerValidator: (validator: PluginValidator) => {
                this.validators.set(validator.id, validator);
                logger.info('Validator registered by plugin', { validatorId: validator.id });
            },

            on: (event: PluginEvent, handler: EventHandler) => {
                if (!this.eventHandlers.has(event)) {
                    this.eventHandlers.set(event, new Set());
                }
        this.eventHandlers.get(event)!.add(handler);
            },

            off: (event: PluginEvent, handler: EventHandler) => {
                this.eventHandlers.get(event)?.delete(handler);
            },

            getConfig: () => {
                // Return extension configuration
                return {};
            },

            log: (level: string, message: string, ...args: any[]) => {
                switch (level) {
                case 'debug':
                    logger.debug(message, ...args);
                    break;
                case 'info':
                    logger.info(message, ...args);
                    break;
                case 'warn':
                    logger.warn(message, ...args);
                    break;
                case 'error':
                    logger.error(message, ...args);
                    break;
                default:
                    logger.info(message, ...args);
                }
            },
        };
    }

    /**
   * Load and activate a plugin
   */
    public async loadPlugin(plugin: IPromptRefinerPlugin): Promise<void> {
        if (this.plugins.has(plugin.id)) {
            throw new Error(`Plugin ${plugin.id} is already loaded`);
        }

        logger.info('Loading plugin', { 
            pluginId: plugin.id, 
            name: plugin.name,
            version: plugin.version 
        });

        // Initialize if provided
        if (plugin.initialize) {
            await plugin.initialize(this.context);
        }

        this.plugins.set(plugin.id, plugin);
        logger.info('Plugin loaded successfully', { pluginId: plugin.id });
    }

    /**
   * Unload and deactivate a plugin
   */
    public async unloadPlugin(pluginId: string): Promise<void> {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }

        logger.info('Unloading plugin', { pluginId });

        // Deactivate if provided
        if (plugin.deactivate) {
            await plugin.deactivate();
        }

        // Clean up registrations
        // (In a real implementation, track which resources belong to which plugin)
    
        this.plugins.delete(pluginId);
        logger.info('Plugin unloaded', { pluginId });
    }

    /**
   * Get a registered provider
   */
    public getProvider(id: string): IAIProvider | undefined {
        return this.providers.get(id);
    }

    /**
   * Get all registered providers
   */
    public getAllProviders(): IAIProvider[] {
        return Array.from(this.providers.values());
    }

    /**
   * Get a registered template
   */
    public getTemplate(id: string): PluginTemplate | undefined {
        return this.templates.get(id);
    }

    /**
   * Get all registered templates
   */
    public getAllTemplates(): PluginTemplate[] {
        return Array.from(this.templates.values());
    }

    /**
   * Emit an event to all registered handlers
   */
    public emit(event: PluginEvent, data: any): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    logger.error('Error in event handler', error as Error);
                }
            });
        }
    }

    /**
   * Get list of loaded plugins
   */
    public getLoadedPlugins(): IPromptRefinerPlugin[] {
        return Array.from(this.plugins.values());
    }

    /**
   * Check if a plugin is loaded
   */
    public isLoaded(pluginId: string): boolean {
        return this.plugins.has(pluginId);
    }
}

/**
 * Example plugin implementation
 */
export class ExamplePlugin implements IPromptRefinerPlugin {
    readonly id = 'example-plugin';
    readonly name = 'Example Plugin';
    readonly version = '1.0.0';
    readonly description = 'Demonstrates plugin API usage';
    readonly author = 'Your Name';

    initialize(context: PluginContext): void {
        context.log('info', 'Example plugin initialized');
    
        // Subscribe to events
        context.on('beforeRefine', (data) => {
            context.log('debug', 'About to refine:', data);
        });
    }

    deactivate(): void {
        logger.info('Example plugin deactivated');
    }
}
