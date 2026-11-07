// Data model: { rules: [{ id, name, enabled, matchPattern, headerMods: { on, rows: [{k, v}] } }] }

export const DEFAULT_CONFIG = { rules: [] };

// --- Rule matching ---
export function matchingRules(rules, url) {
  return rules.filter(function (rule) {
    if (rule.enabled === false) return false;
    var p = rule.matchPattern;
    if (!p || !p.trim()) return true; // empty = match all
    try {
      return new RegExp(p).test(url);
    } catch (e) {
      return false;
    }
  });
}

// --- Serialize an empty rule ---
export function emptyRule(name) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: name || 'New Config',
    enabled: true,
    matchPattern: '',
    headerMods: { on: true, rows: [] }
  };
}

// --- Validate config ---
export function validateConfig(config) {
  if (!config || !Array.isArray(config.rules)) {
    throw new Error('配置必须是包含 rules 数组的 JSON 对象');
  }
  return config;
}

// --- Get enabled rules ---
export function enabledRules(config) {
  return validateConfig(config).rules.filter(function (r) { return r.enabled !== false; });
}
