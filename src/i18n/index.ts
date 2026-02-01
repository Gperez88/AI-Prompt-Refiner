/**
 * Internationalization (i18n) support for Prompt Refiner
 * Provides translations for multiple languages
 */

export type Language = 'en' | 'es';

export interface Translations {
    [key: string]: string | Translations;
}

const translations: Record<Language, Translations> = {
    en: {
        // General
        extensionName: 'AI Prompt Refiner',
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        cancel: 'Cancel',
        save: 'Save',
        delete: 'Delete',
        edit: 'Edit',
        copy: 'Copy',
        clear: 'Clear',
        search: 'Search',
        
        // Commands
        commandRefineSelection: 'Prompt Refiner: Refine Selection',
        commandSelectModel: 'Prompt Refiner: Select Model',
        commandSetApiKey: 'Prompt Refiner: Set API Key',
        
        // Messages
        noActiveEditor: 'No active editor found.',
        noTextSelected: 'Please select the prompt text you want to refine.',
        refiningPrompt: 'Refining prompt...',
        refinementSuccess: 'Prompt refined successfully',
        refinementError: 'Error refining prompt',
        
        // Chat
        chatPlaceholder: 'Describe what you want to refine...',
        chatSend: 'Send',
        chatHistory: 'Chat History',
        noMessages: 'No messages yet',
        startTyping: 'Type a prompt below to start refining',
        messageCopied: 'Copied to clipboard',
        confirmDelete: 'Are you sure you want to delete this message?',
        confirmClear: 'Are you sure you want to clear all history?',
        
        // Settings
        settingsTitle: 'Configuration',
        provider: 'Provider',
        model: 'Model',
        apiKey: 'API Key / Token',
        apiKeyHint: 'Your API key is stored securely',
        ollamaEndpoint: 'Ollama Endpoint',
        strictMode: 'Strict Mode',
        strictModeHint: 'Enforces strict output format without conversational filler',
        settingsSaved: 'Settings saved successfully',
        
        // Errors
        errorNetwork: 'Network error. Please check your internet connection.',
        errorAuth: 'Authentication failed. Please check your API key.',
        errorRateLimit: 'Rate limit exceeded. Please wait and try again.',
        errorTimeout: 'Request timed out. Please try again.',
        errorInvalidInput: 'Invalid input. Please check your prompt.',
        errorProvider: 'Provider error. Please check the logs.',
        errorUnknown: 'An unexpected error occurred',
        
        // Rate limiting
        rateLimitWait: 'Please wait {seconds} seconds before sending another request.',
        
        // Validation
        validationEmpty: 'Prompt cannot be empty',
        validationTooLong: 'Prompt is too long ({count} characters). Maximum is {max}.',
        validationApiKeyEmpty: 'API key cannot be empty',
        validationApiKeyFormat: 'Invalid API key format for {provider}',
        
        // Diff View
        diffTitle: 'Original vs Refined Prompt',
        diffCopy: 'Copy to Clipboard',
        diffApply: 'Apply to Document',
        diffDismiss: 'Dismiss',
        
        // Status Bar
        statusTooltip: 'Prompt Refiner: Click to change model',
    },
    es: {
        // General
        extensionName: 'AI Prompt Refiner',
        loading: 'Cargando...',
        error: 'Error',
        success: 'Éxito',
        cancel: 'Cancelar',
        save: 'Guardar',
        delete: 'Eliminar',
        edit: 'Editar',
        copy: 'Copiar',
        clear: 'Limpiar',
        search: 'Buscar',
        
        // Commands
        commandRefineSelection: 'Prompt Refiner: Refinar Selección',
        commandSelectModel: 'Prompt Refiner: Seleccionar Modelo',
        commandSetApiKey: 'Prompt Refiner: Configurar API Key',
        
        // Messages
        noActiveEditor: 'No hay un editor activo.',
        noTextSelected: 'Por favor selecciona el texto del prompt que deseas refinar.',
        refiningPrompt: 'Refinando prompt...',
        refinementSuccess: 'Prompt refinado exitosamente',
        refinementError: 'Error al refinar el prompt',
        
        // Chat
        chatPlaceholder: 'Describe qué quieres refinar...',
        chatSend: 'Enviar',
        chatHistory: 'Historial de Chat',
        noMessages: 'Aún no hay mensajes',
        startTyping: 'Escribe un prompt abajo para comenzar',
        messageCopied: 'Copiado al portapapeles',
        confirmDelete: '¿Estás seguro de que deseas eliminar este mensaje?',
        confirmClear: '¿Estás seguro de que deseas limpiar todo el historial?',
        
        // Settings
        settingsTitle: 'Configuración',
        provider: 'Proveedor',
        model: 'Modelo',
        apiKey: 'API Key / Token',
        apiKeyHint: 'Tu API key se almacena de forma segura',
        ollamaEndpoint: 'Endpoint de Ollama',
        strictMode: 'Modo Estricto',
        strictModeHint: 'Fuerza formato de salida estricto sin relleno conversacional',
        settingsSaved: 'Configuración guardada correctamente',
        
        // Errors
        errorNetwork: 'Error de red. Por favor verifica tu conexión a internet.',
        errorAuth: 'Autenticación fallida. Por favor verifica tu API key.',
        errorRateLimit: 'Límite de peticiones excedido. Por favor espera e intenta de nuevo.',
        errorTimeout: 'Tiempo de espera agotado. Por favor intenta de nuevo.',
        errorInvalidInput: 'Entrada inválida. Por favor verifica tu prompt.',
        errorProvider: 'Error del proveedor. Por favor revisa los logs.',
        errorUnknown: 'Ocurrió un error inesperado',
        
        // Rate limiting
        rateLimitWait: 'Por favor espera {seconds} segundos antes de enviar otra petición.',
        
        // Validation
        validationEmpty: 'El prompt no puede estar vacío',
        validationTooLong: 'El prompt es muy largo ({count} caracteres). Máximo es {max}.',
        validationApiKeyEmpty: 'La API key no puede estar vacía',
        validationApiKeyFormat: 'Formato de API key inválido para {provider}',
        
        // Diff View
        diffTitle: 'Original vs Prompt Refinado',
        diffCopy: 'Copiar al Portapapeles',
        diffApply: 'Aplicar al Documento',
        diffDismiss: 'Descartar',
        
        // Status Bar
        statusTooltip: 'Prompt Refiner: Click para cambiar modelo',
    }
};

