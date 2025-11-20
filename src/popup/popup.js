document.addEventListener("DOMContentLoaded", () => {
  console.log("Popup loaded");

  chrome.runtime.sendMessage({ type: "GET_PARSED_POLICY" }, (res) => {
    console.log("Popup response:", res);

    const out = document.getElementById("output");
    if (!res || !res.parsed) return out.textContent = "{}";

    out.textContent = JSON.stringify(res.parsed, null, 2);
  });
});
