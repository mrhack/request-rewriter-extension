import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_RESOURCE_TYPES,
  buildUrlCondition,
  enabledRules,
  emptyRule,
  isRegexPattern,
  matchesUrl,
  matchingRules,
  validateConfig,
} from "./rules.js";

test("matchingRules: empty pattern matches all", () => {
  assert.equal(matchingRules([{ enabled: true, matchPattern: "" }], "https://example.com/any").length, 1);
});

test("matchingRules: regex pattern", () => {
  assert.equal(matchingRules([{ enabled: true, matchPattern: "api\\.example\\.com" }], "https://api.example.com/users").length, 1);
  assert.equal(matchingRules([{ enabled: true, matchPattern: "api\\.example\\.com" }], "https://other.com/users").length, 0);
});

test("matchingRules: disabled rule skipped", () => {
  assert.equal(matchingRules([{ enabled: false, matchPattern: "" }], "https://example.com").length, 0);
});

test("matchingRules: invalid regex pattern skipped", () => {
  assert.equal(matchingRules([{ enabled: true, matchPattern: "[invalid" }], "https://example.com").length, 0);
});

test("matchingRules: multiple rules, some match", () => {
  var rules = [
    { enabled: true, matchPattern: "api\\.example\\.com" },
    { enabled: true, matchPattern: "other\\.com" },
    { enabled: false, matchPattern: "" }
  ];
  var result = matchingRules(rules, "https://api.example.com/users");
  assert.equal(result.length, 1);
});

test("emptyRule: has correct structure", () => {
  var r = emptyRule("test");
  assert.equal(r.name, "test");
  assert.equal(r.enabled, true);
  assert.equal(r.matchPattern, "");
  assert.ok(r.headerMods);
  assert.equal(r.headerMods.on, true);
  assert.deepEqual(r.headerMods.rows, []);
});

test("emptyRule: generates unique ids", () => {
  var r1 = emptyRule();
  var r2 = emptyRule();
  assert.notEqual(r1.id, r2.id);
});

test("emptyRule: default name is New Config", () => {
  var r = emptyRule();
  assert.equal(r.name, "New Config");
});

test("emptyRule: headerMods starts enabled", () => {
  var r = emptyRule();
  assert.equal(r.headerMods.on, true);
  assert.equal(r.headerMods.rows.length, 0);
});

test("validateConfig: accepts valid", () => {
  assert.doesNotThrow(() => validateConfig({ rules: [emptyRule()] }));
});

test("validateConfig: rejects invalid", () => {
  assert.throws(() => validateConfig({ rules: "not array" }));
});

test("validateConfig: empty rules array is valid", () => {
  assert.doesNotThrow(() => validateConfig({ rules: [] }));
});

test("validateConfig: null config is invalid", () => {
  assert.throws(() => validateConfig(null));
});

test("validateConfig: undefined config is invalid", () => {
  assert.throws(() => validateConfig(undefined));
});

test("enabledRules: filters disabled rules", () => {
  var config = { rules: [{ enabled: true, matchPattern: "" }, { enabled: false, matchPattern: "" }] };
  var result = enabledRules(config);
  assert.equal(result.length, 1);
});

test("enabledRules: all enabled returns all", () => {
  var config = { rules: [{ enabled: true, matchPattern: "" }, { enabled: true, matchPattern: "" }] };
  var result = enabledRules(config);
  assert.equal(result.length, 2);
});

// ---------------------------------------------------------------
// Regression: top-level document (main_frame) requests must match.
// If a DNR rule omits `resourceTypes`, Chrome excludes "main_frame",
// so the first navigation typed in the address bar never gets headers.
// ---------------------------------------------------------------
test("ALL_RESOURCE_TYPES: includes main_frame", () => {
  assert.ok(ALL_RESOURCE_TYPES.includes("main_frame"));
});

test("ALL_RESOURCE_TYPES: only contains values accepted by declarativeNetRequest", () => {
  var valid = new Set([
    "main_frame", "sub_frame", "stylesheet", "script", "image", "font",
    "object", "xmlhttprequest", "ping", "csp_report", "media", "websocket",
    "webtransport", "webbundle", "other",
  ]);
  ALL_RESOURCE_TYPES.forEach(function (t) {
    assert.ok(valid.has(t), "invalid resource type: " + t);
  });
});

