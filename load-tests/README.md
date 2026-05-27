# Load Testing Guide

## Setup

Install k6:
```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker
docker pull grafana/k6
```

## Running Tests

### Write Load Test (URL Creation)
```bash
k6 run --env BASE_URL=http://localhost load-tests/write-load-test.js
```

### Read Load Test (URL Redirects)
```bash
# First, populate some URLs in your system, then update shortCodes array in the script
k6 run --env BASE_URL=http://localhost load-tests/read-load-test.js
```

### Mixed Load Test (80% reads, 20% writes)
```bash
k6 run --env BASE_URL=http://localhost load-tests/mixed-load-test.js
```

### With Docker
```bash
docker run --rm -i --network=host grafana/k6 run --env BASE_URL=http://localhost - < load-tests/mixed-load-test.js
```

## Monitoring During Tests

Watch your Grafana dashboard at `http://localhost:3000` to see:
- Request rate
- Response times (P50, P95, P99)
- Error rates
- Database connections
- Cache hit rates
- Message queue depth

## Test Scenarios

### Smoke Test (Quick validation)
```bash
k6 run --vus 1 --duration 30s load-tests/mixed-load-test.js
```

### Load Test (Expected traffic)
```bash
k6 run --vus 100 --duration 5m load-tests/mixed-load-test.js
```

### Stress Test (Find breaking point)
```bash
k6 run --vus 500 --duration 10m load-tests/mixed-load-test.js
```

### Spike Test (Sudden traffic surge)
```bash
k6 run --stage 0s:0,10s:1000,1m:1000,10s:0 load-tests/mixed-load-test.js
```

## What to Watch For

- **Response Time Degradation**: When does P95 latency spike?
- **Error Rate**: At what load do errors start appearing?
- **Database Bottlenecks**: Connection pool exhaustion?
- **Cache Effectiveness**: Hit rate under load?
- **Message Queue Lag**: Is Kafka/RabbitMQ keeping up?
- **Read Replica Lag**: How far behind are replicas?

## Tips

1. Start small (10-50 VUs) and gradually increase
2. Monitor system resources (CPU, memory, disk I/O)
3. Check database slow query logs
4. Watch for connection pool exhaustion
5. Verify your message queue isn't backing up
