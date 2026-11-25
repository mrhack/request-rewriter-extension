// Pure helpers that translate the user config into declarativeNetRequest rules.
// Kept free of any `chrome.*` API usage so it can be unit tested in Node.

import { ALL_RESOURCE_TYPES, buildUrlCondition, enabledRules } from "./rules.js";

// Build the `condition` object of a DNR rule for one user rule.
export function buildCondition(rule) {
  const cond = buildUrlCondition(rule.matchPattern);
  // `resourceTypes` must be explicit. Per the DNR docs: when neither
  // `resourceTypes` nor `excludedResourceTypes` is specified, "all resource
  // types except main_frame" are matched. main_frame is the top-level document
  // request fired when you type a domain and press Enter, so omitting this list
  // silently drops header changes on first navigation to a site.
  cond.resourceTypes = ALL_RESOURCE_TYPES.slice();
  return cond;
}

// Build the header operations of a DNR rule for one user rule.
export function buildHeaderOps(rule) {
  return (rule.headerMods?.rows || [])
    .filter(row => row && row.k && String(row.k).trim())
    .map(row => ({
      header: String(row.k).trim(),
      operation: 'set',
      value: String(row.v !== undefined && row.v !== null ? row.v : ''),
    }));
}

// Build the full list of DNR rules from a config object.
export function buildDNRRules(config) {
  const rules = enabledRules(config);
  const dnrRules = [];
  let ruleId = 1;
  for (const rule of rules) {
    if (!rule.headerMods?.on) continue;
    const headerOps = buildHeaderOps(rule);
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
