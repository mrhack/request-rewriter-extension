// Data model: { rules: [{ id, name, enabled, matchPattern, headerMods: { on, rows: [{k, v}] } }] }

export const DEFAULT_CONFIG = { rules: [] };

// All resource types supported by declarativeNetRequest.
// IMPORTANT: when a DNR rule omits `resourceTypes`, Chrome excludes "main_frame"
// (the top-level document request, i.e. the very first navigation you type in the
// address bar). We must list them explicitly so document requests get headers too.
export const ALL_RESOURCE_TYPES = [
  'main_frame',
  'sub_frame',
  'stylesheet',
  'script',
  'image',
  'font',
  'object',
  'xmlhttprequest',
  'ping',
  'csp_report',
  'media',
  'websocket',
  'webtransport',
  'webbundle',
  'other'
];

// Characters that are only meaningful in a regular expression. If a pattern
// contains one of them we hand it to DNR as `regexFilter`, otherwise we use
// `urlFilter` (plain substring / `*` wildcard matching).
var REGEX_ONLY_CHARS = /[\^\$\(\)\[\]\?\+\|\\\{\}]/;

// A leading `||` / `|` and a trailing `|` are urlFilter *anchors*, not regex
// alternation, so they must be ignored when deciding which engine to use.
function stripUrlAnchors(pattern) {
  var core = pattern;
  if (core.startsWith('||')) core = core.slice(2);
  else if (core.startsWith('|')) core = core.slice(1);
  if (core.endsWith('|')) core = core.slice(0, -1);
  return core;
}

export function isRegexPattern(pattern) {
  var p = (pattern || '').trim();
  if (!p) return false;
  return REGEX_ONLY_CHARS.test(stripUrlAnchors(p));
}

// Build the `condition` URL part of a DNR rule for a user supplied pattern.
export function buildUrlCondition(pattern) {
  var p = (pattern || '').trim();
  if (!p) return { urlFilter: '*' };
  if (isRegexPattern(p)) return { regexFilter: p };
  return { urlFilter: p };
}

// Translate a DNR `urlFilter` into an equivalent RegExp so that the popup's
// "Test URL" box behaves exactly like the real rule. See
// https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest#property-RuleCondition-urlFilter
function urlFilterToRegExp(pattern) {
  var p = pattern;
  var prefix = '';
  var suffix = '';
  // `||` at the start anchors to a domain (start of host or any subdomain).
  if (p.startsWith('||')) {
    // Require the scheme separator so we can never start matching inside the
    // scheme text itself, then allow any (sub)domain prefix ending with a dot.
    prefix = '^[a-z][a-z0-9+.\\-]*://(?:[^/?#]*\\.)?';
    p = p.slice(2);
  } else if (p.startsWith('|')) {
    prefix = '^';
    p = p.slice(1);
  }
  // `|` at the end anchors to the end of the URL.
  if (p.endsWith('|')) {
    suffix = '$';
    p = p.slice(0, -1);
  }
  // Every regex metacharacter other than `*` is a literal inside urlFilter.
  var body = p
    .split('*')
    .map(function (part) { return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); })
    .join('.*');
  return prefix + body + suffix;
}

// Shared matcher used by both the popup ("Test URL") and the tests so the UI
// never disagrees with what declarativeNetRequest will actually do.
export function matchesUrl(pattern, url) {
  var p = (pattern || '').trim();
  if (!p) return true; // empty = match all
  if (!url) return false;
  try {
    if (isRegexPattern(p)) return new RegExp(p).test(url);
    return new RegExp(urlFilterToRegExp(p)).test(url);
  } catch (e) {
    return false;
  }
}

// --- Rule matching ---
export function matchingRules(rules, url) {
  return rules.filter(function (rule) {
    if (rule.enabled === false) return false;
    return matchesUrl(rule.matchPattern, url);
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
