/**
 * Error types for classification
 */
export enum ErrorType {
    NETWORK = 'NETWORK',
    AUTHENTICATION = 'AUTHENTICATION',
    RATE_LIMIT = 'RATE_LIMIT',
    TIMEOUT = 'TIMEOUT',
    INVALID_INPUT = 'INVALID_INPUT',
    PROVIDER_ERROR = 'PROVIDER_ERROR',
    UNKNOWN = 'UNKNOWN',
}

/**
 * Error information with user-friendly messages and actions
 */
export interface ErrorInfo {
    type: ErrorType;
    userMessage: string;
    action?: string;
    shouldRetry: boolean;
}

/**
 * ErrorHandler provides centralized error classification and user-friendly messages
 */
/** Prefixes emitted by providers (e.g. `QUOTA_EXCEEDED|human text`). */
const PIPE_PREFIX_PATTERN = /^([A-Za-z_]+)\|([\s\S]*)$/;

export class ErrorHandler {
    /**
     * Classify an error and provide user-friendly information
     * @param error The error to classify
     * @returns Error information with type, message, and action
     */
    public static classifyError(error: Error): ErrorInfo {
        const raw = error.message;
        const message = raw.toLowerCase();

        const piped = raw.match(PIPE_PREFIX_PATTERN);
        if (piped) {
            const code = piped[1].toUpperCase();
            const rest = piped[2].trim();
            const body = rest.length > 0 ? rest : raw;

            if (code === 'QUOTA_EXCEEDED' || code === 'RATE_LIMIT') {
                return {
                    type: ErrorType.RATE_LIMIT,
                    userMessage: body,
                    action: 'Switch Model',
                    shouldRetry: true,
                };
            }
            if (code === 'AUTH_ERROR') {
                return {
                    type: ErrorType.AUTHENTICATION,
                    userMessage: body,
                    action: 'Set API Key',
                    shouldRetry: false,
                };
            }
            if (code === 'MODEL_ERROR' || code === 'INVALID_MODEL' || code === 'MODEL_DEPRECATED') {
                return {
                    type: ErrorType.PROVIDER_ERROR,
                    userMessage: body,
                    action: 'Switch Model',
                    shouldRetry: code === 'MODEL_DEPRECATED' || code === 'INVALID_MODEL',
                };
            }
            if (code === 'PROVIDER_ERROR') {
                return {
                    type: ErrorType.PROVIDER_ERROR,
                    userMessage: body,
                    action: 'View Logs',
                    shouldRetry: true,
                };
            }
        }

        // Network errors
        if (message.includes('fetch') || 
            message.includes('network') || 
            message.includes('connection') ||
            message.includes('econnrefused') ||
            message.includes('ENOTFOUND')) {
            return {
                type: ErrorType.NETWORK,
                userMessage: 'Network error. Please check your internet connection and try again.',
                action: 'Retry',
                shouldRetry: true,
            };
        }

        // Authentication errors
        if (message.includes('401') || 
            message.includes('403') || 
            message.includes('unauthorized') ||
            message.includes('invalid api key') ||
            message.includes('authentication')) {
            return {
                type: ErrorType.AUTHENTICATION,
                userMessage: 'Authentication failed. Your API key may be invalid or expired.',
                action: 'Set API Key',
                shouldRetry: false,
            };
        }

        // Rate limiting & quota (APIs use varied wording)
        if (message.includes('429') ||
            message.includes('rate limit') ||
            message.includes('too many requests') ||
            message.includes('too_many_requests') ||
            message.includes('418') ||
            message.includes('quota') ||
            message.includes('quota exceeded') ||
            message.includes('resource exhausted') ||
            message.includes('resource_exhausted') ||
            message.includes('capacity')) {
            return {
                type: ErrorType.RATE_LIMIT,
                userMessage:
                    message.includes('quota') || message.includes('resource_exhausted') || message.includes('resource exhausted')
                        ? 'API quota or rate limit reached. Wait before retrying, reduce usage, or switch model / plan. See your provider’s dashboard for limits.'
                        : 'Rate limit exceeded. Please wait a moment and try again, or switch to a different model.',
                action: 'Switch Model',
                shouldRetry: true,
            };
        }

        // Timeout
        if (message.includes('timeout') || 
            message.includes('ETIMEDOUT') ||
            message.includes('request timed out')) {
            return {
                type: ErrorType.TIMEOUT,
                userMessage: 'Request timed out. The server is taking too long to respond.',
                action: 'Retry',
                shouldRetry: true,
            };
        }

        // Provider rejected request shape (not the same as "bad prompt" — e.g. OpenAI invalid_request_error)
        if (
            message.includes('invalid_request_error') ||
            message.includes('validation_error') ||
            message.includes('invalid value') ||
            (message.includes('bad request') && message.includes('400'))
        ) {
            return {
                type: ErrorType.PROVIDER_ERROR,
                userMessage:
                    'The provider rejected this request (model name, parameters, or API format). Check settings and model; the prompt may be fine. Details: ' +
                    raw.slice(0, 400) +
                    (raw.length > 400 ? '…' : ''),
                action: 'Switch Model',
                shouldRetry: true,
            };
        }

        // Likely true input / size issues (narrow — avoid matching "invalid_request_error" etc.)
        if (
            message.includes('invalid argument') ||
            message.includes('malformed') ||
            (message.includes('400') && message.includes('bad request') && !message.includes('invalid_request'))
        ) {
            return {
                type: ErrorType.INVALID_INPUT,
                userMessage: 'Invalid input. Please check your prompt and try again.',
                shouldRetry: false,
            };
        }

        // Provider-specific errors
        if (message.includes('provider') || 
            message.includes('template') ||
            message.includes('could not load')) {
            return {
                type: ErrorType.PROVIDER_ERROR,
                userMessage: `Provider error: ${error.message}`,
                action: 'View Logs',
                shouldRetry: false,
            };
        }

        // Default unknown error
        return {
            type: ErrorType.UNKNOWN,
            userMessage: `An unexpected error occurred: ${error.message}`,
            action: 'View Logs',
            shouldRetry: false,
        };
    }

