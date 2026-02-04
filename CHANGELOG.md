# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.2.0] - 2026-02-03

### Fixed

- **Groq Models**
  - Fixed decommissioned model error by updating to current Groq models
    - Replaced deprecated `llama3-70b-8192` with `llama-3.3-70b-versatile`
    - Removed decommissioned `mixtral-8x7b-32768` model
    - Updated UI ID from `llama3-70b-8192` to `groq-llama3-70b`
    - Added automatic fallback for deprecated model IDs
    - Updated display name to "Llama 3.3 70B"
  - Improved error handling with descriptive messages
    - Model decommissioned errors: Clear message with deprecation link
    - Invalid model errors: Guidance to select valid model
    - Authentication errors: Instructions to check API key
    - Rate limit errors: Wait time and usage dashboard link

- **Error Messages**
  - Improved error handling for Gemini provider with descriptive messages
    - Quota exceeded errors (429): Clear message with retry time and upgrade link
    - Authentication errors (401/403): Instructions to check/regenerate API key
    - Model not found errors (404): Guidance to select a different model
    - Errors now include helpful context instead of generic "Network error"

- **Gemini Models**
  - Fixed 404 Not Found error by upgrading to Gemini 2.0 models
    - Migrated from Gemini 1.5 (deprecated) to Gemini 2.0 (current)
    - API now uses: `gemini-2.0-flash` and `gemini-2.0-pro`
    - UI IDs remain as: `gemini-flash` and `gemini-pro`
    - Updated display names to "Gemini 2.0 Flash" and "Gemini 2.0 Pro"
    - All Gemini model references updated across the codebase
  - Gemini provider now works correctly with Google AI API v1beta

- **GitHub Models**
  - Implemented UI-to-API model ID mapping system
    - UI-friendly IDs (e.g., `github-llama-3.1-70b`) stored in config
    - API-specific IDs (e.g., `Meta-Llama-3.1-70B-Instruct`) used for API calls
    - Automatic migration of legacy model IDs on startup
    - Added `ModelMappings.ts` utility for centralized ID conversion
  - **Temporarily removed problematic GitHub models**:
    - LLaMA 3.1 70B (API name issues with GitHub)
    - Mistral Large (API name issues with GitHub)
    - These models will be re-added once exact API names are confirmed
  - GitHub provider now only shows working models: GPT-4o and GPT-4o Mini

### Infrastructure

- **Model Registry System**
  - Implemented centralized ModelRegistry service for managing supported AI models
  - Hybrid architecture: local JSON + API fetching + runtime validation
  - Automatic model validation before each API call
  - Telemetry system to track model availability (success/failure reporting)
  - Cache system with 24-hour TTL for performance

- **Automated Model Updates (CI/CD)**
  - GitHub Actions workflow runs weekly to check for model changes
  - Automatically creates Pull Request when models are updated
  - Auto-generates patch version tag (e.g., 1.1.0 → 1.1.1)
  - Pushes tag automatically when models change
  - Workflow file: `.github/workflows/update-models.yml`

- **Manual Model Refresh**
  - Added VS Code command: "Prompt Refiner: Refresh Supported Models"
  - Allows immediate manual update of model lists
  - Accessible via Command Palette (Ctrl+Shift+P)

- **Configuration**
  - Added `config/supported-models.json` for local model storage
  - Added `scripts/update-models.ts` for CLI model updates
  - Added npm script: `npm run update-models`

## [1.1.0] - 2026-02-02

### Added

- **Multi-Session Chat Support**
  - Create and manage multiple chat sessions
  - Switch between sessions without losing context
  - Session selector in chat panel with "View All" functionality
  - Export individual sessions as JSON
  - Archive old sessions to keep workspace organized
  - Auto-naming of sessions based on first message

- **Session Persistence**
  - Sessions are now persisted across VS Code reloads
  - Input text is saved when closing chat panel
  - Scroll position is restored when reopening

- **Improved Settings UI**
  - Fixed checkbox alignment in Strict Mode option
  - Fixed model dropdown not saving selected value
  - Settings now properly save and restore all values

- **i18n Support**
  - Added internationalization framework
  - View titles now support multiple languages
  - Package.nls.json for easy translation

### Changed

- **Providers**
  - **BREAKING:** Free providers (DuckDuckGo, HuggingFace public inference) temporarily disabled due to service unavailability
  - Default provider changed from "public" to "github"
  - All providers now require API key (except Ollama)
  - Updated provider list: GitHub, OpenAI, Gemini, Groq, HuggingFace, Ollama

- **UI Improvements**
  - Simplified message actions in chat (only Copy button with SVG icon)
  - Updated build.bat script text to English
  - Improved error handling for session management

### Fixed

- **Chat Session Management**
  - Fixed sessions not appearing after deletion until manual refresh
  - Fixed "Clear All Sessions" not updating the UI immediately
  - Fixed delete button in session list not working properly
  - Fixed session items remaining visible after being deleted

- **Settings**
  - Fixed API key being overwritten when changing only the model
  - Fixed Strict Mode checkbox not aligning properly
  - Fixed model dropdown reverting to GPT-4 after saving
  - Fixed settings not persisting checkbox state

- **Provider Issues**
  - Fixed fallback provider switching to disabled "public" provider
  - Updated error messages for disabled free providers

### Security

- API keys are now properly validated before saving
- Empty API keys no longer overwrite existing keys

## [1.0.0] - 2026-01-15

### Added

- Initial release of AI Prompt Refiner
- Support for 9 AI providers (9 providers including free options)
- Quick refine from editor selection
- Chat interface with history
- Template system (Code, Writing, Analysis, Strict, Custom)
- Settings panel for configuration
- Status bar integration
- i18n support foundation
- Export/Import functionality
- Session management (basic)

### Features

- **9 AI Providers:** Public (Free), GitHub, OpenAI, Gemini, Groq, HuggingFace, Ollama
- **Templates:** 5 built-in templates for different use cases
- **History:** Automatic saving of all prompts
- **UI:** Beautiful dark/light theme support
- **Multi-editor:** Works with VS Code, Cursor, Trae, Antigravity, Windsurf

---

## Release Notes Template

### [Version] - YYYY-MM-DD

#### Added
- New features

#### Changed
- Changes in existing functionality

#### Deprecated
- Soon-to-be removed features

#### Removed
- Now removed features

#### Fixed
- Bug fixes

#### Security
- Security improvements
