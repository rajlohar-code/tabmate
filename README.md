# TabMate - Real-time AI Webpage Assistant

**TabMate** is a modern, lightweight Manifest V3 Chrome Extension powered by **LangChain.js** and **Google Gemini** that allows you to chat with any active webpage in real time.

---

## 🌟 Key Features

- **Automatic Real-Time Sync**: Automatically reads and extracts clean page content as you browse and switch tabs. No buttons to click.
- **Powered by LangChain.js**: Built with `@langchain/google-genai` and conversational history support.
- **Discreet Sync Indicator**: Shows a sleek, subtle roller next to the `+` button only while syncing, and automatically hides when ready.
- **Sleek Minimalist Dark UI**: Professional dark-mode design inspired by Gemini and ChatGPT sidebars.
- **Token-by-Token Streaming**: Responses stream in real-time with Markdown support and one-click copy.
- **Model Selector**: Switch effortlessly between `Gemini 2.5 Flash`, `Gemini 2.5 Pro`, and `Gemini Flash Lite`.

---

## ⚡ Quick Install (No coding required)

1. Download **`tabmate-extension.zip`** and unzip the folder.
2. In Google Chrome, go to:
   ```text
   chrome://extensions
   ```
3. Turn **ON** the **"Developer mode"** toggle (top right corner).
4. Click **"Load unpacked"** (top left corner) and select the unzipped `dist` folder.
5. Pin **TabMate** to your Chrome toolbar and click the icon to open the side panel!

---

## 🛠️ Development & Building

```bash
# Install dependencies
npm install

# Build extension into dist/
npm run build

# Watch mode for live development
npm run watch
```
