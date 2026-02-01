import { logger } from '../services/Logger';

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
    value: T;
    timestamp: number;
    hits: number;
}

/**
 * LRU (Least Recently Used) Cache implementation
 * with TTL (Time To Live) support
 */
export class LRUCache<T> {
    private cache: Map<string, CacheEntry<T>>;
    private readonly maxSize: number;
    private readonly ttlMs: number;

    constructor(maxSize = 100, ttlMs = 3600000) { // Default 1 hour TTL
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
    }

    /**
     * Generate cache key from parameters
     */
    public static generateKey(params: Record<string, any>): string {
        const sorted = Object.keys(params).sort().reduce((acc, key) => {
            acc[key] = params[key];
            return acc;
        }, {} as Record<string, any>);
        
        return JSON.stringify(sorted);
    }

    /**
     * Get value from cache
     */
    public get(key: string): T | undefined {
        const entry = this.cache.get(key);
        
        if (!entry) {
            return undefined;
        }

        // Check if expired
        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(key);
            logger.debug('Cache entry expired', { key });
            return undefined;
        }

        // Update hits and move to end (LRU)
        entry.hits++;
        this.cache.delete(key);
        this.cache.set(key, entry);
        
        logger.debug('Cache hit', { key, hits: entry.hits });
        return entry.value;
    }

    /**
     * Set value in cache
     */
    public set(key: string, value: T): void {
        // Remove oldest if at capacity
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
                logger.debug('Cache evicted oldest entry', { evictedKey: firstKey });
            }
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            hits: 0,
        });
        
        logger.debug('Cache set', { key, size: this.cache.size });
    }

    /**
     * Check if key exists in cache (and not expired)
     */
    public has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;
        
        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(key);
            return false;
        }
        
        return true;
    }

    /**
     * Delete specific key from cache
     */
    public delete(key: string): boolean {
        return this.cache.delete(key);
    }

    /**
     * Clear all cache entries
     */
    public clear(): void {
        this.cache.clear();
        logger.info('Cache cleared');
    }

    /**
     * Get cache statistics
     */
    public getStats(): { size: number; maxSize: number; ttlMs: number } {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            ttlMs: this.ttlMs,
        };
    }

    /**
     * Clean up expired entries
     */
    public cleanup(): number {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.ttlMs) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            logger.debug('Cache cleanup completed', { cleaned, remaining: this.cache.size });
        }
        
        return cleaned;
    }
}

/**
 * Global cache instance for refined prompts
 */
export const refinementCache = new LRUCache<string>(50, 3600000); // 50 entries, 1 hour TTL
