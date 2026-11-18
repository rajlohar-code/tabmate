// Chrome Extension Service Worker

// Enable side panel to open when the user clicks the extension action icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Error setting panel behavior:", error));

chrome.runtime.onInstalled.addListener(() => {
  console.log("TabMate extension installed successfully.");
  chrome.storage.local.get(["selectedModel"], (result) => {
    if (!result.selectedModel || result.selectedModel === "gemini-1.5-flash") {
      chrome.storage.local.set({ selectedModel: "gemini-2.5-flash" });
    }
  });
});

