# Expansion Plan: Multi-Model Free Tier Support

**Objective:** Update `prompt-refiner` to support a wide range of free and open-source models as requested (LLaMA 3, Gemma, Mistral, etc.).

**Strategy:** Instead of connecting to each model individually, we will use **Model Hub Providers** that offer free tiers for these specific models.

## 1. Provider Mapping

| User Requested Model | Best Free/Cheap Provider |
| :--- | :--- |
| **Google Gemini 1.5 Flash/Pro** | **Google AI (Native)** (Existing) |
| **LLaMA 3 (8B, 70B)** | **Groq** (Free Beta, Ultra Fast) |
| **Gemma (2B, 7B)** | **Groq** or **Google AI** |
| **Mistral 7B / Mixtral 8x7B** | **Groq** or **Mistral AI** |
| **Falcon, BLOOM, Vicuna** | **HuggingFace Inference API** (Free Tier) |
| **Local Models** | **Ollama** (Existing) |

## 2. Architecture Changes

### 2.1 Configuration Overhaul

The current `provider` enum is too simple. We need a way to select a Provider AND a Model.

* **New Config**: `promptRefiner.modelSelection` (Object or simplified flow).
* **Settings UX**:
  * `Provider`: [Google, Groq, HuggingFace, OpenAI, Ollama]
  * `Model`: Dropdown/String based on provider.

### 2.2 New Providers Implementation

#### A. Groq Provider (`GroqProvider`)

* **Why?**: Best way to run LLaMA 3, Mixtral, and Gemma for free/fast.
* **Models**: `llama3-8b-8192`, `llama3-70b-8192`, `mixtral-8x7b-32768`, `gemma-7b-it`.
* **Auth**: Requires Groq API Key.

#### B. HuggingFace Provider (`HFProvider`)

* **Why?**: Access to the "long tail" of models (BLOOM, Falcon, Vicuna).
* **Models**: mapped to `bigscience/bloom`, `tiiuae/falcon-7b`, etc.
* **Auth**: HF Access Token.

## 3. Implementation Phases

### Phase 1: Groq Integration (High Impact)

* [x] Register `GroqProvider`.
* [x] Add `settingsCommand` logic for Groq API Key.
* [x] Update `package.json` with Groq models enum.

### Phase 2: Refined Google Provider

* [x] Update `GeminiProvider` to explicitly support/list `gemini-1.5-flash` and `gemini-1.5-pro` in the package configuration menus.

### Phase 3: HuggingFace Integration

* [x] Register `HFProvider`.
* [x] Map standard requested models (BLOOM, Falcon) to HF endpoints.

### Phase 4: Unified Configuration UI
*   [x] A "Pick Model" command (`Prompt Refiner: Select Model`) to allow swapping without going deep into JSON settings.
*   [x] Status Bar integration for quick model visibility and switching.
*   [x] Keybinding (`Ctrl+Alt+M`) for rapid model selection.

### Phase 5: Zero-Config Experience
*   [x] Implementation of `PublicProvider` for free models (DuckDuckGo/HF).
*   [x] Set `public` as default provider for zero-friction installation.
*   [x] Prioritized free models in the selection menu.

## 4. Proposed `package.json` Model List

We will expose these pre-sets in VS Code settings:

* `google/gemini-1.5-flash`
* `google/gemini-1.5-pro`
* `groq/llama3-8b-8192`
* `groq/llama3-70b-8192`
* `groq/gemma-7b-it`
* `groq/mixtral-8x7b-32768`
* `huggingface/bigscience/bloom`
* `huggingface/tiiuae/falcon-7b-instruct`
* `ollama/custom`

This "Provider/Model" string format will make internal routing easier.
