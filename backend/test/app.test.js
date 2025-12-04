const { test } = require('node:test');
const assert = require('assert');

// Ensure SESSION_SECRET is present for config load during tests
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = 'test-session-secret-1234';
}

const { buildAllowedOrigins } = require('../src/app');
const config = require('../src/config/env');

test('CORS allowed origins exclude wildcard by default', () => {
  const allowed = buildAllowedOrigins();
  assert.ok(!allowed.has('*'), 'Allowed origins should not include wildcard');
  assert.ok(
    allowed.has(config.webAppUrl),
    'Default webAppUrl should be allowed for CORS'
  );
});