/**
 * Get the current language based on VSCode's locale
 */
export function getCurrentLanguage(): Language {
    // Try to get VSCode's language setting
    const vscodeLang = process.env.VSCODE_NLS_CONFIG;
    if (vscodeLang) {
        try {
            const config = JSON.parse(vscodeLang);
            const locale = config.locale as string;
            if (locale && (locale.startsWith('es') || locale === 'es')) {
                return 'es';
            }
        } catch {
            // Fall back to English
        }
    }
    return 'en';
}

/**
 * Get a translation string
 * @param key The translation key (dot notation supported)
 * @param replacements Optional replacements for template variables
 */
export function t(key: string, replacements?: Record<string, string>): string {
    const lang = getCurrentLanguage();
    const keys = key.split('.');
    
    let value: any = translations[lang];
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            // Fallback to English
            value = translations['en'];
            for (const k2 of keys) {
                if (value && typeof value === 'object' && k2 in value) {
                    value = value[k2];
                } else {
                    return key; // Return the key if not found
                }
            }
            break;
        }
    }
    
    if (typeof value !== 'string') {
        return key;
    }
    
    // Apply replacements
    if (replacements) {
        return value.replace(/\{(\w+)\}/g, (match, key) => {
            return replacements[key] !== undefined ? replacements[key] : match;
        });
    }
    
    return value;
}

/**
 * Format a template string with replacements
 */
export function format(template: string, replacements: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
        return replacements[key] !== undefined ? String(replacements[key]) : match;
    });
}
