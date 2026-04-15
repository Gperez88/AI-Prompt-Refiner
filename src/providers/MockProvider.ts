import { IAIProvider, RefineCallOptions, RefineResult } from './IAIProvider';

export class MockProvider implements IAIProvider {
    readonly id = 'mock';
    readonly name = 'Mock Provider (Offline)';

    isConfigured(): boolean {
        return true;
    }

    async refine(userPrompt: string, systemTemplate: string, options?: RefineCallOptions): Promise<RefineResult> {
        const signal = options?.signal;
        await new Promise<void>((resolve, reject) => {
            if (signal?.aborted) {
                reject(new Error('Operation cancelled'));
                return;
            }
            const id = setTimeout(resolve, 500);
            signal?.addEventListener('abort', () => {
                clearTimeout(id);
                reject(new Error('Operation cancelled'));
            }, { once: true });
        });

        const refined = `[MOCK REFINEMENT]
Refined version of: "${userPrompt}"

[Objective]
Clean up the user input.

[Context]
Using Mock Provider.

[Constraints]
- Offline mode
- No real AI processing

[Expected Output]
A demonstrated refined prompt structure.
`;
        const tokens = Math.ceil(refined.length / 3.5);
        return { refined, tokens };
    }
}