    /**
     * Create a timeout promise that rejects after specified milliseconds
     * @param ms Milliseconds to wait before timing out
     * @param message Error message
     */
    public static createTimeout(ms: number, message = 'Operation timed out'): Promise<never> {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(message));
            }, ms);
        });
    }

    /**
     * Wrap a promise with a timeout
     * @param promise The promise to wrap
     * @param ms Timeout in milliseconds
     * @param message Optional custom timeout message
     */
    public static async withTimeout<T>(promise: Promise<T>, ms: number, message?: string): Promise<T> {
        return Promise.race([
            promise,
            this.createTimeout(ms, message),
        ]);
    }
}

/**
 * Validates input text
 */
export class InputValidator {
    private static readonly MAX_PROMPT_LENGTH = 4000;
    private static readonly MIN_PROMPT_LENGTH = 1;

    /**
     * Validates prompt text length
     * @param text The text to validate
     * @returns Validation result
     */
    public static validatePromptLength(text: string): { valid: boolean; error?: string } {
        if (!text || text.length < this.MIN_PROMPT_LENGTH) {
            return { valid: false, error: 'Prompt cannot be empty' };
        }

        if (text.length > this.MAX_PROMPT_LENGTH) {
            return { 
                valid: false, 
                error: `Prompt is too long (${text.length} characters). Maximum allowed is ${this.MAX_PROMPT_LENGTH} characters.` 
            };
        }

        return { valid: true };
    }

    /**
     * Validates API key format (basic check)
     * @param key The API key to validate
     * @param provider The provider name
     * @returns Validation result
     */
    public static validateApiKey(key: string, provider: string): { valid: boolean; error?: string } {
        if (!key || key.trim().length === 0) {
            return { valid: false, error: 'API key cannot be empty' };
        }

        // Provider-specific validations
        switch (provider) {
        case 'openai':
            if (!key.startsWith('sk-')) {
                return { valid: false, error: 'OpenAI API key should start with "sk-"' };
            }
            break;
        case 'gemini':
            if (key.length < 20) {
                return { valid: false, error: 'Gemini API key seems too short' };
            }
            break;
        case 'github':
            if (!key.startsWith('ghp_') && !key.startsWith('github_pat_')) {
                return { valid: false, error: 'GitHub token format appears invalid' };
            }
            break;
        }

        return { valid: true };
    }
}

/**
 * Rate limiter to prevent spam
 */
export class RateLimiter {
    private lastCallTime = 0;
    private readonly minInterval: number;

    constructor(minIntervalMs = 1000) {
        this.minInterval = minIntervalMs;
    }

    /**
     * Check if operation can proceed
     * @returns Object with allowed status and remaining time
     */
    public canProceed(): { allowed: boolean; remainingMs?: number } {
        const now = Date.now();
        const elapsed = now - this.lastCallTime;

        if (elapsed >= this.minInterval) {
            this.lastCallTime = now;
            return { allowed: true };
        }

        return { 
            allowed: false, 
            remainingMs: this.minInterval - elapsed 
        };
    }

    /**
     * Reset the rate limiter
     */
    public reset(): void {
        this.lastCallTime = 0;
    }
}
