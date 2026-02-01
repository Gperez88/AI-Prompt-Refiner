# Technical Design: VS Code AI Prompt Refiner

## 1. Overview

This extension helps developers refine raw prompts into clear, precise, and low-ambiguity instructions optimized for AI-powered IDEs (Cursor, VS Code AI, Copilot-like tools). It acts as a **deterministic middleware** between user intent and LLM input, prioritizing instruction-following, consistency, and minimal iteration.

Key principles:

- Prompt refinement, not chat
- Deterministic and strict output
- Provider-based, extensible architecture
- Free-first, paid-optional

---

## 2. Architecture

The extension follows a **Provider-based Architecture** with strict separation between:

- Prompt template (system instructions)
- User input (raw prompt)
- AI output (refined prompt only)

### 2.1 Core Components

- **Extension Controller**
  - Registers VS Code commands
  - Manages UI (command, diff view, sidebar)

- **PromptRefinerService**
  - Loads prompt templates (standard / strict)
  - Orchestrates refinement flow
  - Enforces output rules

- **ProviderManager**
  - Registers available AI providers
  - Handles provider selection
  - Persists configuration via Workspace / Global Settings

---

## 3. Provider System

### 3.1 Provider Interface (`IAIProvider`)

```ts
interface IAIProvider {
  readonly id: string;
  readonly name: string;

  isConfigured(): boolean;

  refine(
    userPrompt: string,
    systemTemplate: string,
    options?: { strict: boolean }
  ): Promise<string>;

  supportsStrictMode(): boolean;

  getMeta(): ProviderMeta;
}
```

Notes:

- **System template and user prompt must never be merged**
- User input is always sent as a `user` message
- Providers may adapt behavior based on `strict` mode support

---

## 4. Prompt Templates

Two first-class templates:

- **prompt_template.md**
  - Default refinement
  - Allows structured output

- **prompt_template_strict.md**
  - Output must contain only the refined prompt
  - No explanations, headers, or extra formatting

Strict mode is the default for IDE workflows.

---

## 5. Data Flow

1. User selects text or enters prompt
2. Extension loads system template (strict by default)
3. `PromptRefinerService` sends:
   - System → template
   - User → raw prompt
4. Active provider processes request
5. Output is validated and shown in UI
6. User explicitly applies or copies result

⚠️ The extension **never auto-replaces text by default**

---

## 6. Implementation Plan (Phased)

### Phase 1 – Core Skeleton (MVP 0.1)

Goal: Working refinement loop without external AI

- Scaffold VS Code extension (TypeScript)
- Implement `PromptRefinerService`
- Implement `MockProvider`
- Load prompt templates as static resources
- Command: `Prompt Refiner: Refine Selection`
- UI: Side-by-side diff view (no auto-apply)

---

### Phase 2 – Provider System + Free Model (MVP 0.5)

Goal: Real AI with minimal friction

- Implement `IAIProvider`
- Implement **Google Gemini 1.5 Flash Provider**
- Global settings:
  - Active provider
  - API key (SecretStorage)
  - Strict mode toggle
- Error handling (timeouts, missing keys)

Default behavior:

- Gemini 1.5 Flash
- Strict mode enabled

---

### Phase 3 – Paid Providers & UX (Beta 1.0)

Goal: Flexibility and trust

- Implement **OpenAI Provider** (GPT-4o-mini)
- Optional: Anthropic Claude (non-blocking)
- Model selection per provider
- Sidebar or WebView UI:
  - Input vs Output
  - Copy / Apply buttons
- Loading states and cancellation

---

### Phase 4 – Extensibility & Power Features

- Local LLM support (Ollama / LM Studio)
- Prompt history (local only)
- Re-run refinement with different providers
- Export refined prompt

---

## 7. Model Evaluation

### 7.1 Comparison Summary

| Model | Cost | Quality | Speed | Notes |
|------|------|--------|-------|------|
| Gemini 1.5 Flash | Free | High | Very Fast | Default recommendation |
| GPT-4o-mini | Paid (cheap) | Very High | Fast | Best paid option |
| Claude 3.5 Sonnet | Paid | Very High | Medium | Optional |
| Ollama (Llama 3 8B) | Local | Medium–High | Variable | Privacy-focused |

---

## 8. Recommendations

- **Default Provider:** Gemini 1.5 Flash
- **Default Mode:** Strict output
- **Paid Upgrade:** GPT-4o-mini
- **UI Principle:** User always confirms changes

---

## 9. Risks & Mitigations

- **Hallucinated constraints**
  - Mitigated by strict template rules

- **Latency / IDE blocking**
  - Timeouts + cancel support

- **User trust**
  - Diff view, no auto-apply

---

## 10. Non-Goals (v1)

- Prompt chaining
- Multi-step reasoning
- Automatic code generation
- Background agents
