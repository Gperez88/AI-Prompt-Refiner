/**
 * Rows produced by catalog mappers (structurally compatible with ModelInfo in ModelRegistry).
 */
export interface CatalogModelRow {
    id: string;
    name: string;
    description: string;
    isVerified: boolean;
    lastTested?: number;
}
