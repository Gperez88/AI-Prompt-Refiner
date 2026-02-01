import { logger } from '../services/Logger';

/**
 * Validation result for prompt output
 */
export interface ValidationResult {
    valid: boolean;
    score: number; // 0-100
    issues: ValidationIssue[];
    suggestions: string[];
}

/**
 * Individual validation issue
 */
export interface ValidationIssue {
    type: 'error' | 'warning' | 'info';
    message: string;
    section?: string;
}

/**
 * Expected sections in a refined prompt
 */
const EXPECTED_SECTIONS = [
    { name: 'Objective', required: true, aliases: ['objective', 'goal', 'task'] },
    { name: 'Context', required: false, aliases: ['context', 'background', 'situation'] },
    { name: 'Constraints', required: false, aliases: ['constraints', 'requirements', 'rules'] },
    { name: 'Scope', required: false, aliases: ['scope', 'limits', 'boundaries'] },
    { name: 'Expected Output', required: true, aliases: ['expected output', 'output', 'deliverable', 'result'] },
];

/**
 * Validates the output of prompt refinement
 */
export class OutputValidator {
    /**
     * Validate a refined prompt
     * @param output The refined prompt text
     * @param strict If true, requires all mandatory sections
     */
    public static validate(output: string, strict = false): ValidationResult {
        const issues: ValidationIssue[] = [];
        const suggestions: string[] = [];
        let score = 100;

        // Check if output is empty or too short
        if (!output || output.trim().length === 0) {
            issues.push({
                type: 'error',
                message: 'Output is empty',
            });
            return { valid: false, score: 0, issues, suggestions };
        }

        if (output.length < 50) {
            issues.push({
                type: 'warning',
                message: 'Output seems too short to be a complete refined prompt',
            });
            score -= 20;
        }

        // Check for expected sections
        const foundSections = this.findSections(output);
        
        for (const expected of EXPECTED_SECTIONS) {
            const found = foundSections.some(s => 
                expected.aliases.some(alias => s.toLowerCase().includes(alias))
            );

            if (expected.required && !found) {
                issues.push({
                    type: strict ? 'error' : 'warning',
                    message: `Missing required section: ${expected.name}`,
                    section: expected.name,
                });
                score -= strict ? 30 : 15;
            } else if (!expected.required && !found) {
                suggestions.push(`Consider adding ${expected.name} section for clarity`);
                score -= 5;
            }
        }

        // Check for conversational filler
        const fillerPatterns = [
            /^(sure|okay|alright|great|perfect),?\s*/i,
            /here('s| is) (the|your) (refined|improved|optimized|better) (prompt|version)/i,
            /i('ve| have) (refined|improved|optimized)/i,
            /let me (refine|improve|optimize)/i,
        ];

        for (const pattern of fillerPatterns) {
            if (pattern.test(output)) {
                issues.push({
                    type: 'warning',
                    message: 'Output contains conversational filler that should be removed',
                });
                score -= 10;
                break;
            }
        }

        // Check for markdown code blocks (shouldn't wrap the entire prompt)
        const codeBlockMatches = output.match(/```[\s\S]*?```/g);
        if (codeBlockMatches && codeBlockMatches.length > 0) {
            // Check if entire output is wrapped in code block
            const trimmedOutput = output.trim();
            if (trimmedOutput.startsWith('```') && trimmedOutput.endsWith('```')) {
                issues.push({
                    type: 'warning',
                    message: 'Output is wrapped in markdown code block - this may not be desired',
                });
                score -= 15;
            }
        }

        // Check prompt length
        const lineCount = output.split('\n').length;
        if (lineCount < 3) {
            issues.push({
                type: 'warning',
                message: 'Output is very short - may lack sufficient detail',
            });
            score -= 10;
        } else if (lineCount > 100) {
            suggestions.push('Consider if the prompt can be more concise');
            score -= 5;
        }

        // Check for actionable language
        const actionableVerbs = ['create', 'build', 'implement', 'develop', 'design', 'write', 'analyze', 'generate'];
        const hasActionableVerb = actionableVerbs.some(verb => 
            output.toLowerCase().includes(verb)
        );
        
        if (!hasActionableVerb) {
            suggestions.push('Consider using more actionable verbs (create, build, implement, etc.)');
            score -= 5;
        }

        // Ensure score is within bounds
        score = Math.max(0, Math.min(100, score));

        // Valid if no errors and score >= 70
        const valid = !issues.some(i => i.type === 'error') && score >= 70;

        logger.debug('Prompt output validated', { 
            valid, 
            score, 
            issueCount: issues.length,
            suggestionCount: suggestions.length 
        });

        return { valid, score, issues, suggestions };
    }

    /**
     * Find section headers in the output
     */
    private static findSections(output: string): string[] {
        const sections: string[] = [];
        const lines = output.split('\n');
        
        for (const line of lines) {
            // Match patterns like "[Section]", "Section:", "## Section"
            const patterns = [
                /^\[([^\]]+)\]/,           // [Section]
                /^#{1,3}\s+(.+)$/,          // ## Section
                /^([A-Z][A-Za-z\s]+):/,     // Section:
            ];
            
            for (const pattern of patterns) {
                const match = line.trim().match(pattern);
                if (match) {
                    sections.push(match[1].trim());
                    break;
                }
            }
        }
        
        return sections;
    }

    /**
     * Format validation result as readable text
     */
    public static formatResult(result: ValidationResult): string {
        let text = `Validation Score: ${result.score}/100\n\n`;
        
        if (result.issues.length > 0) {
            text += 'Issues:\n';
            for (const issue of result.issues) {
                const icon = issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️';
                text += `${icon} ${issue.message}\n`;
            }
            text += '\n';
        }
        
        if (result.suggestions.length > 0) {
            text += 'Suggestions:\n';
            for (const suggestion of result.suggestions) {
                text += `💡 ${suggestion}\n`;
            }
        }
        
        return text;
    }

    /**
     * Quick check if output looks like a valid refined prompt
     */
    public static isValidQuick(output: string): boolean {
        if (!output || output.trim().length < 50) {
            return false;
        }
        
        const result = this.validate(output, false);
        return result.valid;
    }
}
