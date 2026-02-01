/**
 * Simple Dependency Injection Container
 * 
 * Provides basic DI capabilities for the extension:
 * - Service registration
 * - Service resolution
 * - Singleton lifecycle management
 * - Factory functions support
 */

import { logger } from '../services/Logger';

/**
 * Service lifetime options
 */
export enum ServiceLifetime {
  /** Single instance shared across the application */
  Singleton = 'singleton',
  /** New instance created for each resolution */
  Transient = 'transient',
  /** Single instance per scope (future enhancement) */
  Scoped = 'scoped',
}

/**
 * Service descriptor
 */
interface ServiceDescriptor<T> {
  token: symbol;
  lifetime: ServiceLifetime;
  factory: () => T;
  instance?: T;
}

/**
 * Type token for service identification
 */
export type ServiceToken<T> = symbol & { __serviceType: T };

/**
 * Creates a unique service token
 */
export function createToken<T>(name: string): ServiceToken<T> {
    return Symbol(name) as ServiceToken<T>;
}

/**
 * Dependency Injection Container
 */
export class DIContainer {
    private static instance: DIContainer;
    private services: Map<symbol, ServiceDescriptor<any>> = new Map();

    private constructor() {
        // Private constructor to prevent direct instantiation - use getInstance()
    }

    /**
   * Get the singleton container instance
   */
    public static getInstance(): DIContainer {
        if (!DIContainer.instance) {
            DIContainer.instance = new DIContainer();
        }
        return DIContainer.instance;
    }

    /**
   * Register a service with singleton lifetime
   */
    public registerSingleton<T>(token: ServiceToken<T>, factory: () => T): void {
        this.services.set(token, {
            token,
            lifetime: ServiceLifetime.Singleton,
            factory,
        });
        logger.debug('Service registered (singleton)', { token: token.description });
    }

    /**
   * Register a service with transient lifetime
   */
    public registerTransient<T>(token: ServiceToken<T>, factory: () => T): void {
        this.services.set(token, {
            token,
            lifetime: ServiceLifetime.Transient,
            factory,
        });
        logger.debug('Service registered (transient)', { token: token.description });
    }

    /**
   * Register an existing instance as a singleton
   */
    public registerInstance<T>(token: ServiceToken<T>, instance: T): void {
        this.services.set(token, {
            token,
            lifetime: ServiceLifetime.Singleton,
            factory: () => instance,
            instance,
        });
        logger.debug('Service registered (instance)', { token: token.description });
    }

    /**
   * Resolve a service by token
   */
    public resolve<T>(token: ServiceToken<T>): T {
        const descriptor = this.services.get(token);
    
        if (!descriptor) {
            throw new Error(`Service not registered: ${token.description}`);
        }

        // Return existing singleton instance
        if (descriptor.lifetime === ServiceLifetime.Singleton && descriptor.instance) {
            return descriptor.instance;
        }

        // Create new instance
        const instance = descriptor.factory();

        // Store if singleton
        if (descriptor.lifetime === ServiceLifetime.Singleton) {
            descriptor.instance = instance;
        }

        logger.debug('Service resolved', { 
            token: token.description,
            lifetime: descriptor.lifetime 
        });

        return instance;
    }

    /**
   * Check if a service is registered
   */
    public isRegistered<T>(token: ServiceToken<T>): boolean {
        return this.services.has(token);
    }

    /**
   * Remove a service registration
   */
    public unregister<T>(token: ServiceToken<T>): boolean {
        const deleted = this.services.delete(token);
        if (deleted) {
            logger.debug('Service unregistered', { token: token.description });
        }
        return deleted;
    }

    /**
   * Clear all registrations
   */
    public clear(): void {
        this.services.clear();
        logger.debug('All services cleared from container');
    }

    /**
   * Get all registered service tokens
   */
    public getRegisteredTokens(): symbol[] {
        return Array.from(this.services.keys());
    }
}

/**
 * Global DI Container instance
 */
export const container = DIContainer.getInstance();

/**
 * Service tokens for core services
 */
export const TOKENS = {
    PromptRefinerService: createToken<any>('PromptRefinerService'),
    ConfigurationManager: createToken<any>('ConfigurationManager'),
    TemplateManager: createToken<any>('TemplateManager'),
    ChatHistoryManager: createToken<any>('ChatHistoryManager'),
    ProviderManager: createToken<any>('ProviderManager'),
    Logger: createToken<any>('Logger'),
} as const;
