// ----------- BASIC UTILITIES -----------
function splitIntoSections(text) {
  const lines = text.split("\n");
  const sections = [];
  let current = { title: "General", content: "" };

  const headingRegex = /^(.*(?:policy|data|information|rights|terms|cookies?).*)$/i;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;

    if (headingRegex.test(trimmed)) {
      if (current.content.length > 0) {
        sections.push({ ...current });
      }
      current = { title: trimmed, content: "" };
    } else {
      current.content += trimmed + " ";
    }
  });

  if (current.content.length > 0) sections.push(current);
  return sections;
}

function sentenceTokenizer(text) {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);
}

// ------------ ENTITY DETECTION -----------
function detectDataTypes(text) {
  const patterns = {
    email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    ip: /\b\d{1,3}(?:\.\d{1,3}){3}\b/,
    device: /(device id|identifier|cookie id|tracking id)/i,
    location: /(gps|location|geolocation)/i,
    payment: /(credit card|debit|payment|billing)/i
  };

  const detected = Object.keys(patterns).filter(key =>
    patterns[key].test(text)
  );

  return detected;
}

// ---------- PURPOSE DETECTORS ------------
function detectPurposes(text) {
  const mapping = {
    ads: /(ads|advertis|marketing|retarget)/i,
    analytics: /(analytics|tracking|measure)/i,
    personalization: /(personalization|customiz|profil)/i,
    service: /(provide|deliver|operate|improve)/i
  };

  return Object.keys(mapping).filter(key => mapping[key].test(text));
}

// -------- THIRD PARTY DETECTION ----------
function detectThirdParties(text) {
  const known = [
    "google",
    "analytics",
    "facebook",
    "meta",
    "mixpanel",
    "segment",
    "cloudflare",
    "hubspot",
    "adobe"
  ];

  const lower = text.toLowerCase();
  return known.filter(n => lower.includes(n));
}

// -------- RIGHTS DETECTION -------------
function detectRights(text) {
  return {
    deletion:
      /(delete account|erase|right to deletion|remove your data)/i.test(text)
        ? "available"
        : "unclear",
    retention:
      /(retain|storage period|store for)/i.test(text)
        ? "mentioned"
        : "not mentioned"
  };
}

// ---------- MAIN PARSER FUNCTION -----------
function parsePolicy(text) {
  const sections = splitIntoSections(text);
  const sentences = sentenceTokenizer(text);

  const dataTypes = detectDataTypes(text);
  const purposes = detectPurposes(text);
  const thirdParties = detectThirdParties(text);
  const rights = detectRights(text);

  // evidence collection
  const evidence = {};
  dataTypes.forEach(dt => {
    const match = sentences.find(s => s.toLowerCase().includes(dt));
    if (match) evidence[dt] = match;
  });

  purposes.forEach(p => {
    const match = sentences.find(s => s.toLowerCase().includes(p));
    if (match) evidence[p] = match;
  });

  thirdParties.forEach(tp => {
    const match = sentences.find(s => s.toLowerCase().includes(tp));
    if (match) evidence[tp] = match;
  });

  return {
    sections,
    dataTypes,
    purposes,
    thirdParties,
    retention: rights.retention,
    deletion_rights: rights.deletion,
    evidence
  };
}

export { parsePolicy };
