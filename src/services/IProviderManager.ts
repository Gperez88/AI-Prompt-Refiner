import { IAIProvider } from '../providers/IAIProvider';

/**
 * Interface for managing AI providers
 * Implementations handle provider lifecycle, loading, and selection
 */
export interface IProviderManager {
    /**
     * Get the currently active provider based on configuration
     * @returns The active AI provider instance
     */
    getActiveProvider(): IAIProvider;

    /**
     * Preload a provider to improve first-use performance
     * @param id The provider ID to preload
     */
    preloadProvider(id: string): void;

    /**
     * Get the number of currently loaded providers
     * @returns Count of loaded providers
     */
    getLoadedCount(): number;

    /**
     * Clear all provider instances
     */
    clear(): void;
}
