import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import worker from "../src/index.js";

const schema = fs.readFileSync(new URL("../openapi/gpt-action.yaml", import.meta.url), "utf8");

test("GPT Action schema targets the deployed Worker and all routes", () => {
  assert.match(schema, /https:\/\/growth-tech-morning-brief\.ck-market-tools\.workers\.dev/);
  assert.match(schema, /operationId: checkBriefServiceHealth/);
  assert.match(schema, /operationId: getLatestBrief/);
  assert.match(schema, /operationId: refreshMorningBrief/);
});

test("GPT Action contract uses bearer auth and schema version 3", () => {
  assert.match(schema, /type: http\n\s+scheme: bearer/);
  assert.match(schema, /schemaVersion:[\s\S]*enum: \[3\]/);
  assert.match(schema, /required: \[schemaVersion, generatedAt, session, coverage, executiveSummary, watchlist, markdown\]/);
});

test("refresh action is explicitly opt-in", () => {
  assert.match(schema, /Call only when the user explicitly asks to refresh/);
});

test("Worker accepts a trailing slash on the GPT read route", async () => {
  const expected = { schemaVersion: 3, markdown: "ok" };
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
