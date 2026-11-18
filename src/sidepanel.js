import { extractPageContentFromDOM } from "./extractor.js";
import { streamPageAnswer } from "./geminiChain.js";
import { marked } from "marked";

marked.setOptions({
  breaks: true,
  gfm: true
});

// State
let activePage = {
  title: "",
  url: "",
  domain: "",
  text: "",
  wordCount: 0,
  charCount: 0
};

let currentTabId = null;
let currentUrl = null;
let chatHistory = [];
let apiKey = "";
let selectedModel = "gemini-2.5-flash";
let isGenerating = false;

// DOM Elements
const modelSelect = document.getElementById("model-select");
const syncRoller = document.getElementById("sync-roller");
const newChatBtn = document.getElementById("new-chat-btn");
const settingsBtn = document.getElementById("settings-btn");
const emptyState = document.getElementById("empty-state");
const messagesThread = document.getElementById("messages-thread");
const chatViewport = document.getElementById("chat-viewport");
const suggestionGrid = document.getElementById("suggestion-grid");

const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

const settingsModal = document.getElementById("settings-modal");
const closeSettingsBtn = document.getElementById("close-settings-btn");
const apiKeyInput = document.getElementById("api-key-input");
const toggleKeyBtn = document.getElementById("toggle-key-visibility");
const saveSettingsBtn = document.getElementById("save-settings-btn");
const settingsStatus = document.getElementById("settings-status");

// 1. Initialization
async function init() {
  try {
    const data = await chrome.storage.local.get(["geminiApiKey", "selectedModel"]);
    if (data.geminiApiKey) {
      apiKey = data.geminiApiKey;
      apiKeyInput.value = apiKey;
    }
    if (data.selectedModel && data.selectedModel !== "gemini-1.5-flash") {
      selectedModel = data.selectedModel;
    } else {
      selectedModel = "gemini-2.5-flash";
      await chrome.storage.local.set({ selectedModel });
    }
    modelSelect.value = selectedModel;
  } catch (err) {
    console.warn("Storage read error:", err);
  }

  // Initial tab extraction
  await autoSyncCurrentTab();

  // Setup tab listeners for 100% AUTOMATIC RESYNC
  setupAutoSyncListeners();
}

// 2. Automatic Tab & Page Synchronizer
function setupAutoSyncListeners() {
  if (chrome.tabs && chrome.tabs.onActivated) {
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      currentTabId = activeInfo.tabId;
      await autoSyncCurrentTab();
    });
  }

  if (chrome.tabs && chrome.tabs.onUpdated) {
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete" || (changeInfo.url && changeInfo.url !== currentUrl)) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab && activeTab.id === tabId) {
          await autoSyncCurrentTab();
        }
      }
    });
  }
}

async function autoSyncCurrentTab() {
  // Show discreet spinner next to + button
  if (syncRoller) syncRoller.classList.remove("hidden");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      hideRoller();
      return;
    }

    currentTabId = tab.id;

    // Skip internal browser URLs
    if (
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("chrome-extension://") ||
      tab.url.startsWith("edge://") ||
      tab.url.startsWith("about:") ||
      tab.url.startsWith("view-source:")
    ) {
      currentUrl = tab.url;
      activePage = {
        title: tab.title || "Browser System Tab",
        url: tab.url,
        domain: "system",
        text: "",
        wordCount: 0
      };
      hideRoller();
      return;
    }

    const urlChanged = currentUrl && currentUrl !== tab.url;
    currentUrl = tab.url;

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContentFromDOM
    });

    if (results && results[0] && results[0].result) {
      const data = results[0].result;
      if (data.success && data.text.length > 0) {
        activePage = data;
        if (urlChanged && chatHistory.length > 0) {
          appendPageSwitchDivider(activePage.title);
        }
      }
    }
  } catch (err) {
    console.error("Auto-sync error:", err);
  } finally {
    // Hide spinner once syncing is completed
    setTimeout(() => {
      hideRoller();
    }, 300);
  }
}

function hideRoller() {
  if (syncRoller) syncRoller.classList.add("hidden");
}

function appendPageSwitchDivider(title) {
  const divider = document.createElement("div");
  divider.className = "page-switch-divider";
  divider.textContent = `Switched to: ${title}`;
  messagesThread.appendChild(divider);
  scrollToBottom();
}

