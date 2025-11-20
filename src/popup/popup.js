document.addEventListener("DOMContentLoaded", () => {
  chrome.runtime.sendMessage({ type: "GET_PARSED_POLICY" }, (res) => {
    const out = document.getElementById("output");

    if (res && res.parsed && res.parsed.policy.raw_text.length > 0) {
      out.textContent = JSON.stringify(res.parsed, null, 2);
    } else {
      out.textContent = "No parsed policy yet.";
    }
  });
});
