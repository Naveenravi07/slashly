import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const writeCounter = new Counter('write_requests');
const readCounter = new Counter('read_requests');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Setup phase - runs once before the test
export function setup() {
  console.log('Fetching URLs from API...');
  
  let allSlugs = [];
  const limit = 100;
  
  for (let offset = 0; offset < 500; offset += limit) {
    const response = http.get(`${BASE_URL}/urls?limit=${limit}&offset=${offset}`);
    
    if (response.status !== 200) {
      console.error(`Failed to fetch URLs: ${response.status}`);
      break;
    }
    
    const data = JSON.parse(response.body);
    const slugs = data.urls.map(url => url.slug);
    
    allSlugs = allSlugs.concat(slugs);
    
    console.log(`Fetched ${slugs.length} URLs (offset: ${offset}, total: ${allSlugs.length})`);
    
    if (slugs.length < limit) {
      break;
    }
  }
  
  if (allSlugs.length === 0) {
    console.log('No URLs found! Creating 100 URLs for testing...');
    
    for (let i = 0; i < 100; i++) {
      const payload = JSON.stringify({
        url: `https://example.com/initial-${i}-${Date.now()}`,
      });
      
      const res = http.post(`${BASE_URL}/shorten`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (res.status === 200) {
        const data = JSON.parse(res.body);
        allSlugs.push(data.slug);
      }
    }
    
    console.log(`Created ${allSlugs.length} URLs for testing`);
  }
  
  console.log(`Loaded ${allSlugs.length} URLs for testing`);
  return { slugs: allSlugs };
}

export const options = {
  stages: [
    { duration: '1m', target: 100 },
    { duration: '3m', target: 300 },
    { duration: '1m', target: 500 },   // Spike test
    { duration: '2m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.1'],
  },
};


export default function (data) {
  // 80% reads, 20% writes (typical URL shortener ratio)
  const isWrite = Math.random() < 0.2;
  
  if (isWrite) {
    // Write operation
    const payload = JSON.stringify({
      url: `https://example.com/page-${Date.now()}-${Math.random()}`,
    });

    const res = http.post(`${BASE_URL}/shorten`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    
    const success = check(res, {
      'write: status ok': (r) => r.status === 200 || r.status === 201,
    });

    writeCounter.add(1);
    errorRate.add(!success);
    
  } else {
    // Read operation - use existing slugs
    const shortCode = data.slugs[Math.floor(Math.random() * data.slugs.length)];
    
    const res = http.get(`${BASE_URL}/s/${shortCode}`, {
      redirects: 0,
    });
    
    const success = check(res, {
      'read: status ok': (r) => r.status === 301 || r.status === 302,
    });

    readCounter.add(1);
    errorRate.add(!success);
  }
  
  sleep(Math.random() * 2); // Random think time 0-2s
}
