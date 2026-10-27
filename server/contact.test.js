import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createContactRouter, enquiryTypes } from "./contact.js";

test("contact enquiries validate inputs, allow optional phone, report failures and rate limit", async () => {
  let sent = [];
  let fail = false;
  const app = express();
  app.use(express.json());
  app.use("/api/contact", createContactRouter({ send: async (data) => { if (fail) throw new Error("smtp"); sent.push(data); } }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const payload = { fullName: "Example Client", email: "client@example.com", enquiryType: enquiryTypes[0], message: "Please help plan our migration." };
  const post = (body) => fetch(`http://127.0.0.1:${server.address().port}/api/contact`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  try {
    assert.equal((await post(payload)).status, 200);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].phone, "");
    assert.equal((await post({ ...payload, email: "bad\r\nBcc: x@y.com" })).status, 400);
    assert.equal((await post({ ...payload, message: "x".repeat(5001) })).status, 400);
    assert.equal((await post({ ...payload, enquiryType: "unknown" })).status, 400);
    fail = true;
    const failed = await post(payload);
    assert.equal(failed.status, 503);
    assert.match((await failed.json()).error, /couldn’t send/);
    assert.equal((await post(payload)).status, 429);
    assert.equal(sent.length, 1);
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
});
