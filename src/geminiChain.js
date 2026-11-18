import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

/**
 * Creates and runs a LangChain Q&A chain on the extracted webpage content.
 * Supports streaming token-by-token output to a callback function.
 */
export async function streamPageAnswer({
  apiKey,
  modelName = "gemini-2.5-flash",
  pageTitle,
  pageUrl,
  pageContent,
  chatHistory = [],
  question,
  onToken,
  onComplete,
  onError
}) {
  try {
    if (!apiKey) {
      throw new Error("Gemini API Key is missing. Please add your API key in Settings.");
    }

    if (!pageContent || pageContent.trim().length === 0) {
      throw new Error("No webpage content available. Please open a webpage and click 'Load Current Page'.");
    }

    // 1. Initialize LangChain Google Generative AI Chat Model
    const model = new ChatGoogleGenerativeAI({
      model: modelName,
      apiKey: apiKey,
      temperature: 0.2, // Low temperature for high factual accuracy based on context
      maxOutputTokens: 2048,
    });

    // 2. Format conversation history into LangChain BaseMessages
    const formattedHistory = chatHistory.map((msg) => {
      if (msg.role === "user") {
        return new HumanMessage(msg.text);
      } else {
        return new AIMessage(msg.text);
      }
    });

    // 3. Create the LangChain Chat Prompt Template
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are TabMate, an intelligent AI assistant embedded in a Chrome browser extension.
Your objective is to answer the user's questions about the webpage currently loaded in their active browser tab.

WEBPAGE DETAILS:
- Title: {title}
- URL: {url}

FULL EXTRACTED WEBPAGE CONTENT:
\"\"\"
{context}
\"\"\"

RESPONSE INSTRUCTIONS:
1. Base your answers strictly and accurately on the provided webpage content above.
2. If the user asks something that is NOT mentioned on this page, clearly state: "This is not mentioned on the current page" and provide any helpful context if relevant.
3. Format your answers using clean, readable Markdown (headings, bullet points, bold key terms, code blocks when appropriate).
4. Be concise and direct, avoiding unnecessary fluff.`
      ],
      new MessagesPlaceholder("chat_history"),
      ["human", "{question}"]
    ]);

    // 4. Construct LCEL (LangChain Expression Language) Chain
    const chain = prompt.pipe(model).pipe(new StringOutputParser());

    // 5. Stream the response chunks in real-time
    const stream = await chain.stream({
      title: pageTitle || "Webpage",
      url: pageUrl || "",
      context: pageContent,
      chat_history: formattedHistory,
      question: question
    });

    let fullResponse = "";
    for await (const chunk of stream) {
      fullResponse += chunk;
      if (onToken) {
        onToken(chunk, fullResponse);
      }
    }

    if (onComplete) {
      onComplete(fullResponse);
    }
    return fullResponse;
  } catch (err) {
    console.error("LangChain Gemini execution error:", err);
    if (onError) {
      onError(err);
    } else {
      throw err;
    }
  }
}

