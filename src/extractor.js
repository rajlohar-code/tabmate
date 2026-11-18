/**
 * Function executed inside the active webpage DOM to extract clean textual content.
 * Must be self-contained as it is injected via chrome.scripting.executeScript.
 */
export function extractPageContentFromDOM() {
  try {
    const title = document.title || "Untitled Page";
    const url = window.location.href;
    const domain = window.location.hostname;

    // Elements to remove because they add noise or ads
    const selectorsToRemove = [
      "script",
      "style",
      "noscript",
      "iframe",
      "svg",
      "canvas",
      "nav",
      "footer",
      "header",
      "aside",
      "[role='navigation']",
      "[role='banner']",
      "[role='contentinfo']",
      "[role='complementary']",
      "[aria-hidden='true']",
      ".ad",
      ".ads",
      ".advertisement",
      "#cookie-banner",
      "#cookie-consent",
      ".cookie-notice",
      ".sidebar",
      ".share-buttons",
      ".social-share"
    ];

    // Find main content target or default to body
    const mainTarget =
      document.querySelector("article") ||
      document.querySelector("main") ||
      document.querySelector("[role='main']") ||
      document.querySelector("#content") ||
      document.querySelector(".content") ||
      document.body;

    if (!mainTarget) {
      return {
        success: false,
        error: "Unable to find page body or readable content.",
        title,
        url,
        domain,
        text: "",
        wordCount: 0,
        charCount: 0
      };
    }

    // Clone the node so we don't mutate the live webpage
    const clone = mainTarget.cloneNode(true);

    // Remove unwanted noise elements from clone
    selectorsToRemove.forEach((sel) => {
      const elements = clone.querySelectorAll(sel);
      elements.forEach((el) => el.remove());
    });

    // Extract text and normalize whitespace
    let extractedText = clone.innerText || clone.textContent || "";
    
    // Clean up excessive blank lines and whitespace
    extractedText = extractedText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n\n");

    const words = extractedText.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const charCount = extractedText.length;

    return {
      success: true,
      title,
      url,
      domain,
      text: extractedText,
      wordCount,
      charCount
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || "Failed to extract content",
      title: document.title || "Unknown",
      url: window.location.href,
      domain: window.location.hostname,
      text: "",
      wordCount: 0,
      charCount: 0
    };
  }
}

