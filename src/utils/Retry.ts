import { logger } from '../services/Logger';

import { randomInt } from 'crypto';

/**
 * Retry configuration
 */
export interface RetryConfig {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    retryableErrors: string[];
}

/**
 * Retry state
 */
interface RetryState {
    attempt: number;
    lastError?: Error;
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
): Promise<T> {
    const retryConfig: RetryConfig = {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'timeout', 'rate limit'],
        ...config,
    };

    // Try up to maxRetries + 1 times (1 initial + maxRetries retries)
    for (let attempt = 1; attempt <= retryConfig.maxRetries + 1; attempt++) {
        try {
            return await fn();
        } catch (error) {
            // Check if we should retry
            if (attempt > retryConfig.maxRetries) {
                logger.warn('Max retries exceeded', {
                    attempts: attempt,
                    lastError: (error as Error).message,
                });
                throw error;
            }

            // Check if error is retryable
            if (!isRetryableError(error as Error, retryConfig.retryableErrors)) {
                logger.debug('Non-retryable error, failing fast', {
                    error: (error as Error).message,
                });
                throw error;
            }

            // Calculate delay with exponential backoff and jitter
            const delay = calculateDelay(attempt, retryConfig);
            
            logger.info(`Retrying after error (attempt ${attempt}/${retryConfig.maxRetries})`, {
                error: (error as Error).message,
                delayMs: delay,
            });

            await sleep(delay);
        }
    }
    
    // This line should never be reached, but satisfies TypeScript
    throw new Error('Retry loop completed without success or error');
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: Error, retryablePatterns: string[]): boolean {
    const errorMessage = error.message.toLowerCase();
    
    return retryablePatterns.some(pattern => 
        errorMessage.includes(pattern.toLowerCase())
    );
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
    // Exponential backoff: baseDelay * 2^(attempt-1)
    const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt - 1);
    
    // Add jitter (±25%) to prevent thundering herd using secure randomness
    const jitter = exponentialDelay * 0.25 * ((randomInt(0, 1000) / 1000) * 2 - 1);
    
    // Cap at maxDelay
    return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute with timeout and retry
 */
export async function withTimeoutAndRetry<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    retryConfig?: Partial<RetryConfig>
): Promise<T> {
    return withRetry(async () => {
        return withTimeout(fn, timeoutMs);
    }, retryConfig);
}

/**
 * Execute with timeout
 */
function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
        fn(),
        new Promise<T>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Operation timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        }),
    ]);
}
