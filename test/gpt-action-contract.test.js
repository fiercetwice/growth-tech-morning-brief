import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import worker from "../src/index.js";

const schema = fs.readFileSync(new URL("../openapi/gpt-action.yaml", import.meta.url), "utf8");
const deployWorkflow = fs.readFileSync(new URL("../.github/workflows/cloudflare-worker.yml", import.meta.url), "utf8");

test("GPT Action schema targets the deployed Worker and all routes", () => {
  assert.match(schema, /https:\/\/growth-tech-morning-brief\.ck-market-tools\.workers\.dev/);
  assert.match(schema, /operationId: checkBriefServiceHealth/);
  assert.match(schema, /operationId: getLatestBrief/);
  assert.match(schema, /operationId: refreshMorningBrief/);
});

test("GPT Action contract uses bearer auth and schema version 6", () => {
  assert.match(schema, /type: http\n\s+scheme: bearer/);
  assert.match(schema, /schemaVersion:[\s\S]*enum: \[6\]/);
  assert.match(schema, /required: \[schemaVersion, generatedAt, session, coverage, discovery, opportunityGate, watchlist, markdown\]/);
});

test("refresh action is explicitly opt-in", () => {
  assert.match(schema, /Call only when the user explicitly asks to refresh/);
});

test("Worker accepts a trailing slash on the GPT read route", async () => {
  const expected = { schemaVersion: 6, markdown: "ok" };
  const env = {
    RUN_TOKEN_REQUIRED: "true",
    RUN_TOKEN: "smoke-token",
    BRIEF_BUCKET: { get: async () => ({ body: JSON.stringify(expected) }) },
  };
  const response = await worker.fetch(new Request("https://example.test/latest/", {
    headers: { authorization: "Bearer smoke-token" },
  }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), expected);
});

test("health exposes the deployed release for propagation-safe smoke tests", async () => {
  const response = await worker.fetch(new Request("https://example.test/health"), {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: "growth-tech-morning-brief", version: "0.5.6" });
});

test("post-deploy failures print actionable diagnostics before exiting", () => {
  const summaryIndex = deployWorkflow.indexOf('echo "$summary"');
  const failureIndex = deployWorkflow.indexOf('if [ -n "$failures" ]');
  assert.ok(summaryIndex >= 0 && summaryIndex < failureIndex);
  assert.match(deployWorkflow, /Discord delivery incomplete:/);
  assert.match(deployWorkflow, /deliveries completed/);
  assert.match(deployWorkflow, /storage and Discord delivery were not attempted/);
  assert.match(deployWorkflow, /echo "::error::\$failure"/);
  assert.match(deployWorkflow, /GITHUB_STEP_SUMMARY/);
});
