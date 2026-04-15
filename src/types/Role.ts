/**
 * Role System Types and Constants
 * 
 * Defines the Role interface and predefined roles for the AI Prompt Refiner.
 * Each role represents a persona that influences how the AI responds.
 */

/**
 * Predefined role IDs
 */
export type RoleId = 'programmer' | 'writer' | 'researcher' | 'analyst';

/**
 * Role interface defining a persona/behavior for AI responses
 */
export interface Role {
    id: RoleId;
    name: string;
    description: string;
    systemPrompt: string;
    icon?: string;
}

/**
 * Default role ID when none is specified
 */
export const DEFAULT_ROLE_ID: RoleId = 'programmer';

/**
 * Language rule for prompt refinement: appended to each role systemPrompt and repeated
 * at the end of the full system message in PromptRefinerService (last instruction wins).
 */
export const REFINER_OUTPUT_LANGUAGE_INSTRUCTION = `Output language (refinement task):
- Write the refined prompt in exactly the same language as the user's input (any natural language).
- Do not translate the user's wording or your output to another language unless the user explicitly asked for translation.`;

/** Opening constraint for every role: refinement ≠ execution. */
export const REFINER_MODE_PREAMBLE =
    'PROMPT-REFINEMENT MODE (IDE extension): You only rewrite the user\'s prompt for clarity. Never implement, solve, or demonstrate their request—no tutorials, no full applications, no long code dumps, no walkthroughs. Your entire reply must be the improved prompt text alone, following the template below.';

/** Repeated at end of full system message with language rule. */
export const REFINER_OUTPUT_SCOPE_FOOTER =
    'Task boundary: Respond with ONLY the refined prompt text. Do not fulfill the user\'s task, paste complete implementations, or add solution commentary.';

/**
 * Predefined static roles
 */
export const PREDEFINED_ROLES: Role[] = [
    {
        id: 'programmer',
        name: 'Programmer',
        description: 'Software engineering focus - correctness, maintainability, performance',
        icon: '💻',
        systemPrompt: `${REFINER_MODE_PREAMBLE}

You apply a senior software engineering lens only to how the ask is phrased: scope, constraints, stack, quality bar, and edge cases worth mentioning in the prompt.

When refining a prompt (not building software):
- Make the task unambiguous and testable as a written ask
- Mention security, performance, or maintainability only as brief constraints the prompt should state, not as code or build steps
- Do not attach source files, dependency lists, or multi-step implementation instructions to your answer

${REFINER_OUTPUT_LANGUAGE_INSTRUCTION}`
    },
    {
        id: 'writer',
        name: 'Writer',
        description: 'Professional writing focus - clarity, tone, structure, audience',
        icon: '✍️',
        systemPrompt: `${REFINER_MODE_PREAMBLE}

You apply a writing and communication lens only to how the request is phrased: audience, tone, format, length, and structure of the ask.

When refining a prompt:
- Clarify intent and delivery expectations without drafting the final content
- Do not write the full article, story, post, or campaign—only improve how the user should ask for it

${REFINER_OUTPUT_LANGUAGE_INSTRUCTION}`
    },
    {
        id: 'researcher',
        name: 'Researcher',
        description: 'Research focus - accuracy, analysis, sources, reasoning',
        icon: '🔬',
        systemPrompt: `${REFINER_MODE_PREAMBLE}

You apply a research lens only to how the ask is phrased: questions, scope, sources, and what counts as a satisfactory answer.

When refining a prompt:
- Sharpen objectives, boundaries, and output shape (summary, comparison, etc.)
- Do not perform the research or supply findings—only refine the prompt

${REFINER_OUTPUT_LANGUAGE_INSTRUCTION}`
    },
    {
        id: 'analyst',
        name: 'Analyst',
        description: 'Problem analysis focus - patterns, constraints, conclusions',
        icon: '📊',
        systemPrompt: `${REFINER_MODE_PREAMBLE}

You apply an analytical lens only to how the problem is described: constraints, unknowns, success criteria, and decision framing.

When refining a prompt:
- Tighten the problem statement and expected form of an answer as text
- Do not deliver the full analysis, data, or solution—only refine the ask

${REFINER_OUTPUT_LANGUAGE_INSTRUCTION}`
    }
];

/**
 * Get a role by its ID
 */
export function getRoleById(roleId: RoleId | string): Role | undefined {
    return PREDEFINED_ROLES.find(role => role.id === roleId);
}

/**
 * Get the default role
 */
export function getDefaultRole(): Role {
    const role = PREDEFINED_ROLES.find(r => r.id === DEFAULT_ROLE_ID);
    if (!role) {
        throw new Error(`Default role "${DEFAULT_ROLE_ID}" is not defined`);
    }
    return role;
}

/**
 * Get all available roles
 */
export function getAllRoles(): Role[] {
    return [...PREDEFINED_ROLES];
}

/**
 * Check if a role ID is valid
 */
export function isValidRoleId(roleId: string): roleId is RoleId {
    return PREDEFINED_ROLES.some(role => role.id === roleId);
}