test("ALL_RESOURCE_TYPES: has no duplicates", () => {
  assert.equal(new Set(ALL_RESOURCE_TYPES).size, ALL_RESOURCE_TYPES.length);
});

test("buildUrlCondition: empty pattern matches everything", () => {
  assert.deepEqual(buildUrlCondition(""), { urlFilter: "*" });
  assert.deepEqual(buildUrlCondition("   "), { urlFilter: "*" });
  assert.deepEqual(buildUrlCondition(undefined), { urlFilter: "*" });
});

test("buildUrlCondition: plain text becomes urlFilter", () => {
  assert.deepEqual(buildUrlCondition("api.example.com"), { urlFilter: "api.example.com" });
  assert.deepEqual(buildUrlCondition("*://example.com/*"), { urlFilter: "*://example.com/*" });
});

test("buildUrlCondition: regex-ish pattern becomes regexFilter", () => {
  assert.deepEqual(buildUrlCondition("^https://api\\.example\\.com/"), { regexFilter: "^https://api\\.example\\.com/" });
  assert.deepEqual(buildUrlCondition("(foo|bar)\\.com"), { regexFilter: "(foo|bar)\\.com" });
});

test("isRegexPattern: detects regex characters", () => {
  assert.equal(isRegexPattern(""), false);
  assert.equal(isRegexPattern("api.example.com"), false);
  assert.equal(isRegexPattern("api\\.example\\.com"), true);
  assert.equal(isRegexPattern("a|b"), true);
  assert.equal(isRegexPattern("(x)"), true);
  assert.equal(isRegexPattern("[abc]"), true);
});

test("matchesUrl: empty pattern matches all URLs", () => {
  assert.equal(matchesUrl("", "https://any.example.com/"), true);
  assert.equal(matchesUrl("  ", "https://any.example.com/"), true);
});

test("matchesUrl: plain pattern is a substring match like DNR urlFilter", () => {
  // urlFilter is a substring match, NOT a full-URL regex.
  assert.equal(matchesUrl("api.example.com", "https://api.example.com/users"), true);
  assert.equal(matchesUrl("mweb", "https://site.com/mweb/v1/config"), true);
  assert.equal(matchesUrl("nomatch", "https://site.com/mweb/v1/config"), false);
});

test("matchesUrl: urlFilter does not treat dots as wildcards", () => {
  assert.equal(matchesUrl("api.example.com", "https://apiXexample.com/"), false);
});

test("matchesUrl: urlFilter supports * wildcard", () => {
  assert.equal(matchesUrl("*://example.com/*", "https://example.com/a"), true);
  assert.equal(matchesUrl("*/mweb/*", "https://site.com/mweb/v1"), true);
});

test("matchesUrl: urlFilter || domain anchor matches host and subdomains", () => {
  assert.equal(matchesUrl("||example.com/", "https://example.com/a"), true);
  assert.equal(matchesUrl("||example.com/", "https://www.example.com/a"), true);
  assert.equal(matchesUrl("||example.com/", "https://notexample.com/a"), false);
});

test("matchesUrl: regex pattern uses real regex semantics", () => {
  assert.equal(matchesUrl("^https://api\\.example\\.com/", "https://api.example.com/users"), true);
  assert.equal(matchesUrl("^https://api\\.example\\.com/", "https://other.com/users"), false);
});

test("matchesUrl: empty url never matches a non-empty pattern", () => {
  assert.equal(matchesUrl("api.example.com", ""), false);
});

test("matchingRules: plain pattern matches like DNR (substring, not regex)", () => {
  // Regression: popup used to treat patterns as RegExp while DNR used urlFilter,
  // so "example.com" matched "exampleXcom" in the UI but never in the browser.
  assert.equal(matchingRules([{ enabled: true, matchPattern: "example.com" }], "https://exampleXcom/").length, 0);
  assert.equal(matchingRules([{ enabled: true, matchPattern: "example.com" }], "https://example.com/").length, 1);
});
