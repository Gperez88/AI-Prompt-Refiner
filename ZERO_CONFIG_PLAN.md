# Plan de Integración: Modelos Gratuitos "Zero-Config"

**Objetivo:** Permitir que `AI Prompt Refiner` sea funcional inmediatamente después de la instalación, proporcionando acceso a modelos de IA de alta calidad sin requerir que el usuario configure sus propias API Keys inicialmente.

## 1. Estrategia de Modelos "Out-of-the-box"

Para ofrecer una experiencia similar a OpenCode, integraremos proveedores que permitan el acceso gratuito mediante métodos públicos o rate-limits generosos.

### Modelos Seleccionados para el Pack Gratuito

* **Llama 3.1 (8B)**: Vía DuckDuckGo AI (No requiere Key, rápido).
* **GPT-4o-mini**: Vía DuckDuckGo AI (No requiere Key, ideal para refinamientos rápidos).
* **Qwen 2.5 (7B)**: Vía HuggingFace Public (Sin token para uso ligero).
* **Mistral Nemo**: Vía DuckDuckGo AI.
* **Phi-3 Mini**: Detección automática de Ollama local.

## 2. Cambios Arquitectónicos

### 2.1 Nuevo Proveedor: `PublicProvider`

Implementaremos un nuevo proveedor llamado `PublicProvider` que encapsulará las llamadas a APIs que no requieren autenticación por parte del usuario.

* **Endpoint Principal**: DuckDuckGo AI Bridge.
* **Respaldo**: HuggingFace Inference API (Public Tier).

### 2.2 Mejora de la Experiencia de Usuario (UX)

* **Auto-Configuración**: Al instalar la extensión, el proveedor predeterminado cambiará de `mock` a `public`.
* **Etiquetado en el Selector**: Los modelos en el comando `Select Model` mostrarán una etiqueta `(Gratis)` o `(No requiere Key)`.
* **Barra de Estado**: Mostrará un icono especial `$(zap)` para indicar que se está usando un modelo de acceso público.

## 3. Fases de Implementación

### Fase 5: Zero-Config Experience (Nueva)

1. **[x] Crear `PublicProvider.ts`**: Implementar el bridge para DuckDuckGo AI.
2. **[x] Actualizar `ProviderManager.ts`**: Registrar el nuevo proveedor y establecerlo como fallback si no hay keys configuradas.
3. **[x] Modificar `settingsCommands.ts`**: Actualizar la lista de modelos para incluir y priorizar los modelos "Zero-Config".
4. **[x] Refinar `ConfigurationManager.ts`**: Cambiar el valor predeterminado de `provider` de `mock` a `public`.

## 4. Beneficios

* **Fricción Cero**: Los usuarios pueden probar la extensión en segundos.
* **Privacidad**: Uso de modelos locales (Ollama) o proxies anónimos (DDG).
* **Competitividad**: Alinea la herramienta con los estándares actuales de extensiones de IA gratuitas.

---
*Este plan complementa el EXPANSION_PLAN.md original como una extensión de la Phase 4.*
