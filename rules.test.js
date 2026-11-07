import assert from "node:assert/strict";
import test from "node:test";
import { matchingRules, validateConfig, emptyRule, enabledRules } from "./rules.js";

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

test("emptyRule: default name is 新配置", () => {
  var r = emptyRule();
  assert.equal(r.name, "新配置");
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
