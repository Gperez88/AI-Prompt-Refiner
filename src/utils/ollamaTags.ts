/**
 * Lists model tags installed in the local Ollama daemon (GET /api/tags).
 */
export async function listOllamaModelTags(baseUrl: string, signal?: AbortSignal): Promise<string[]> {
    const endpoint = (baseUrl || '').trim().replace(/\/$/, '');
    if (!endpoint) {
        return [];
    }
    try {
        const res = await fetch(`${endpoint}/api/tags`, { signal });
        if (!res.ok) {
            return [];
        }
        const data = (await res.json()) as { models?: Array<{ name?: string }> };
        const names = (Array.isArray(data.models) ? data.models : [])
            .map(m => (typeof m?.name === 'string' ? m.name : ''))
            .filter(Boolean);
        return [...new Set(names)].sort((a, b) => a.localeCompare(b));
    } catch {
        return [];
    }
}
