/**
 * Test script for server.js endpoints, security and AI generation
 */
import http from 'http';

function doRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function testServer() {
  console.log('Testing server running on port 3000...');

  // 1. Test Static index.html
  const r1 = await doRequest({ hostname: 'localhost', port: 3000, path: '/', method: 'GET' });
  console.log('GET / -> Status:', r1.status, 'Has html:', r1.body.includes('TOEIC Master'));

  // 2. Test Safe API Data fetch
  const r2 = await doRequest({ hostname: 'localhost', port: 3000, path: '/api/data?file=reading/part-5.json', method: 'GET' });
  console.log('GET /api/data?file=reading/part-5.json -> Status:', r2.status, 'Is JSON:', r2.headers['content-type']?.includes('json'));

  // 3. Test Path Traversal Protection
  const r3 = await doRequest({ hostname: 'localhost', port: 3000, path: '/api/data?file=../../package.json', method: 'GET' });
  console.log('GET /api/data?file=../../package.json -> Status:', r3.status, '(Expected 403 Forbidden)');

  // 4. Test AI Generator in Mock Mode
  const postPayload = JSON.stringify({
    skill: 'reading',
    part: 5,
    topic: 'business',
    targetScore: '450-650',
    count: 2,
    language: 'vi',
    useMock: true
  });
  const r4 = await doRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/ai-generate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postPayload)
    }
  }, postPayload);
  console.log('POST /api/ai-generate (Mock) -> Status:', r4.status);
  try {
    const parsed = JSON.parse(r4.body);
    console.log('  Items returned:', parsed.items?.length, 'isMock:', parsed.isMock);
  } catch (e) {
    console.log('  Raw body:', r4.body);
  }

  process.exit(0);
}

testServer().catch(err => {
  console.error('Server test error:', err.message);
  process.exit(1);
});
