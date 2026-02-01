# AI Prompt Refiner

Refina y optimiza tus prompts para asistentes de codificación de IA (como Cursor, VS Code AI, Copilot) directamente dentro de VS Code.

## 🚀 Características

* **Refinamiento por IA**: Reescribe tus prompts para que sean claros, sin ambigüedades y optimizados para modelos de lenguaje (LLMs).
* **Experiencia Zero-Config**: ¡Úsalo inmediatamente! Incluye modelos gratuitos preconfigurados que no requieren API Key.
* **Múltiples Proveedores**:
  * **Modelos Públicos (Gratis)**: Acceso instantáneo a GPT-4o Mini, LLaMA 3.1 y Claude 3 Haiku sin configuración.
  * **Groq**: Acceso ultra rápido a LLaMA 3, Mixtral y Gemma.
  * **Google Gemini**: Soporte nativo para Gemini 1.5 Flash y Pro.
  * **HuggingFace**: Acceso a modelos abiertos como Qwen 2.5, BLOOM y Mistral.
  * **OpenAI**: Soporte para GPT-4o y GPT-4o-mini.
  * **GitHub Marketplace**: Acceso a modelos como GPT-4o y LLaMA 3.1 70B usando tu cuenta de GitHub.
  * **Ollama**: Ejecución local para máxima privacidad.
* **Vista de Diferencias (Diff View)**: Compara instantáneamente tu prompt original con la versión refinada.
* **Barra de Estado Integradada**: Visualiza el modelo activo y cámbialo rápidamente desde la barra inferior de VS Code.
* **Modo Estricto**: Fuerza respuestas funcionales sin rellenos conversacionales.

## 📖 Guía de Uso

### 1. Refinar un Prompt

1. Selecciona el texto que deseas mejorar en cualquier editor de VS Code.
2. Haz clic derecho y selecciona **Prompt Refiner: Refine Selection** o usa la paleta de comandos (`Ctrl+Shift+P`).
3. Se abrirá una vista de diferencias comparando tu prompt original (izquierda) con el optimizado (derecha).

### 2. Cambiar de Modelo Rápidamente

Tienes tres formas de cambiar el modelo o proveedor:

* **Barra de Estado**: Haz clic en el icono `$(zap)` o `$(sparkle)` en la parte inferior derecha. El icono `$(zap)` indica que estás usando un modelo gratuito "Zero-Config".
* **Atajo de Teclado**: Presiona `Ctrl + Alt + M` (o `Cmd + Alt + M` en Mac).
* **Comando**: Ejecuta `Prompt Refiner: Select Model` desde la paleta de comandos.

### 3. Configuración Inicial

* **Modelos Públicos**: No requieren configuración. La extensión está lista para usar desde el primer segundo.
* **Proveedores Cloud**: La primera vez que uses un proveedor privado (como Groq, Gemini o OpenAI), la extensión te solicitará tu **API Key**, que se guardará de forma segura.

## ⚙️ Configuración (Settings)

Puedes ajustar el comportamiento en los ajustes de VS Code (`Ctrl + ,`):

* `promptRefiner.provider`: Selecciona el proveedor (`public`, `groq`, `gemini`, `openai`, `huggingface`, `ollama`).
* `promptRefiner.model`: Especifica el ID del modelo (ej. `gpt-4o-mini`, `llama-3.1-70b`).
* `promptRefiner.strictMode`: Activa/Desactiva el formato de salida estricto (predeterminado: `true`).
* `promptRefiner.ollamaEndpoint`: URL para tu instancia local de Ollama (predeterminado: `http://localhost:11434`).

## 📦 Desarrollo y Compilación

Si deseas compilar la extensión manualmente y generar el archivo `.vsix`:

1.  Ejecuta el script automatizado:
    ```bash
    .\build.bat
    ```
2.  El script instalará las dependencias, compilará el código TypeScript y generará el archivo `prompt-refiner-x.x.x.vsix` en la raíz del proyecto.

## 🛠️ Solución de Problemas (Troubleshooting)

Si encuentras errores durante el refinamiento, consulta estas soluciones comunes:

| Error / Síntoma | Causa Probable | Solución Sugerida |
| :--- | :--- | :--- |
| **"Challenge (418)"** en modelos DDG | DuckDuckGo ha bloqueado temporalmente el acceso automatizado. | Cambia a un modelo de **HuggingFace Public** (ej. Mistral 7B) en la selección de modelos. Son más estables. |
| **"VQD missing"** o **"400 Bad Request"** | Cambio en la API pública o token de sesión expirado. | Intenta de nuevo. Si persiste, cambia a un modelo de HuggingFace o usa un proveedor con API Key. |
| **"Unauthorized (401)"** | La API Key configurada es incorrecta o ha expirado. | Usa el comando `Prompt Refiner: Set API Key` para actualizar tu clave para ese proveedor. |
| **"Models permission required"** (GitHub) | El token de GitHub no tiene el permiso de lectura necesario. | Asegúrate de que el token tenga el permiso **"GitHub Models" (read-only)**. |
| **"Connection Refused"** en Ollama | Ollama no está corriendo o el endpoint es incorrecto. | Asegúrate de que Ollama esté abierto y ejecutándose en `http://localhost:11434`. |
| **"Rate Limit Exceeded"** | Has realizado demasiadas peticiones en poco tiempo. | Espera unos minutos. Los modelos gratuitos tienen límites de uso más estrictos. |
| **Resultado "ejecuta" el prompt** (en Ollama) | El modelo local confunde el refinamiento con una orden directa. | Asegúrate de tener el modelo `llama3` o superior. Hemos optimizado la extensión para evitar esto, pero si persiste, intenta ser más específico en tu prompt original. |

> **Tip de Estabilidad**: Para una experiencia gratuita más predecible y sin bloqueos, utiliza los modelos marcados como **(HF Public)** en el menú de selección de modelos.

> **Tip para Ollama**: Si usas modelos locales pequeños (como Phi-3 o Gemma), es posible que no sigan el template perfectamente. Recomendamos `llama3` o `mistral` para mejores resultados de refinamiento.

## 🛠️ Requisitos

* **Sin Requisitos**: Para usar los modelos gratuitos del proveedor `public`.
* **API Key**: Necesaria solo para proveedores privados (Groq, Gemini, HF, OpenAI).
* **Ollama**: Debe estar ejecutándose localmente si prefieres usar el proveedor local.

---
*Desarrollado para mejorar la productividad en ingeniería de prompts.*
