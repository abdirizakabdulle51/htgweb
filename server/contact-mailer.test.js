import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";

test("contact email uses fixed support recipient and client Reply-To", async () => {
  const original = nodemailer.createTransport;
  const previousUser = process.env.SMTP_USER;
  const previousPass = process.env.SMTP_PASS;
  let sent;
  process.env.SMTP_USER = "test@example.com";
  process.env.SMTP_PASS = "test-only";
  nodemailer.createTransport = () => ({ sendMail: async (mail) => { sent = mail; } });
  try {
    const { sendContactEnquiry } = await import("./mailer.js?contact-test");
    await sendContactEnquiry({ fullName: "Example", email: "client@example.com", enquiryType: "Partnerships", message: "<script>plain text</script>" });
    assert.equal(sent.to, "support@htgclouds.com");
    assert.equal(sent.replyTo, "client@example.com");
    assert.equal(sent.html, undefined);
    assert.match(sent.text, /plain text/);
  } finally {
    nodemailer.createTransport = original;
    if (previousUser === undefined) delete process.env.SMTP_USER; else process.env.SMTP_USER = previousUser;
    if (previousPass === undefined) delete process.env.SMTP_PASS; else process.env.SMTP_PASS = previousPass;
  }
});
