import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import client from 'prom-client'

// Create a Registry to register metrics
const register = new client.Registry()

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register })

// Custom metrics for our API

// HTTP Metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
})

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
})

// Business Metrics
const urlsCreatedTotal = new client.Counter({
  name: 'urls_created_total',
  help: 'Total number of shortened URLs created'
})

const urlRedirectsTotal = new client.Counter({
  name: 'url_redirects_total',
  help: 'Total number of URL redirects'
})

const urlNotFoundTotal = new client.Counter({
  name: 'url_not_found_total',
  help: 'Total number of 404 errors for URL lookups'
})

const activeUrlsGauge = new client.Gauge({
  name: 'active_urls_total',
  help: 'Total number of active shortened URLs in database'
})

// Analytics Metrics
const analyticsEventsPublished = new client.Counter({
  name: 'analytics_events_published_total',
  help: 'Total number of analytics events published to queue'
})

const analyticsEventsProcessed = new client.Counter({
  name: 'analytics_events_processed_total',
  help: 'Total number of analytics events successfully processed'
})

const analyticsEventsFailed = new client.Counter({
  name: 'analytics_events_failed_total',
  help: 'Total number of analytics events that failed processing'
})

const analyticsQueueDepth = new client.Gauge({
  name: 'analytics_queue_depth',
  help: 'Current number of messages in analytics queue'
})

const analyticsProcessingDuration = new client.Histogram({
  name: 'analytics_processing_duration_seconds',
  help: 'Duration of analytics event processing',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
})

// Database Metrics
const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
})

const dbQueryTotal = new client.Counter({
  name: 'db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status']
})

// Error Metrics
const errorTotal = new client.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'route']
})

// Register custom metrics
register.registerMetric(httpRequestDuration)
register.registerMetric(httpRequestTotal)
register.registerMetric(urlsCreatedTotal)
register.registerMetric(urlRedirectsTotal)
register.registerMetric(urlNotFoundTotal)
register.registerMetric(activeUrlsGauge)
register.registerMetric(analyticsEventsPublished)
register.registerMetric(analyticsEventsProcessed)
register.registerMetric(analyticsEventsFailed)
register.registerMetric(analyticsQueueDepth)
register.registerMetric(analyticsProcessingDuration)
register.registerMetric(dbQueryDuration)
register.registerMetric(dbQueryTotal)
register.registerMetric(errorTotal)

// Export metrics for use in routes
export const metrics = {
  httpRequestDuration,
  httpRequestTotal,
  urlsCreatedTotal,
  urlRedirectsTotal,
  urlNotFoundTotal,
  activeUrlsGauge,
  analyticsEventsPublished,
  analyticsEventsProcessed,
  analyticsEventsFailed,
  analyticsQueueDepth,
  analyticsProcessingDuration,
  dbQueryDuration,
  dbQueryTotal,
  errorTotal
}

const metricsPlugin: FastifyPluginAsync = fp(async (server) => {
  // Add metrics endpoint
  server.get('/metrics', async (request, reply) => {
    reply.type('text/plain')
    return register.metrics()
  })

  // Add hook to track all requests
  server.addHook('onRequest', async (request) => {
    request.startTime = Date.now()
  })

  server.addHook('onResponse', async (request, reply) => {
    const duration = (Date.now() - (request.startTime || Date.now())) / 1000
    const route = request.routeOptions.url || request.url
    
    httpRequestDuration.observe(
      {
        method: request.method,
        route,
        status_code: reply.statusCode
      },
      duration
    )

    httpRequestTotal.inc({
      method: request.method,
      route,
      status_code: reply.statusCode
    })
  })

  // Periodic task to update active URLs gauge (every 60 seconds)
  const updateActiveUrlsGauge = async () => {
    try {
      const count = await server.prismaRead.url.count();
      activeUrlsGauge.set(count);
    } catch (error) {
      console.error('Failed to update active URLs gauge:', error);
    }
  };

  // Update immediately and then every 60 seconds
  updateActiveUrlsGauge();
  const intervalId = setInterval(updateActiveUrlsGauge, 60000);

  // Clean up interval on server close
  server.addHook('onClose', async () => {
    clearInterval(intervalId);
  });

  // Decorate server with metrics
  server.decorate('metrics', metrics)
})

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    metrics: typeof metrics
  }
  interface FastifyRequest {
    startTime?: number
  }
}

export default metricsPlugin
