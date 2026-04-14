import { getModelName, getUiModelId } from '../../utils/ModelMappings';
import type { CatalogModelRow } from './types';

type GeminiListEntry = {
    name?: string;
    displayName?: string;
    description?: string;
    supportedGenerationMethods?: string[];
};

function shortModelName(fullName: string): string {
    return fullName.replace(/^models\//, '');
}

function supportsGenerateContent(entry: GeminiListEntry): boolean {
    const methods = entry.supportedGenerationMethods;
    if (Array.isArray(methods) && methods.length > 0) {
        return methods.includes('generateContent');
    }
    const n = entry.name ? shortModelName(entry.name) : '';
    return n.startsWith('gemini-');
}

/**
 * Maps `GET v1beta/models` JSON to catalog rows.
 * Only models that declare `generateContent` (when the field exists) are included; embeddings are skipped.
 * Known entries use UI ids from MODEL_MAPPINGS; others use the API short name (e.g. gemini-2.5-flash).
 */
export function normalizeGeminiModelsResponse(body: unknown): CatalogModelRow[] {
    if (!body || typeof body !== 'object') {
        return [];
    }
    const models = (body as { models?: unknown }).models;
    if (!Array.isArray(models)) {
        return [];
    }

    const out: CatalogModelRow[] = [];
    const seen = new Set<string>();

    for (const raw of models) {
        if (!raw || typeof raw !== 'object') {
            continue;
        }
        const entry = raw as GeminiListEntry;
        if (typeof entry.name !== 'string' || !entry.name) {
            continue;
        }
        if (!supportsGenerateContent(entry)) {
            continue;
        }

        const shortName = shortModelName(entry.name);
        if (shortName.toLowerCase().includes('embedding')) {
            continue;
        }

        const uiId = getUiModelId(shortName, 'gemini') ?? shortName;
        if (seen.has(uiId)) {
            continue;
        }
        seen.add(uiId);

        const display =
            typeof entry.displayName === 'string' && entry.displayName.length > 0
                ? entry.displayName
                : getModelName(uiId, 'gemini') ?? shortName;
        const desc =
            typeof entry.description === 'string' && entry.description.length > 0
                ? entry.description
                : 'Google Gemini model';

        out.push({
            id: uiId,
            name: display,
            description: desc,
            isVerified: !!getUiModelId(shortName, 'gemini'),
        });
    }

    return out.sort((a, b) => a.name.localeCompare(b.name));
}
