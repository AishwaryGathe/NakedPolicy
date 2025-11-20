console.log("domExtractor injected on:", window.location.href);

function extractPolicyText() {
  let selectors = ["main", "article", "section"];
  let blocks = selectors
    .map(s => document.querySelector(s))
    .filter(Boolean)
    .map(el => el.innerText.trim())
    .filter(t => t.length > 100);

  let finalText = "";

  if (blocks.length > 0) {
    finalText = blocks.join("\n\n");
  } else {
    finalText = document.body.innerText || "";
  }

  chrome.runtime.sendMessage(
    {
      type: "SAVE_POLICY_TEXT",
      text: finalText
    },
    (res) => {
      console.log("domExtractor → SAVE_POLICY_TEXT response:", res);
    }
  );
}

window.addEventListener("load", () => {
  setTimeout(extractPolicyText, 800);
});
