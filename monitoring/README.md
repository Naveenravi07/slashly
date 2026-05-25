# Monitoring Setup Guide

## What is this?

This monitoring stack helps you understand how your URL shortener is performing:

- **Prometheus**: Collects metrics (numbers) from your API every 10-15 seconds
- **Grafana**: Shows those metrics in beautiful graphs and dashboards

## What metrics are we tracking?

### Automatic Metrics (from prom-client):
- CPU usage
- Memory usage  
- Event loop lag
- Active handles

### Custom Metrics (we added these):
1. **http_requests_total**: How many requests each endpoint receives
2. **http_request_duration_seconds**: How long requests take to complete
3. **urls_created_total**: Total shortened URLs created
4. **url_redirects_total**: Total redirects performed

## How to use

### 1. Start everything:
```bash
docker-compose up --build
```

### 2. Access the services:

- **Your API**: http://localhost:8080
- **API Metrics**: http://localhost:8080/metrics (raw Prometheus format)
- **Prometheus UI**: http://localhost:9090
- **Grafana**: http://localhost:3000
  - Username: `admin`
  - Password: `admin`

### 3. View metrics in Prometheus:

1. Go to http://localhost:9090
2. Click "Graph" at the top
3. Try these queries:
   - `http_requests_total` - See all requests
   - `rate(http_requests_total[1m])` - Requests per second
   - `urls_created_total` - Total URLs created
   - `url_redirects_total` - Total redirects

### 4. View dashboards in Grafana:

1. Go to http://localhost:3000
2. Login with admin/admin
3. Go to "Dashboards" → "Slashly URL Shortener"
4. You'll see:
   - Request rate graph
   - Total URLs created
   - Total redirects
   - Response time percentiles

## Understanding the metrics

### Request Rate
Shows how many requests per second your API is handling. Higher = busier API.

### Response Time (95th percentile)
95% of requests complete faster than this time. Lower is better.
- < 100ms: Excellent
- 100-500ms: Good
- > 1s: Needs optimization

### URLs Created / Redirects
Counters that only go up. Shows total activity over time.

## File Structure

```
monitoring/
├── prometheus.yml              # Tells Prometheus where to find metrics
├── grafana/
│   ├── datasources/
│   │   └── prometheus.yml     # Connects Grafana to Prometheus
│   └── dashboards/
│       ├── dashboard.yml      # Tells Grafana where dashboards are
│       └── slashly-dashboard.json  # The actual dashboard
└── README.md                  # This file
```

## Troubleshooting

### Prometheus shows "DOWN" for api target:
- Check if API containers are running: `docker ps`
- Check API logs: `docker-compose logs api`
- Verify metrics endpoint works: `curl http://localhost:8080/metrics`

### Grafana shows "No data":
- Check if Prometheus is collecting data (go to Prometheus UI)
- Verify datasource is configured (Grafana → Configuration → Data Sources)
- Make some API requests to generate metrics

### Want to add more metrics?
Edit `apps/api/src/plugins/metricsPlugin.ts` and add new Counter, Gauge, or Histogram metrics.
