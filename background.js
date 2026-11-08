import { DEFAULT_CONFIG, enabledRules, validateConfig } from "./rules.js";

chrome.runtime.onInstalled.addListener(async () => {
  const { config } = await chrome.storage.local.get("config");
  if (!config) await chrome.storage.local.set({ config: DEFAULT_CONFIG });
  const { pluginEnabled = false } = await chrome.storage.local.get("pluginEnabled");
  if (pluginEnabled) { await syncDNRRules(); await setBadge(true); }
});

chrome.runtime.onStartup.addListener(async () => {
  const { pluginEnabled = false } = await chrome.storage.local.get("pluginEnabled");
  if (pluginEnabled) { await syncDNRRules(); await setBadge(true); }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse, (error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

async function handleMessage(message) {
  if (message.type === "status") {
    const { pluginEnabled = false } = await chrome.storage.local.get("pluginEnabled");
    return { ok: true, enabled: pluginEnabled };
  }
  if (message.type === "enable") {
    await chrome.storage.local.set({ pluginEnabled: true });
    await syncDNRRules();
    await setBadge(true);
    return { ok: true, enabled: true };
  }
  if (message.type === "disable") {
    await chrome.storage.local.set({ pluginEnabled: false });
    await clearDNRRules();
    await setBadge(false);
    return { ok: true, enabled: false };
  }
  if (message.type === "getConfig") {
    return { ok: true, config: await loadConfig() };
  }
  if (message.type === "saveConfig") {
    validateConfig(message.config);
    await chrome.storage.local.set({ config: message.config });
    const { pluginEnabled = false } = await chrome.storage.local.get("pluginEnabled");
    if (pluginEnabled) await syncDNRRules();
    return { ok: true };
  }
  throw new Error("Unknown operation");
}

// ============================================================
// DNR (declarativeNetRequest) for request header modifications
// ============================================================

async function loadConfig() {
  const { config = DEFAULT_CONFIG } = await chrome.storage.local.get("config");
  // Migrate old format: requestMods.header → headerMods
  if (config && config.rules) {
    let migrated = false;
    for (const rule of config.rules) {
      if (rule.requestMods && rule.requestMods.header && !rule.headerMods) {
        rule.headerMods = rule.requestMods.header;
        delete rule.requestMods;
        migrated = true;
      }
      if (rule.responseMods) { delete rule.responseMods; migrated = true; }
    }
    if (migrated) await chrome.storage.local.set({ config });
  }
  return config;
}

function buildDNRRules(config) {
  const rules = enabledRules(config);
  const dnrRules = [];
  let ruleId = 1;
  for (const rule of rules) {
    if (!rule.headerMods?.on) continue;
    const headerOps = (rule.headerMods.rows || [])
      .filter(row => row.k)
      .map(row => ({
        header: row.k,
        operation: 'set',
        value: String(row.v !== undefined ? row.v : ''),
      }));
    if (!headerOps.length) continue;
    dnrRules.push({
      id: ruleId++,
      priority: 1,
      action: { type: 'modifyHeaders', requestHeaders: headerOps },
      condition: buildCondition(rule),
    });
  }
  return dnrRules;
}

function buildCondition(rule) {
  const cond = {};
  const p = rule.matchPattern;
  if (!p || !p.trim()) {
    cond.urlFilter = '*';
  } else {
    if (/[\^\$\(\)\[\]\?\+\|\\]/.test(p)) {
      cond.regexFilter = p;
    } else {
      cond.urlFilter = p;
    }
  }
  return cond;
}

async function syncDNRRules() {
  const config = await loadConfig();
  const newRules = buildDNRRules(config);
  const existing = await chrome.declarativeNetRequest.getSessionRules();
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: existing.map(r => r.id),
      addRules: newRules,
    });
    const after = await chrome.declarativeNetRequest.getSessionRules();
  } catch (e) {
  }
}

async function clearDNRRules() {
  const existing = await chrome.declarativeNetRequest.getSessionRules();
  if (existing.length) {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: existing.map(r => r.id),
    });
  }
}

async function setBadge(on) {
  try {
    if (on) {
      await chrome.action.setIcon({ path: { "16": "icon16.png", "32": "icon32.png", "48": "icon48.png", "128": "icon128.png" } });
    } else {
      const size = 128;
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.roundRect(8, 8, size - 16, size - 16, 20);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 90px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('R', size / 2, size / 2 + 4);
      await chrome.action.setIcon({ imageData: ctx.getImageData(0, 0, size, size) });
    }
  } catch (e) {}
}
