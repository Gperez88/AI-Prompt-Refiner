# AI Prompt Refiner

<p align="center">
  <img src="assets/icon.png" alt="AI Prompt Refiner Logo" width="120">
</p>

<p align="center">
  <strong>Transform your messy prompts into clear, effective AI instructions</strong>
</p>

<p align="center">
  <a href="#installation">
    <img src="https://img.shields.io/badge/Install-Now-blue?style=for-the-badge&logo=visualstudiocode" alt="Install">
  </a>
  <a href="#features">
    <img src="https://img.shields.io/badge/Features-Multi--Session-green?style=for-the-badge" alt="Features">
  </a>
</p>

---

## ✨ What It Does

**AI Prompt Refiner** takes your rough, unclear prompts and transforms them into well-structured, effective instructions that get better results from AI assistants like ChatGPT, Claude, or GitHub Copilot.

---

## 🚀 Installation

### VS Code / Cursor / Trae / Antigravity

1. Download the `.vsix` file from [Releases](https://github.com/gperez88/AI-Prompt-Refiner/releases)
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. Type "Install from VSIX" and select the file
4. Done! ✨

**Or install from marketplace:** (coming soon)

---

## 🎯 How to Use

### Method 1: Quick Refine (Fastest)

1. **Select** any text in your editor
2. **Right-click** → "Refine Selection"
3. **Get** a perfectly structured prompt instantly

### Method 2: Chat Interface with Multi-Session Support

1. Open the **"Chat"** panel from the sidebar
2. Create multiple sessions for different tasks
3. Switch between sessions without losing context
4. Type your rough prompt and get an optimized version
5. All your conversation history is preserved

### Method 3: Templates

Choose from smart templates based on your task:
- 💻 **Code** - Programming and development
- 📝 **Writing** - Documentation and content
- 📊 **Analysis** - Data and research tasks
- ⚡ **Strict** - No conversational filler
- 🎨 **Custom** - Create your own

---

## 💡 Why Use It?

### Save Time
- ⏱️ **10 seconds** to refine vs **10 minutes** rewriting manually
- 🎯 Get better results on the **first try**
- 🧠 Stop guessing what the AI needs

### Better Results
- 📋 Structured format that AI understands
- 🎨 Consistent quality across all prompts
- 🚀 More productive conversations with AI

### Multi-Session Chat
- 💬 Create separate sessions for different tasks
- 🔄 Switch between conversations seamlessly
- 💾 Never lose your chat history
- 📤 Export individual sessions

---

## 🌍 Works With

| Editor | Compatible |
|--------|------------|
| **VS Code** | ✅ Yes |
| **Cursor** | ✅ Yes |
| **Trae** | ✅ Yes |
| **Antigravity** | ✅ Yes |
| **Windsurf** | ✅ Yes |

---

## 🎨 Key Features

### 💬 AI-Powered Refinement
- Works with **6 AI providers** (GitHub, OpenAI, Gemini, Groq, HuggingFace, Ollama)
- Local AI support for privacy with Ollama
- Premium providers for best results

### 💾 Smart Multi-Session History
- Create and manage multiple chat sessions
- Never lose your best prompts
- Search through previous refinements
- Export your favorites
- Archive old sessions

### 🎭 Templates
- **Code:** Optimized for programming
- **Writing:** For documentation
- **Analysis:** For data tasks
- **Strict:** No fluff, just results

### 🎨 Beautiful UI
- Built-in chat interface with session management
- Session selector with recent sessions
- Dark & light themes
- i18n support (English/Spanish)

---

## 📖 Example Use Cases

### For Developers 💻

**Messy prompt:**
```
fix this bug where the button doesn't work
```

**Refined:**
```
[Context]
React login form, submit button

[Objective]
Debug and fix non-functional button

[Constraints]
- Maintain existing styling
- Preserve accessibility
- No breaking changes

[Expected Output]
Working button with proper event handlers
```

### For Writers 📝

**Messy prompt:**
```
write about AI
```

**Refined:**
```
[Context]
Technical blog, intermediate audience

[Objective]
Explain AI prompt engineering best practices

[Scope]
800-1000 words

[Constraints]
- Practical examples
- Common mistakes to avoid
- Actionable takeaways

[Expected Output]
Complete blog post with code examples
```

### For Researchers 🔬

**Messy prompt:**
```
analyze this data
```

**Refined:**
```
[Context]
Q1-Q4 2024 sales data, CSV format

[Objective]
Identify trends and anomalies

[Scope]
Time series analysis with forecasting

[Constraints]
- Statistical significance testing
- Executive summary format

[Expected Output]
Analysis report with charts and recommendations
```

---

## 🔧 Configuration

Click the **⚡ icon** in your status bar to:
- Choose AI provider
- Select different models
- Add API keys (required for all providers except Ollama)

### Available Providers

1. **GitHub Marketplace** - Free tier available with GitHub token
2. **OpenAI** - GPT-4o, GPT-4o Mini (requires API key)
3. **Google Gemini** - Gemini 1.5 Flash/Pro (requires API key)
4. **Groq** - Ultra-fast inference (requires API key)
5. **HuggingFace** - Open source models (requires API key)
6. **Ollama** - Local AI, no API key needed

**Note:** Free providers (DuckDuckGo, HuggingFace public inference) are temporarily disabled due to service unavailability.

---

## 🤔 FAQ

**Is it free?**
> Yes and no. GitHub Marketplace has a free tier. Other providers require API keys. Ollama is completely free and private.

**Does it work offline?**
> Yes! Use [Ollama](https://ollama.ai) with local AI models.

**Is my data private?**
> Absolutely. We don't store or see your data. Your prompts go directly to your chosen AI provider.

**Which languages are supported?**
> English and Spanish, with more coming soon!

**How do I get help?**
> [GitHub Issues](https://github.com/gperez88/AI-Prompt-Refiner/issues) for bugs, [Discussions](https://github.com/gperez88/AI-Prompt-Refiner/discussions) for questions.

---

## ⭐ Pro Tips

1. **Multi-Session Workflow** - Create separate sessions for different projects or topics
2. **Save Sessions** - Export important sessions as JSON files
3. **Use Templates** - Match the template to your task type for best results
4. **History** - All your prompts are saved automatically - search and reuse!
5. **Clear Sessions** - Archive or delete old sessions to keep your workspace organized

---

## 🛠️ Troubleshooting

**"Extension not showing"**
→ Reload VS Code: `Ctrl+Shift+P` → "Reload Window"

**"No provider configured"**
→ Click the ⚡ icon in status bar and select a provider, then add your API key

**"API Key not working"**
→ Make sure you've entered the correct API key format for your provider

**"Slow responses"**
→ Switch to a different provider or use local Ollama

---

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

---

## 🤝 Contributing

Found a bug? Have an idea? We welcome contributions!

- 🐛 [Report Bug](https://github.com/gperez88/AI-Prompt-Refiner/issues)
- 💡 [Request Feature](https://github.com/gperez88/AI-Prompt-Refiner/discussions)
- 📖 [See Code](https://github.com/gperez88/AI-Prompt-Refiner)

---

## 📜 License

MIT © [Gperez88](https://github.com/gperez88)

---

<p align="center">
  <strong>Made with ❤️ for better AI conversations</strong>
</p>

<p align="center">
  <a href="https://github.com/gperez88/AI-Prompt-Refiner">⭐ Star us on GitHub</a>
</p>
