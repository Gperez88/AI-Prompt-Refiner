export interface ProviderMeta {
    id: string;
    name: string;
    description?: string;
}

/** Options passed to {@link IAIProvider.refine} */
export interface RefineCallOptions {
    strict?: boolean;
    temperature?: number;
    /** When set, network requests should abort if the signal is triggered */
    signal?: AbortSignal;
}

/** Return type for provider refine() method - includes token count for display */
export interface RefineResult {
    refined: string;
    tokens: number;
}

export interface IAIProvider {
    readonly id: string;
    readonly name: string;

    /**
     * Checks if the provider is fully configured (e.g. has API keys).
     */
    isConfigured(): boolean;

    /**
     * Refines the user prompt using the provided system template.
     * @param userPrompt The raw input from the user.
     * @param systemTemplate The system instruction to guide the AI.
     * @param options Additional options (like strict mode).
     */
    refine(
        userPrompt: string,
        systemTemplate: string,
        options?: RefineCallOptions
    ): Promise<RefineResult>;
}
