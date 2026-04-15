import { MODEL_MAPPINGS, getModelName, getUiModelId } from '../../utils/ModelMappings';
import type { CatalogModelRow } from './types';

function extractDataRows(body: unknown): Array<{ id?: string }> {
    if (!body || typeof body !== 'object') {
        return [];
    }
    const data = (body as { data?: unknown }).data;
    return Array.isArray(data) ? data : [];
}

function shouldIncludeGroqModel(id: string): boolean {
    const lower = id.toLowerCase();
    if (lower.includes('whisper')) {
        return false;
    }
    if (lower.includes('embed')) {
        return false;
    }
    return true;
}

/**
 * Maps OpenAI-compatible `GET .../v1/models` JSON to catalog rows.
 * - `openai`: only `gpt-*` models (same filter as before).
 * - `groq`: chat-oriented models; Whisper/embeddings excluded.
 * Models listed in MODEL_MAPPINGS use UI `id` so validateModel matches workspace config.
 * Unmapped API IDs are kept as `id` so they still validate and can be sent with getApiModelId fallback.
 */
export function normalizeOpenAICompatibleModels(
    body: unknown,
    provider: 'openai' | 'groq',
): CatalogModelRow[] {
    const rows = extractDataRows(body);
    const out: CatalogModelRow[] = [];
    const seen = new Set<string>();

    for (const row of rows) {
        if (typeof row?.id !== 'string' || !row.id) {
            continue;
        }
        const id = row.id;
        if (provider === 'openai' && !id.startsWith('gpt-')) {
            continue;
        }
        if (provider === 'groq' && !shouldIncludeGroqModel(id)) {
            continue;
        }

        const uiId = getUiModelId(id, provider) ?? id;
        if (seen.has(uiId)) {
            continue;
        }
        seen.add(uiId);

        const mapped = MODEL_MAPPINGS.some(
            m => m.provider === provider && (m.uiId === uiId || m.apiId === id),
        );

        out.push({
            id: uiId,
            name: getModelName(uiId, provider) ?? getModelName(id, provider) ?? id,
            description: provider === 'openai' ? 'OpenAI model' : 'Groq model',
            isVerified: mapped,
        });
    }

    return out.sort((a, b) => a.name.localeCompare(b.name));
}
