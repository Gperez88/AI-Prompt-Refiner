import { MODEL_MAPPINGS, type ModelMapping } from '../../utils/ModelMappings';
import type { CatalogModelRow } from './types';

/**
 * GitHub catalog uses ids like `openai/gpt-4o`; MODEL_MAPPINGS use inference ids like `gpt-4o`.
 * Only catalog entries that resolve to a known github mapping are listed, so getApiModelId always works.
 */
function mappingForCatalogModelId(catalogId: string): ModelMapping | undefined {
    return MODEL_MAPPINGS.find(
        m =>
            m.provider === 'github' &&
            (m.apiId === catalogId ||
                catalogId.endsWith(`/${m.apiId}`) ||
                catalogId.split('/').pop() === m.apiId),
    );
}

/**
 * Maps `GET https://models.github.ai/catalog/models` JSON (top-level array) to catalog rows.
 */
export function normalizeGitHubCatalogResponse(body: unknown): CatalogModelRow[] {
    if (!Array.isArray(body)) {
        return [];
    }

    const out: CatalogModelRow[] = [];
    const seen = new Set<string>();

    for (const raw of body) {
        if (!raw || typeof raw !== 'object') {
            continue;
        }
        const catalogId = (raw as { id?: string }).id;
        if (typeof catalogId !== 'string' || !catalogId) {
            continue;
        }

        const mapping = mappingForCatalogModelId(catalogId);
        if (!mapping) {
            continue;
        }
        if (seen.has(mapping.uiId)) {
            continue;
        }
        seen.add(mapping.uiId);

        const catalogName =
            typeof (raw as { name?: string }).name === 'string' ? (raw as { name: string }).name : mapping.name;
        const summary =
            typeof (raw as { summary?: string }).summary === 'string'
                ? (raw as { summary: string }).summary
                : '';

        out.push({
            id: mapping.uiId,
            name: catalogName,
            description: summary.length > 0 ? summary : `${mapping.name} (GitHub Models)`,
            isVerified: true,
        });
    }

    return out.sort((a, b) => a.name.localeCompare(b.name));
}
