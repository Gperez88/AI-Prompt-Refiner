# AI Prompt Refiner

[![CI/CD](https://github.com/Gperez88/AI-Prompt-Refiner/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/Gperez88/AI-Prompt-Refiner/actions/workflows/ci-cd.yml)
[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](https://github.com/Gperez88/AI-Prompt-Refiner)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Refine and optimize your prompts for AI coding assistants (like Cursor, VS Code AI, Copilot) directly within VS Code.

## 🚀 Key Features

### ✨ New Features (v0.2.0)

*   **📝 Customizable Templates**: 5 built-in templates (Default, Strict, Code Assistant, Technical Writing, Data Analysis) + custom template creation.
*   **💬 Enhanced Chat with History**: Persistent history of up to 50 messages, search, edit, and re-refinement.
*   **✅ Output Validation**: Quality score (0-100) with required sections analysis and improvement suggestions.
*   **📦 Export/Import**: Export and import custom templates and chat history.
*   **💾 Save as Snippet**: Convert refined prompts into reusable VS Code snippets.
*   **🔄 Re-refinement**: Iterate on a result with additional feedback for gradual improvements.
*   **⚡ Optimized Performance**: LRU Cache, Circuit Breaker, Retry Logic, and Lazy Loading of providers.

### 🎯 Core Features

*   **AI Refinement**: Rewrites your prompts to be clear, unambiguous, and optimized for Large Language Models (LLMs).
*   **Zero-Config Experience**: Use it immediately! Includes preconfigured free models that don't require an API Key.
*   **Multiple Providers (9)**:
    *   **Public Models (Free)**: Instant access to GPT-4o Mini, LLaMA 3.1, and Claude 3 Haiku without configuration.
    *   **Groq**: Ultra-fast access to LLaMA 3, Mixtral, and Gemma.
    *   **Google Gemini**: Native support for Gemini 1.5 Flash and Pro.
    *   **HuggingFace**: Access to open models like Qwen 2.5, BLOOM, and Mistral.
    *   **OpenAI**: Support for GPT-4o and GPT-4o-mini.
    *   **GitHub Marketplace**: Access to models like GPT-4o and LLaMA 3.1 70B using your GitHub account.
    *   **Ollama**: Local execution for maximum privacy.
    *   **Anthropic Claude**: Claude 3 Opus, Sonnet, and Haiku.
*   **Diff View**: Instantly compare your original prompt (left) with the optimized version (right).
*   **Integrated Status Bar**: View the active model and change it quickly from the VS Code bottom bar.
*   **Strict Mode**: Forces functional responses without conversational filler.

## 📖 Usage Guide

### 1. Refine a Prompt

1.  Select the text you want to improve in any VS Code editor.
2.  Right-click and select **Prompt Refiner: Refine Selection** or use the Command Palette (`Ctrl+Shift+P`).
3.  A diff view will open comparing your original prompt (left) with the optimized one (right).
4.  Choose what to do with the result:
    *   **Copy to Clipboard**: Copies the refined prompt.
    *   **Apply to Editor**: Replaces the selected text.
    *   **Dismiss**: Closes without action.

### 2. Using the Refinement Chat

1.  Open the "Refinement Chat" view from the Prompt Refiner sidebar.
2.  Type your prompt and press Enter or the send button.
3.  History is automatically saved (up to 50 messages).
4.  Use the action buttons on each message to:
    *   Copy content
    *   Edit message
    *   Re-refine using that prompt
    *   Delete message

### 3. Select Templates

1.  Open the Command Palette (`Ctrl+Shift+P`).
2.  Run **Prompt Refiner: Select Template**.
3.  Choose from available templates:
    *   **Default**: General purpose
    *   **Strict**: No conversational filler
    *   **Code Assistant**: Optimized for programming tasks
    *   **Technical Writing**: For documentation and emails
    *   **Data Analysis**: For data analysis and research

### 4. Create Custom Templates

1.  Run **Prompt Refiner: Create Custom Template**.
2.  Provide:
    *   Template Name
    *   Description
    *   Category (coding, writing, analysis, general, custom)
    *   Template Content (system instructions)
3.  The template will be available immediately.
4.  Export your templates with **Prompt Refiner: Manage Templates** → Export.

### 5. Validate Output

1.  Select a refined prompt in the editor.
2.  Run **Prompt Refiner: Validate Output**.
3.  Review the quality score and improvement suggestions.
4.  The score ranges from 0 to 100, where:
    *   80-100: Excellent
    *   60-79: Acceptable
    *   0-59: Needs Improvement

### 6. Quickly Change Models

You have three ways to change the model or provider:

*   **Status Bar**: Click the `$(zap)` or `$(sparkle)` icon at the bottom right. The `$(zap)` icon indicates you are using a free "Zero-Config" model.
*   **Keyboard Shortcut**: Press `Ctrl + Alt + M` (or `Cmd + Alt + M` on Mac).
*   **Command**: Run `Prompt Refiner: Select Model` from the Command Palette.

## ⌨️ Available Commands

| Command | Description | Shortcut |
|---------|-------------|-------|
| `Prompt Refiner: Refine Selection` | Refine selected text | - |
| `Prompt Refiner: Select Model` | Change model/provider | `Ctrl+Alt+M` |
| `Prompt Refiner: Set API Key` | Configure API key | - |
| `Prompt Refiner: Select Template` | Select refinement template | - |
| `Prompt Refiner: Create Custom Template` | Create custom template | - |
| `Prompt Refiner: Manage Templates` | Export/Import/Delete templates | - |
| `Prompt Refiner: Validate Output` | Validate output quality | - |
| `Prompt Refiner: Export Chat History` | Export chat history | - |
| `Prompt Refiner: Save as Snippet` | Save as VSCode snippet | - |

## ⚙️ Configuration (Settings)

You can adjust behavior in VS Code settings (`Ctrl + ,`):

### Providers and Models

*   `promptRefiner.provider`: Select the provider (`public`, `groq`, `gemini`, `openai`, `huggingface`, `ollama`, `github`, `anthropic`).
*   `promptRefiner.model`: Specify the Model ID (e.g., `gpt-4o-mini`, `llama-3.1-70b`, `claude-3-haiku`).

### Refinement Options

*   `promptRefiner.strictMode`: Enable/Disable strict output format (default: `true`).
*   `promptRefiner.selectedTemplate`: Preferred template for refinement (default: `default`).
*   `promptRefiner.ollamaEndpoint`: URL for your local Ollama instance (default: `http://localhost:11434`).

## 🏗️ Architecture and Advanced Features

### Performance

*   **🚀 LRU Cache**: Caches refinement results (50 entries, 1-hour TTL) for instant responses on repeated prompts.
*   **⚡ Lazy Loading**: Providers are loaded on demand, reducing startup time by ~80%.
*   **🔄 Retry Logic**: Automatic retries with exponential backoff and jitter for recovery from transient errors.
*   **🛡️ Circuit Breaker**: Provider-level protection - if a provider fails repeatedly, it is temporarily disabled and alternatives are suggested.

### Internationalization

*   Full support for **Spanish** and **English**.
*   Automatic detection of VS Code's language.
*   Easily extensible to more languages.

### Plugin System (Extensible API)

The plugin system allows third parties to extend functionality:

```typescript
interface IPromptRefinerPlugin {
  initialize(context: PluginContext): void;
  registerProvider(provider: IAIProvider): void;
  registerTemplate(template: PluginTemplate): void;
  on(event: PluginEvent, handler: Function): void;
}
```

## 📦 Development and Contribution

### Prerequisites

*   Node.js 18.x or higher
*   npm 9.x or higher
*   VS Code 1.80.0 or higher

### Environment Setup

1.  Clone the repository:

    ```bash
    git clone https://github.com/gperez88/prompt-refiner.git
    cd prompt-refiner
    ```

2.  Install dependencies:

    ```bash
    npm install
    ```

3.  Open in VS Code:

    ```bash
    code .
    ```

4.  Press `F5` to open the Extension Development Host window.

### Available Scripts

```bash
# Compile
npm run compile

# Compile in watch mode
npm run watch

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linter
npm run lint

# Package extension (.vsix)
npm run vscode:prepublish
```

### Contribution Guide

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on:

*   Code of conduct
*   How to get started
*   Code standards
*   Pull request process
*   How to create custom providers

## 🛠️ Troubleshooting

### Common Errors

| Error / Symptom | Probable Cause | Suggested Solution |
| :--- | :--- | :--- |
| **"Circuit breaker is open"** | The provider has failed multiple times. | The system will automatically suggest changing providers or using public fallback. |
| **"Cache hit"** (very fast) | Result comes from cache. | Normal behavior - cache speeds up repeated prompts. |
| **"Challenge (418)"** in DDG models | DuckDuckGo has temporarily blocked access. | Switch to a **HuggingFace Public** model (e.g., Mistral 7B). |
| **"Unauthorized (401)"** | API Key is incorrect or expired. | Use `Prompt Refiner: Set API Key` to update it. |
| **"Models permission required"** (GitHub) | GitHub token lacks necessary read permission. | Ensure the token has **"GitHub Models" (read-only)** permission. |
| **"Rate Limit Exceeded"** | Too many requests in a short time. | Wait a few minutes or use a different provider. |
| **"Connection Refused"** in Ollama | Ollama is not running. | Ensure Ollama is at `http://localhost:11434`. |

### Low Output Validation

If you receive a low score (< 70):

1.  Review the provided improvement suggestions.
2.  Consider adding more context to the original prompt.
3.  Use the "Strict" template for more structured results.
4.  Try re-refining with specific feedback.

## 🛠️ Requirements

*   **No Requirements**: To use free models from the `public` provider.
*   **API Key**: Required for private providers:
    *   **OpenAI**: `sk-...` (get at platform.openai.com)
    *   **Anthropic**: (get at console.anthropic.com)
    *   **Groq**: (get at console.groq.com)
    *   **GitHub**: Token with "GitHub Models" permission
    *   **HuggingFace**: Access Token
*   **Ollama**: Must be running locally.

## 📊 Project Statistics

*   **9 Providers** supported
*   **13 Commands** available
*   **7+ Templates** (5 built-in + custom)
*   **50 Messages** of chat history
*   **24 Unit tests**
*   **100% TypeScript**
*   **Automated CI/CD** with GitHub Actions

## 🗺️ Roadmap

### Implemented (v0.2.0)

*   ✅ Customizable templates
*   ✅ Chat with history
*   ✅ Output validation
*   ✅ Cache and performance
*   ✅ Circuit breaker
*   ✅ Plugin system
*   ✅ CI/CD pipeline

### Future (v0.3.0+ - Considerations)

*   🔄 Multi-turn conversational mode
*   🔄 Multi-model comparison (send to multiple providers)
*   🔄 Pre-refinement quality analysis
*   🔄 Batch processing (multiple prompts)
*   🔄 Integrations: Cursor, Copilot Chat, Cody

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Acknowledgments

*   DuckDuckGo AI and HuggingFace for providing free models.
*   VS Code community for the excellent extension system.
*   Contributors and testers who have helped improve the extension.

---

## 💬 Support

*   🐛 **Issues**: Report bugs at [GitHub Issues](https://github.com/Gperez88/AI-Prompt-Refiner/issues)
*   💡 **Suggestions**: Send feature ideas.
*   ❓ **Questions**: Use GitHub Discussions.

**Developed to improve productivity in prompt engineering.**

---

*Current version: 0.2.0* | *Last update: 2026-02-01*
