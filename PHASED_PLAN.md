# Detailed Phased Implementation Plan: VS Code Prompt Refiner

This document breaks down the [TECHNICAL_PLAN.md](./TECHNICAL_PLAN.md) into actionable engineering tasks.

---

## Phase 1: Core Skeleton & Architecture (MVP 0.1)

**Objective:** deliver a working extension that "refines" text using a mock provider. No external API calls yet.

### 1.1 Project Scaffolding

- [x] Initialize VS Code Extension (`yo code` or manual `package.json`).
- [x] Configure `clean-architecture` folder structure:

  ```text
  src/
    ├── commands/       # VS Code Commands
    ├── providers/      # AI Implementations
    ├── services/       # Core Logic
    ├── templates/      # System Prompts
    └── extension.ts    # Entry Point
  ```

- [x] Add `prompt_template.md` and `prompt_template_strict.md` to `src/templates/` (copying from project root).

### 1.2 Core Interfaces & Mock

- [x] Define `IAIProvider` interface in `src/providers/IAIProvider.ts`.
- [x] Implement `MockProvider` in `src/providers/MockProvider.ts`.
  - *Behavior:* Returns a fixed string "Refined: [User Input]" to simulate latency and success.

### 1.3 Service Layer

- [x] Implement `PromptRefinerService` singleton.
  - Method: `refine(text: string): Promise<string>`
  - Logic: Loads template -> Calls Active Provider -> Returns result.

### 1.4 Basic UX (Command & Output)

- [x] Register command `promptRefiner.refineSelection`.
- [x] Implement `RefineSelection` handler:
  1. Get active text editor selection.
  2. Call Service.
  3. **Output:** For Phase 1, simply show a `vscode.window.showInformationMessage` with the result OR open a new untitled file with the refined content.

---

## Phase 2: Real AI & Configuration (MVP 0.5)

**Objective:** Connect to Google Gemini (Free Tier) and handle user configuration.

### 2.1 Configuration System

- [x] Update `package.json` contributes configuration:
  - `promptRefiner.provider` (enum: "gemini", "mock", "openai")
  - `promptRefiner.apiKey` (handled via SecretStorage, not plain settings)
  - `promptRefiner.model` (string, default "gemini-1.5-flash")
  - `promptRefiner.strictMode` (boolean, default true)
- [x] Create `ConfigurationManager` wrapper to read/write settings safely.

### 2.2 Google Gemini Provider

- [x] Install `@google/generative-ai` SDK.
- [x] Implement `GeminiProvider` implementing `IAIProvider`.
- [x] Map `refine` arguments to Gemini `generateContent` call.
- [x] Error Handling:
  - Invalid Key -> Prompt user to enter key.
  - Network Error -> Show localized error toast.

### 2.3 Provider Factory

- [x] Implement `ProviderManager`:
  - Switches between `MockProvider` and `GeminiProvider` based on configuration.

---

## Phase 3: Advanced UX & Paid Providers (Beta 1.0)

**Objective:** Professional-grade UX and optional paid models.

### 3.1 Side-by-Side Diff View

- [x] Replace simple output with **Diff View**.
  - Use `vscode.commands.executeCommand('vscode.diff', ...)`
  - Left side: Original Prompt (Read-only/Temp).
  - Right side: Refined Prompt (Editable).
- [x] Add "Accept" button/codelens (optional, might need a custom TreeView or Webview if standard diff is too limited, but standard diff is easiest for v1).

### 3.2 OpenAI Provider

- [x] Implement `OpenAIProvider` using `openai` npm package.
- [x] Support models: `gpt-4o`, `gpt-4o-mini`.

### 3.3 Strict Mode Logic

- [x] Update `PromptRefinerService` to load `prompt_template.md` (Standard) vs `prompt_template_strict.md` (Strict) based on settings.

---

## Phase 4: Polish & Extensibility (v1.1+)

**Objective:** Community features and local privacy.

### 4.1 Local LLM (Ollama)

- [ ] Implement `OllamaProvider`.
- [ ] Logic to hit `http://localhost:11434/api/generate`.
- [ ] Allow custom base URL in settings.

### 4.2 History & Telemetry

- [ ] (Optional) Store last 10 refinements in `globalState`.
- [ ] Add "Rerun last refinement" command.

---

## Timeline Estimate

| Phase | Est. Effort | Key Deliverable |
| :--- | :--- | :--- |
| **Phase 1** | 1-2 Days | Working Extension "Shell" (Mocked) |
| **Phase 2** | 2-3 Days | Real Gemini Integration + Settings |
| **Phase 3** | 3-4 Days | Diff UI + OpenAI + Polish |
| **Phase 4** | Future | Local LLM support |
