import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestPost } from '../functions/api/inquiries.js';

const SECRET = 'test-turnstile-secret';
const TOKEN = 'test-turnstile-token';
const EMAIL = 'visitor@example.com';

function request(body) {
  return new Request('https://littleredcoffeeco.ca/api/inquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function inquiry(overrides = {}) {
  return {
    form: 'quick',
    email: EMAIL,
    website: '',
    turnstileToken: TOKEN,
    ...overrides
  };
}

function env() {
  return {
    TURNSTILE_SECRET_KEY: SECRET,
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-client-secret',
    GOOGLE_REFRESH_TOKEN: 'test-refresh-token'
  };
}

test('missing Turnstile token stops before external verification or Gmail', async t => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (...args) => {
    calls.push(args);
    throw new Error('Unexpected network request');
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const response = await onRequestPost({
    request: request(inquiry({ turnstileToken: undefined })),
    env: env()
  });

  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});

test('missing Turnstile secret fails closed before external calls', async t => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const calls = [];
  const diagnostics = [];
  console.error = entry => diagnostics.push(entry);
  globalThis.fetch = async (...args) => {
    calls.push(args);
    throw new Error('Unexpected network request');
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  });

  const response = await onRequestPost({
    request: request(inquiry()),
    env: { ...env(), TURNSTILE_SECRET_KEY: '' }
  });

  assert.equal(response.status, 503);
  assert.equal(calls.length, 0);
  assert.deepEqual(diagnostics, [{
    stage: 'turnstile_verification',
    error_code: 'missing_secret'
  }]);
});

test('failed Turnstile verification stops before Google or Gmail calls', async t => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const calls = [];
  const diagnostics = [];
  console.error = entry => diagnostics.push(entry);
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json({
      success: false,
      'error-codes': ['timeout-or-duplicate']
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  });

  const response = await onRequestPost({
    request: request(inquiry()),
    env: env()
  });

  assert.equal(response.status, 400);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(new URLSearchParams(calls[0].options.body).get('secret'), SECRET);
  assert.equal(new URLSearchParams(calls[0].options.body).get('response'), TOKEN);
  assert.deepEqual(diagnostics, [{
    stage: 'turnstile_verification',
    error_codes: ['timeout-or-duplicate']
  }]);
});

test('successful verification for an unexpected hostname blocks Gmail', async t => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(url);
    return Response.json({ success: true, hostname: 'attacker.example' });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const response = await onRequestPost({
    request: request(inquiry()),
    env: env()
  });

  assert.equal(response.status, 400);
  assert.deepEqual(calls, ['https://challenges.cloudflare.com/turnstile/v0/siteverify']);
});

test('successful Turnstile verification allows the Gmail sending flow', async t => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
      return Response.json({ success: true, hostname: 'littleredcoffeeco.ca' });
    }
    if (url === 'https://oauth2.googleapis.com/token') {
      return Response.json({ access_token: 'test-access-token' });
    }
    if (url === 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send') {
      return Response.json({ id: 'test-message-id' });
    }
    throw new Error('Unexpected network request');
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const response = await onRequestPost({
    request: request(inquiry()),
    env: env()
  });

  assert.equal(response.status, 200);
  assert.deepEqual(calls.map(call => call.url), [
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    'https://oauth2.googleapis.com/token',
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
  ]);
  const gmailRequest = JSON.parse(calls[2].options.body);
  const message = atob(gmailRequest.raw.replace(/-/g, '+').replace(/_/g, '/'));
  assert.match(message, /To: Book@littleredcoffeeco\.ca/);
  assert.match(message, new RegExp(`Reply-To: ${EMAIL}`));
});
