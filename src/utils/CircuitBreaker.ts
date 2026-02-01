import { logger } from '../services/Logger';

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
    CLOSED = 'CLOSED',       // Normal operation
    OPEN = 'OPEN',          // Failing, rejecting requests
    HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
    failureThreshold: number;      // Number of failures before opening
    resetTimeoutMs: number;        // Time before attempting reset
    halfOpenMaxCalls: number;      // Max calls in half-open state
}

/**
 * Circuit breaker pattern implementation
 * Protects against cascading failures
 */
export class CircuitBreaker {
    private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
    private failureCount = 0;
    private successCount = 0;
    private lastFailureTime?: number;
    private halfOpenCalls = 0;
    private readonly config: CircuitBreakerConfig;
    private readonly name: string;

    constructor(
        name: string,
        config: Partial<CircuitBreakerConfig> = {}
    ) {
        this.name = name;
        this.config = {
            failureThreshold: 5,
            resetTimeoutMs: 60000, // 1 minute
            halfOpenMaxCalls: 3,
            ...config,
        };
    }

    /**
     * Execute a function with circuit breaker protection
     */
    public async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === CircuitBreakerState.OPEN) {
            if (this.shouldAttemptReset()) {
                this.transitionToHalfOpen();
            } else {
                throw new CircuitBreakerError(
                    `Circuit breaker for "${this.name}" is OPEN`,
                    this.name,
                    this.getState()
                );
            }
        }

        if (this.state === CircuitBreakerState.HALF_OPEN) {
            if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
                throw new CircuitBreakerError(
                    `Circuit breaker for "${this.name}" is HALF_OPEN (max calls reached)`,
                    this.name,
                    this.getState()
                );
            }
            this.halfOpenCalls++;
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    /**
     * Handle successful execution
     */
    private onSuccess(): void {
        this.failureCount = 0;

        if (this.state === CircuitBreakerState.HALF_OPEN) {
            this.successCount++;
            
            if (this.successCount >= this.config.halfOpenMaxCalls) {
                this.transitionToClosed();
                logger.info(`Circuit breaker "${this.name}" closed`, {
                    provider: this.name,
                    state: this.state,
                });
            }
        }
    }

    /**
     * Handle failed execution
     */
    private onFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.state === CircuitBreakerState.HALF_OPEN) {
            this.transitionToOpen();
        } else if (this.failureCount >= this.config.failureThreshold) {
            this.transitionToOpen();
            logger.warn(`Circuit breaker "${this.name}" opened`, {
                provider: this.name,
                failureCount: this.failureCount,
            });
        }
    }

    /**
     * Check if enough time has passed to attempt reset
     */
    private shouldAttemptReset(): boolean {
        if (!this.lastFailureTime) return true;
        return Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs;
    }

    /**
     * Transition to CLOSED state
     */
    private transitionToClosed(): void {
        this.state = CircuitBreakerState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.halfOpenCalls = 0;
    }

    /**
     * Transition to OPEN state
     */
    private transitionToOpen(): void {
        this.state = CircuitBreakerState.OPEN;
        this.halfOpenCalls = 0;
        this.successCount = 0;
    }

    /**
     * Transition to HALF_OPEN state
     */
    private transitionToHalfOpen(): void {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.halfOpenCalls = 0;
        this.successCount = 0;
        logger.info(`Circuit breaker "${this.name}" half-opened`, {
            provider: this.name,
        });
    }

    /**
     * Get current state
     */
    public getState(): CircuitBreakerState {
        return this.state;
    }

    /**
     * Get statistics
     */
    public getStats() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            halfOpenCalls: this.halfOpenCalls,
            lastFailureTime: this.lastFailureTime,
        };
    }

    /**
     * Force reset (manual recovery)
     */
    public reset(): void {
        this.transitionToClosed();
        logger.info(`Circuit breaker "${this.name}" manually reset`);
    }
}

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitBreakerError extends Error {
    constructor(
        message: string,
        public readonly provider: string,
        public readonly state: CircuitBreakerState
    ) {
        super(message);
        this.name = 'CircuitBreakerError';
    }
}

/**
 * Global circuit breakers for each provider
 */
export const circuitBreakers: Map<string, CircuitBreaker> = new Map();

/**
 * Get or create circuit breaker for a provider
 */
export function getCircuitBreaker(providerId: string): CircuitBreaker {
    if (!circuitBreakers.has(providerId)) {
        circuitBreakers.set(
            providerId,
            new CircuitBreaker(providerId, {
                failureThreshold: 3,
                resetTimeoutMs: 30000, // 30 seconds
                halfOpenMaxCalls: 2,
            })
        );
    }
    return circuitBreakers.get(providerId)!;
}

/**
 * Clear all circuit breakers (useful for testing)
 */
export function clearCircuitBreakers(): void {
    circuitBreakers.clear();
}
