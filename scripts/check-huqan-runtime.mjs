const endpoint = String(process.env.HUQAN_ENDPOINT || 'http://127.0.0.1:3000').replace(/\/$/, '');
const apiKey = String(process.env.HUQAN_API_KEY || 'compatibility-test-key');

async function requestJson(path, options = {}) {
  const response = await fetch(`${endpoint}${path}`, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (error) {
    throw new Error(`${path} returned non-JSON HTTP ${response.status}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { response, body };
}

const health = await requestJson('/health');
if (health.response.status !== 200 || health.body?.ok !== true) {
  throw new Error(`HUQAN health compatibility check failed with HTTP ${health.response.status}`);
}

const verification = await requestJson('/v2/verify', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    claim: 'Cats are animals',
    workspaceId: 'default',
  }),
});

if (verification.response.status !== 200) {
  throw new Error(`HUQAN verify compatibility check failed with HTTP ${verification.response.status}`);
}
if (!verification.body || typeof verification.body !== 'object'
    || !verification.body.data || typeof verification.body.data.status !== 'string') {
  throw new Error('HUQAN verify compatibility check returned an invalid envelope.');
}

console.log(`HUQAN_RUNTIME_COMPATIBILITY=PASS status=${verification.body.data.status}`);
