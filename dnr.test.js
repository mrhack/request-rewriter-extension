import assert from "node:assert/strict";
import test from "node:test";
import { buildCondition, buildDNRRules, buildHeaderOps } from "./dnr.js";

const baseRule = {
  id: "r1",
  name: "Test",
  enabled: true,
  matchPattern: "",
  headerMods: { on: true, rows: [{ k: "x-test", v: "1" }] },
};

// ---------------------------------------------------------------
// The reported bug: the first navigation to a domain (the top-level
// document / main_frame request) did not receive the header.
// Root cause: DNR excludes main_frame when resourceTypes is omitted.
// ---------------------------------------------------------------
test("buildCondition: always lists resource types explicitly", () => {
  const cond = buildCondition(baseRule);
  assert.ok(Array.isArray(cond.resourceTypes), "resourceTypes must be present");
  assert.ok(cond.resourceTypes.includes("main_frame"), "resourceTypes must include main_frame");
});

test("buildCondition: includes every resource type DNR supports", () => {
  const cond = buildCondition(baseRule);
  assert.deepEqual(cond.resourceTypes, [
    "main_frame",
    "sub_frame",
    "stylesheet",
    "script",
    "image",
    "font",
    "object",
    "xmlhttprequest",
    "ping",
    "csp_report",
    "media",
    "websocket",
    "webtransport",
    "webbundle",
    "other",
  ]);
});

test("buildCondition: resourceTypes is a fresh array per rule", () => {
  const a = buildCondition(baseRule);
  const b = buildCondition(baseRule);
  assert.notEqual(a.resourceTypes, b.resourceTypes);
  a.resourceTypes.push("mutated");
  assert.ok(!b.resourceTypes.includes("mutated"));
});

test("buildCondition: empty pattern -> urlFilter '*'", () => {
  const cond = buildCondition(baseRule);
  assert.equal(cond.urlFilter, "*");
  assert.equal(cond.regexFilter, undefined);
});

test("buildCondition: plain pattern -> urlFilter", () => {
  const cond = buildCondition({ ...baseRule, matchPattern: "mweb/v1/config" });
  assert.equal(cond.urlFilter, "mweb/v1/config");
  assert.equal(cond.regexFilter, undefined);
});

test("buildCondition: regex pattern -> regexFilter", () => {
  const cond = buildCondition({ ...baseRule, matchPattern: "^https://api\\.example\\.com/" });
  assert.equal(cond.regexFilter, "^https://api\\.example\\.com/");
  assert.equal(cond.urlFilter, undefined);
});

test("buildCondition: never sets both urlFilter and regexFilter", () => {
  ["", "abc", "a|b", "^x$"].forEach((pattern) => {
    const cond = buildCondition({ ...baseRule, matchPattern: pattern });
    assert.ok(!(cond.urlFilter && cond.regexFilter), "both set for: " + pattern);
  });
});

// --- header ops ---
test("buildHeaderOps: maps rows to set operations", () => {
  assert.deepEqual(buildHeaderOps({ headerMods: { rows: [{ k: "X-A", v: "1" }] } }), [
    { header: "X-A", operation: "set", value: "1" },
  ]);
});

test("buildHeaderOps: skips rows without a key", () => {
  const ops = buildHeaderOps({ headerMods: { rows: [{ k: "", v: "1" }, { k: "X-B", v: "2" }] } });
  assert.equal(ops.length, 1);
  assert.equal(ops[0].header, "X-B");
});

test("buildHeaderOps: trims keys", () => {
  assert.equal(buildHeaderOps({ headerMods: { rows: [{ k: "  X-C  ", v: "v" }] } })[0].header, "X-C");
});

test("buildHeaderOps: missing value becomes empty string", () => {
  const ops = buildHeaderOps({ headerMods: { rows: [{ k: "X-D" }] } });
  assert.equal(ops[0].value, "");
});

test("buildHeaderOps: tolerates missing headerMods", () => {
  assert.deepEqual(buildHeaderOps({}), []);
});

// --- full rule building ---
test("buildDNRRules: only uses 'set', never 'remove'", () => {
  const rules = buildDNRRules({ rules: [baseRule] });
  assert.equal(rules.length, 1);
  rules[0].action.requestHeaders.forEach((op) => assert.equal(op.operation, "set"));
});

test("buildDNRRules: does not touch response headers", () => {
  const rules = buildDNRRules({ rules: [baseRule] });
  assert.equal(rules[0].action.responseHeaders, undefined);
});

test("buildDNRRules: skips disabled rules", () => {
  assert.equal(buildDNRRules({ rules: [{ ...baseRule, enabled: false }] }).length, 0);
});

test("buildDNRRules: skips rules with headerMods off", () => {
  assert.equal(buildDNRRules({ rules: [{ ...baseRule, headerMods: { on: false, rows: [{ k: "a", v: "b" }] } }] }).length, 0);
});

test("buildDNRRules: skips rules with no usable header rows", () => {
  assert.equal(buildDNRRules({ rules: [{ ...baseRule, headerMods: { on: true, rows: [] } }] }).length, 0);
  assert.equal(buildDNRRules({ rules: [{ ...baseRule, headerMods: { on: true, rows: [{ k: "", v: "x" }] } }] }).length, 0);
});

test("buildDNRRules: sequential ids starting at 1", () => {
  const rules = buildDNRRules({ rules: [baseRule, baseRule, baseRule] });
  assert.deepEqual(rules.map((r) => r.id), [1, 2, 3]);
});

test("buildDNRRules: every rule has modifyHeaders + main_frame", () => {
  const rules = buildDNRRules({
    rules: [
      { ...baseRule, matchPattern: "" },
      { ...baseRule, matchPattern: "api.example.com" },
    ],
  });
  rules.forEach((r) => {
    assert.equal(r.action.type, "modifyHeaders");
    assert.ok(r.condition.resourceTypes.includes("main_frame"));
  });
});

test("buildDNRRules: empty config yields no rules", () => {
  assert.deepEqual(buildDNRRules({ rules: [] }), []);
});
