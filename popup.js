// Check if API key is set
chrome.storage.sync.get(['claudeApiKey', 'skipApiSetup'], async (result) => {
  if (!result.claudeApiKey && !result.skipApiSetup) {
    showApiSetup();
    return;
  }
  
  loadAnalysis();
});

function showApiSetup() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="api-setup">
      <h3>🔑 Optional: Claude API Key</h3>
      <p style="font-size: 13px; margin-bottom: 12px; opacity: 0.9;">
        For AI-powered analysis, add your Claude API key. Or skip to use rule-based analysis.
      </p>
      <input type="password" id="apiKeyInput" placeholder="sk-ant-...">
      <div>
        <button id="saveApiKey">Save & Analyze</button>
        <button class="skip" id="skipSetup">Skip (Use Rules)</button>
      </div>
      <p style="font-size: 11px; margin-top: 12px; opacity: 0.7;">
        Get your API key from <a href="https://console.anthropic.com" target="_blank" style="color: white;">console.anthropic.com</a>
      </p>
    </div>
  `;
  
  document.getElementById('saveApiKey').addEventListener('click', () => {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    if (apiKey) {
      chrome.storage.sync.set({ claudeApiKey: apiKey }, () => {
        loadAnalysis();
      });
    }
  });
  
  document.getElementById('skipSetup').addEventListener('click', () => {
    chrome.storage.sync.set({ skipApiSetup: true }, () => {
      loadAnalysis();
    });
  });
}

function loadAnalysis() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentUrl = tabs[0].url;
    
    // Load stored analysis
    chrome.storage.local.get([currentUrl], (result) => {
      const data = result[currentUrl];
      
      if (data && data.analysis) {
        displayAnalysis(data.analysis);
      } else {
        displayNoAnalysis();
      }
    });
  });
}

function displayAnalysis(analysis) {
  const content = document.getElementById('content');
  
  // Extract rating from third-party sharing line
  const ratingMatch = analysis.thirdPartySharing.match(/(\d+)\/10/);
  const rating = ratingMatch ? parseInt(ratingMatch[1]) : 5;
  
  let ratingClass = 'low';
  if (rating >= 7) ratingClass = 'high';
  else if (rating >= 4) ratingClass = 'medium';
  
  const methodBadge = analysis.method === 'api' ? 
    '<span class="method-badge">AI Powered</span>' : 
    '<span class="method-badge">Rule Based</span>';
  
  content.innerHTML = `
    <div class="analysis-card">
      <h3>📊 Data Collected</h3>
      <p>${formatLine(analysis.dataCollected)}</p>
    </div>
    
    <div class="analysis-card">
      <h3>🎯 How It's Used</h3>
      <p>${formatLine(analysis.dataUsage)}</p>
    </div>
    
    <div class="analysis-card">
      <h3>🔗 Third-Party Sharing</h3>
      <p>
        <span class="rating ${ratingClass}">${rating}/10</span>
        ${formatLine(analysis.thirdPartySharing.replace(/\d+\/10\s*-?\s*/i, ''))}
      </p>
    </div>
    
    <div class="timestamp">
      ${methodBadge}<br>
      Analyzed: ${new Date(analysis.analyzedAt).toLocaleString()}
    </div>
    
    <div class="settings-link">
      <a id="settingsLink">⚙️ Settings</a>
    </div>
  `;
  
  document.getElementById('settingsLink').addEventListener('click', () => {
    showSettings();
  });
}

function displayNoAnalysis() {
  const content = document.getElementById('content');
  
  content.innerHTML = `
    <div class="no-analysis">
      <div class="icon">🔍</div>
      <h2>No Analysis Available</h2>
      <p>Visit a Terms & Conditions, Privacy Policy, or Code of Conduct page to automatically analyze it.</p>
      <button class="analyze-btn" id="manualAnalyze">Analyze This Page</button>
    </div>
    
    <div class="settings-link">
      <a id="settingsLink">⚙️ Settings</a>
    </div>
  `;
  
  document.getElementById('manualAnalyze').addEventListener('click', () => {
    content.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Analyzing page...</p>
      </div>
    `;
    
    // Trigger manual analysis
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "forceAnalyze" }, (response) => {
        // Reload popup after 2 seconds
        setTimeout(() => {
          loadAnalysis();
        }, 2000);
      });
    });
  });
  
  document.getElementById('settingsLink').addEventListener('click', () => {
    showSettings();
  });
}

function showSettings() {
  const content = document.getElementById('content');
  
  chrome.storage.sync.get(['claudeApiKey'], (result) => {
    const hasKey = !!result.claudeApiKey;
    
    content.innerHTML = `
      <div class="api-setup">
        <h3>⚙️ Settings</h3>
        <p style="font-size: 13px; margin-bottom: 12px; opacity: 0.9;">
          ${hasKey ? 'API Key configured ✓' : 'No API key set - using rule-based analysis'}
        </p>
        <input type="password" id="apiKeyInput" placeholder="sk-ant-..." value="${hasKey ? '••••••••••••••' : ''}">
        <div>
          <button id="saveApiKey">${hasKey ? 'Update' : 'Save'} API Key</button>
          ${hasKey ? '<button class="skip" id="removeKey">Remove Key</button>' : ''}
        </div>
        <button class="analyze-btn" id="backBtn" style="margin-top: 16px;">← Back</button>
      </div>
    `;
    
    document.getElementById('saveApiKey').addEventListener('click', () => {
      const apiKey = document.getElementById('apiKeyInput').value.trim();
      if (apiKey && !apiKey.includes('•')) {
        chrome.storage.sync.set({ claudeApiKey: apiKey, skipApiSetup: false }, () => {
          alert('API key saved! The extension will now use AI-powered analysis.');
          loadAnalysis();
        });
      }
    });
    
    if (hasKey) {
      document.getElementById('removeKey').addEventListener('click', () => {
        chrome.storage.sync.remove(['claudeApiKey'], () => {
          alert('API key removed. Using rule-based analysis.');
          loadAnalysis();
        });
      });
    }
    
    document.getElementById('backBtn').addEventListener('click', () => {
      loadAnalysis();
    });
  });
}

function formatLine(line) {
  // Remove the prefix (e.g., "Line 1 - DATA COLLECTED: " or "DATA COLLECTED: ")
  return line.replace(/^(Line \d+ - )?[A-Z\s]+:\s*/i, '').trim();
}