// 3. Chat & Streaming Engine
async function submitQuestion(questionText) {
  const query = questionText.trim();
  if (!query || isGenerating) return;

  if (!apiKey) {
    settingsModal.classList.remove("hidden");
    settingsStatus.textContent = "Please enter your free Gemini API key to begin.";
    settingsStatus.className = "settings-feedback error";
    apiKeyInput.focus();
    return;
  }

  if (!activePage.text || activePage.text.length === 0) {
    appendMessage(
      "assistant",
      "⚠️ **Cannot read this page.** Please make sure you are on a standard webpage and refresh the page."
    );
    return;
  }

  // Hide empty state suggestions once chat starts
  if (emptyState) {
    emptyState.style.display = "none";
  }

  // Add User Message
  appendMessage("user", query);
  chatHistory.push({ role: "user", text: query });

  userInput.value = "";
  resizeTextarea();
  updateSendBtnState();

  // Create stream placeholder for Assistant
  const assistantBubble = createAssistantStreamBubble();
  const contentEl = assistantBubble.querySelector(".msg-content");
  isGenerating = true;
  sendBtn.disabled = true;

  try {
    await streamPageAnswer({
      apiKey,
      modelName: selectedModel,
      pageTitle: activePage.title,
      pageUrl: activePage.url,
      pageContent: activePage.text,
      chatHistory: chatHistory.slice(-8),
      question: query,
      onToken: (chunk, fullText) => {
        contentEl.innerHTML = marked.parse(fullText) + '<span class="stream-cursor"></span>';
        scrollToBottom();
      },
      onComplete: (fullText) => {
        contentEl.innerHTML = marked.parse(fullText);
        addCopyToolbar(assistantBubble, fullText);
        chatHistory.push({ role: "assistant", text: fullText });
        isGenerating = false;
        updateSendBtnState();
        scrollToBottom();
      },
      onError: (err) => {
        console.error("Chat error:", err);
        const errMsg = err.message || "Failed to generate answer.";
        contentEl.innerHTML = `
          <div style="color: #ea4335;">
            <strong>Error:</strong> ${escapeHtml(errMsg)}
            <br><small>Check your API key in Settings (⚙️).</small>
          </div>
        `;
        isGenerating = false;
        updateSendBtnState();
        scrollToBottom();
      }
    });
  } catch (err) {
    console.error("Submission failed:", err);
    isGenerating = false;
    updateSendBtnState();
  }
}

function appendMessage(role, text) {
  const item = document.createElement("div");
  item.className = `message-item ${role}`;

  const content = document.createElement("div");
  content.className = "msg-content";

  if (role === "user") {
    content.textContent = text;
  } else {
    content.innerHTML = marked.parse(text);
    addCopyToolbar(item, text);
  }

  item.appendChild(content);
  messagesThread.appendChild(item);
  scrollToBottom();
  return item;
}

function createAssistantStreamBubble() {
  const item = document.createElement("div");
  item.className = "message-item assistant";

  const content = document.createElement("div");
  content.className = "msg-content";
  content.innerHTML = '<span class="stream-cursor"></span>';

  item.appendChild(content);
  messagesThread.appendChild(item);
  scrollToBottom();
  return item;
}

function addCopyToolbar(messageItem, text) {
  const toolbar = document.createElement("div");
  toolbar.className = "msg-toolbar";

  const copyBtn = document.createElement("button");
  copyBtn.className = "action-chip";
  copyBtn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg> Copy
  `;
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(text);
    copyBtn.innerHTML = "✓ Copied";
    setTimeout(() => {
      copyBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg> Copy
      `;
    }, 2000);
  });

  toolbar.appendChild(copyBtn);
  messageItem.appendChild(toolbar);
}

function scrollToBottom() {
  chatViewport.scrollTop = chatViewport.scrollHeight;
}

function resizeTextarea() {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
}

function updateSendBtnState() {
  sendBtn.disabled = !userInput.value.trim() || isGenerating;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 4. Events
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  submitQuestion(userInput.value);
});

userInput.addEventListener("input", () => {
  resizeTextarea();
  updateSendBtnState();
});

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) {
      chatForm.requestSubmit();
    }
  }
});

// One-click suggestion cards
suggestionGrid.addEventListener("click", (e) => {
  const card = e.target.closest(".suggestion-card");
  if (card && card.dataset.prompt) {
    submitQuestion(card.dataset.prompt);
  }
});

// New Chat button
newChatBtn.addEventListener("click", () => {
  messagesThread.innerHTML = "";
  chatHistory = [];
  if (emptyState) emptyState.style.display = "flex";
  userInput.value = "";
  resizeTextarea();
  updateSendBtnState();
});

// Model select in top header
modelSelect.addEventListener("change", async (e) => {
  selectedModel = e.target.value;
  await chrome.storage.local.set({ selectedModel });
});

// Settings Modal
settingsBtn.addEventListener("click", () => {
  settingsModal.classList.remove("hidden");
  apiKeyInput.value = apiKey;
  settingsStatus.textContent = "";
});

closeSettingsBtn.addEventListener("click", () => {
  settingsModal.classList.add("hidden");
});

settingsModal.addEventListener("click", (e) => {
  if (e.target === settingsModal) settingsModal.classList.add("hidden");
});

toggleKeyBtn.addEventListener("click", () => {
  if (apiKeyInput.type === "password") {
    apiKeyInput.type = "text";
    toggleKeyBtn.textContent = "Hide";
  } else {
    apiKeyInput.type = "password";
    toggleKeyBtn.textContent = "Show";
  }
});

saveSettingsBtn.addEventListener("click", async () => {
  const newKey = apiKeyInput.value.trim();
  if (!newKey) {
    settingsStatus.textContent = "API Key cannot be empty.";
    settingsStatus.className = "settings-feedback error";
    return;
  }
  apiKey = newKey;
  await chrome.storage.local.set({ geminiApiKey: apiKey });
  settingsStatus.textContent = "Saved!";
  settingsStatus.className = "settings-feedback success";
  setTimeout(() => settingsModal.classList.add("hidden"), 800);
});

// Start
init();
