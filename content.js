// Check if the current page is a privacy/terms/COC page
function isPolicyPage() {
  const url = window.location.href.toLowerCase();
  const title = document.title.toLowerCase();
  
  const keywords = [
    'privacy', 'policy', 'policies',
    'terms', 'conditions', 'service',
    'code of conduct', 'coc', 'conduct',
    'legal', 'agreement', 'gdpr',
    'cookies', 'data protection'
  ];
  
  return keywords.some(keyword => 
    url.includes(keyword) || title.includes(keyword)
  );
}

// Extract text content from the page
function extractPageContent() {
  // Remove script, style, and other non-content elements
  const clone = document.body.cloneNode(true);
  const unwanted = clone.querySelectorAll('script, style, nav, header, footer, iframe');
  unwanted.forEach(el => el.remove());
  
  return clone.innerText || clone.textContent;
}

// Show notification popup
function showNotification() {
  // Create notification element
  const notification = document.createElement('div');
  notification.id = 'privacy-analyzer-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    max-width: 320px;
    animation: slideIn 0.3s ease-out;
    cursor: pointer;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="font-size: 24px;">🔍</div>
      <div>
        <div style="font-weight: 600; margin-bottom: 4px;">Privacy Analysis Ready</div>
        <div style="font-size: 12px; opacity: 0.9;">Click extension icon to view summary</div>
      </div>
    </div>
  `;
  
  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
  
  // Remove on click
  notification.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "openPopup" });
    notification.remove();
  });
}

// Listen for manual analysis trigger
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "forceAnalyze") {
    const content = extractPageContent();
    if (content && content.length > 100) {
      chrome.runtime.sendMessage({
        action: "analyzePolicy",
        content: content,
        url: window.location.href
      }, response => {
        if (response && response.success) {
          showNotification();
        }
        sendResponse(response);
      });
    }
  }
  return true;
});

// Main execution
if (isPolicyPage()) {
  const content = extractPageContent();
  
  if (content && content.length > 100) {
    // Send content to background script for analysis
    chrome.runtime.sendMessage({
      action: "analyzePolicy",
      content: content,
      url: window.location.href
    }, response => {
      if (response && response.success) {
        showNotification();
      }
    });
  }
}