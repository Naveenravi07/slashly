import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

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
    console.error('No URLs found! Make sure to create some URLs first.');
    console.log('Run: k6 run write-load-test.js');
    throw new Error('No URLs available for testing');
  }
  
  console.log(`Loaded ${allSlugs.length} URLs for testing`);
  return { slugs: allSlugs };
}

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up
    { duration: '2m', target: 200 },   // Normal load
    { duration: '1m', target: 500 },   // Peak load
    { duration: '2m', target: 200 },   // Scale down
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'], // Reads should be faster
    errors: ['rate<0.05'], // Lower error tolerance for reads
  },
};

export default function (data) {
  // Simulate read traffic (URL redirects)
  const shortCode = data.slugs[Math.floor(Math.random() * data.slugs.length)];
  
  const res = http.get(`${BASE_URL}/s/${shortCode}`, {
    redirects: 0, // Don't follow redirects, just check response
  });
  
  const success = check(res, {
    'status is 301 or 302': (r) => r.status === 301 || r.status === 302,
    'has location header': (r) => r.headers['Location'] !== undefined,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });

  errorRate.add(!success);
  
  sleep(0.5); // Shorter think time for read-heavy workload
}
