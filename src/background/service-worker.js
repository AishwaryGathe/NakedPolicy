import { parsePolicy } from "./parser.js";
import { SCHEMA_TEMPLATE } from "../schema.js";

let extractedPolicyText = "";
let parsedPolicy = {};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SAVE_POLICY_TEXT") {
    extractedPolicyText = msg.text;

    parsedPolicy = {
      ...SCHEMA_TEMPLATE,
      site: {
        url: sender.url || "",
        timestamp: Date.now()
      },
      policy: {
        ...SCHEMA_TEMPLATE.policy,
        raw_text: msg.text,
        ...parsePolicy(msg.text)
      }
    };

    sendResponse({ saved: true });
  }

  if (msg.type === "GET_PARSED_POLICY") {
    sendResponse({ parsed: parsedPolicy });
  }
});
