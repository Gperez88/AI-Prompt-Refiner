# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
