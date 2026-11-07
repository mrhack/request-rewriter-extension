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
  throw new Error("未知操作");
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
    if (migrated) console.log('[RW] config migrated to new format');
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
  console.log('[RW] config rules count:', config.rules.length);
  config.rules.forEach(r => console.log('[RW] rule:', r.name, 'enabled:', r.enabled, 'headerMods:', JSON.stringify(r.headerMods)));
  const newRules = buildDNRRules(config);
  console.log('[RW] built DNR rules:', newRules.length);
  const existing = await chrome.declarativeNetRequest.getSessionRules();
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: existing.map(r => r.id),
      addRules: newRules,
    });
    console.log('[RW] DNR rules synced OK, count:', newRules.length);
    newRules.forEach(r => {
      var ops = r.action.requestHeaders || [];
      console.log('[RW] DNR rule id:', r.id, 'headers:', ops.map(o => o.header + '=' + o.value).join(', '), 'condition:', JSON.stringify(r.condition));
    });
    const after = await chrome.declarativeNetRequest.getSessionRules();
    console.log('[RW] verified session rules:', after.length);
  } catch (e) {
    console.error('[RW] DNR updateSessionRules FAILED:', e.message, e);
  }
}

async function clearDNRRules() {
  const existing = await chrome.declarativeNetRequest.getSessionRules();
  if (existing.length) {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: existing.map(r => r.id),
    });
  }
  console.log('[RW] DNR rules cleared');
}

async function setBadge(on) {
  try {
    const size = 128;
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = on ? '#00b894' : '#555';
    ctx.beginPath();
    ctx.roundRect(8, 8, size - 16, size - 16, 20);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 90px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R', size / 2, size / 2 + 4);
    await chrome.action.setIcon({ imageData: ctx.getImageData(0, 0, size, size) });
  } catch (e) {
    console.error('[RW] setIcon failed:', e);
  }
}
