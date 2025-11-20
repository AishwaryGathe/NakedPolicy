import { parsePolicy } from "./parser.js";
import { SCHEMA_TEMPLATE } from "../schema.js";

let extractedPolicyText = "";
let parsedPolicy = {};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("Background received:", msg);

  if (msg.type === "FOUND_POLICY_LINKS") {
    console.log("Links found:", msg.links);
  }

  if (msg.type === "SAVE_POLICY_TEXT") {
    extractedPolicyText = msg.text;

    parsedPolicy = {
      ...SCHEMA_TEMPLATE,
      site: {
        url: sender?.url || "",
        timestamp: Date.now()
      },
      policy: {
        ...SCHEMA_TEMPLATE.policy,
        raw_text: msg.text,
        ...parsePolicy(msg.text)
      }
    };

    console.log("Parsed:", parsedPolicy);
    sendResponse({ saved: true });
  }

  if (msg.type === "GET_PARSED_POLICY") {
    sendResponse({ parsed: parsedPolicy });
  }
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete" && tab.url.match(/privacy|policy|terms|cookie/i)) {
    console.log("Injecting domExtractor.js into", tab.url);
    chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/content/domExtractor.js"]
    });
  }
});
