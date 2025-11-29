// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzePolicy") {
    analyzeContent(request.content, request.url)
      .then(analysis => {
        // Store the analysis
        chrome.storage.local.set({
          [request.url]: {
            analysis: analysis,
            timestamp: Date.now()
          }
        });
        
        // Show notification
        chrome.action.setBadgeText({ text: "✓", tabId: sender.tab.id });
        chrome.action.setBadgeBackgroundColor({ color: "#4CAF50", tabId: sender.tab.id });
        
        sendResponse({ success: true, analysis: analysis });
      })
      .catch(error => {
        console.error("Analysis error:", error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep channel open for async response
  }
});

async function analyzeContent(content, url) {
  try {
    // Simple rule-based analysis as fallback
    const analysis = analyzeWithRules(content);
    
    // Try to use Claude API if available
    try {
      const apiAnalysis = await analyzeWithClaude(content);
      if (apiAnalysis) {
        return apiAnalysis;
      }
    } catch (apiError) {
      console.log("API unavailable, using rule-based analysis:", apiError);
    }
    
    return {
      ...analysis,
      url: url,
      analyzedAt: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Analysis failed: ${error.message}`);
  }
}

// Rule-based analysis (works without API)
function analyzeWithRules(content) {
  const lowerContent = content.toLowerCase();
  
  // Detect data types collected
  const dataTypes = [];
  if (lowerContent.includes('email') || lowerContent.includes('e-mail')) dataTypes.push('email addresses');
  if (lowerContent.includes('name') || lowerContent.includes('personal information')) dataTypes.push('names');
  if (lowerContent.includes('phone') || lowerContent.includes('telephone')) dataTypes.push('phone numbers');
  if (lowerContent.includes('address') || lowerContent.includes('location')) dataTypes.push('location data');
  if (lowerContent.includes('cookie') || lowerContent.includes('tracking')) dataTypes.push('cookies/tracking data');
  if (lowerContent.includes('ip address') || lowerContent.includes('device')) dataTypes.push('device information');
  if (lowerContent.includes('credit card') || lowerContent.includes('payment')) dataTypes.push('payment information');
  if (lowerContent.includes('browsing') || lowerContent.includes('usage')) dataTypes.push('browsing history');
  
  // Detect usage purposes
  const purposes = [];
  if (lowerContent.includes('analytics') || lowerContent.includes('analyze')) purposes.push('analytics');
  if (lowerContent.includes('marketing') || lowerContent.includes('advertisement')) purposes.push('marketing');
  if (lowerContent.includes('improve') || lowerContent.includes('enhancement')) purposes.push('service improvement');
  if (lowerContent.includes('personalize') || lowerContent.includes('customize')) purposes.push('personalization');
  if (lowerContent.includes('security') || lowerContent.includes('fraud')) purposes.push('security');
  if (lowerContent.includes('communicate') || lowerContent.includes('contact')) purposes.push('communication');
  
  // Calculate third-party sharing score
  let sharingScore = 0;
  const sharingIndicators = [
    'third party', 'third-party', 'partners', 'affiliates', 
    'service providers', 'vendors', 'advertising', 'share your',
    'disclose', 'transfer'
  ];
  
  sharingIndicators.forEach(indicator => {
    const matches = (lowerContent.match(new RegExp(indicator, 'g')) || []).length;
    sharingScore += matches;
  });
  
  // Scale to 1-10
  let rating = Math.min(10, Math.max(1, Math.floor(sharingScore / 3) + 1));
  
  // Determine sharing description
  let sharingDesc = '';
  if (rating <= 3) {
    sharingDesc = 'Limited sharing, mostly essential service providers';
  } else if (rating <= 6) {
    sharingDesc = 'Moderate sharing with partners and analytics providers';
  } else {
    sharingDesc = 'Extensive sharing with multiple third parties including advertisers';
  }
  
  return {
    dataCollected: `DATA COLLECTED: ${dataTypes.length > 0 ? dataTypes.join(', ') : 'Personal information and usage data'}`,
    dataUsage: `DATA USAGE: ${purposes.length > 0 ? purposes.join(', ') : 'Service provision and improvement'}`,
    thirdPartySharing: `THIRD-PARTY SHARING: ${rating}/10 - ${sharingDesc}`,
    rawAnalysis: 'Rule-based analysis',
    method: 'rules'
  };
}

// Claude API analysis (if API key is available)
async function analyzeWithClaude(content) {
  // Check if API key is stored
  const result = await chrome.storage.sync.get(['claudeApiKey']);
  if (!result.claudeApiKey) {
    return null;
  }
  
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": result.claudeApiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `Analyze this privacy policy/terms of service and provide EXACTLY 3 lines in this format:

Line 1 - DATA COLLECTED: [List what data they collect - be specific and concise]
Line 2 - DATA USAGE: [Explain how they use the data]
Line 3 - THIRD-PARTY SHARING: [Rate from 1-10 where 10 is most sharing, then briefly explain]

Content to analyze:
${content.substring(0, 15000)}

Be concise and direct. Each line should be under 150 characters.`
      }]
    })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  const analysisText = data.content
    .filter(item => item.type === "text")
    .map(item => item.text)
    .join("\n");

  // Parse the three lines
  const lines = analysisText.trim().split("\n").filter(line => line.trim());
  
  return {
    dataCollected: lines[0] || "Unable to determine data collection",
    dataUsage: lines[1] || "Unable to determine data usage",
    thirdPartySharing: lines[2] || "Unable to determine third-party sharing",
    rawAnalysis: analysisText,
    method: 'api'
  };
}