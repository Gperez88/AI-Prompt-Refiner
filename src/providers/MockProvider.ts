import { IAIProvider } from './IAIProvider';

export class MockProvider implements IAIProvider {
    readonly id = 'mock';
    readonly name = 'Mock Provider (Offline)';

    isConfigured(): boolean {
        return true;
    }

    async refine(userPrompt: string, systemTemplate: string, options?: { strict?: boolean; temperature?: number }): Promise<string> {
        // Simulate network latency
        await new Promise(resolve => setTimeout(resolve, 500));

        return `[MOCK REFINEMENT]
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
    }
}
