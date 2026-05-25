import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import client from 'prom-client'

// Create a Registry to register metrics
const register = new client.Registry()

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register })

// Custom metrics for our API
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
})

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
})

const urlsCreatedTotal = new client.Counter({
  name: 'urls_created_total',
  help: 'Total number of shortened URLs created'
})

const urlRedirectsTotal = new client.Counter({
  name: 'url_redirects_total',
  help: 'Total number of URL redirects'
})

// Register custom metrics
register.registerMetric(httpRequestDuration)
register.registerMetric(httpRequestTotal)
register.registerMetric(urlsCreatedTotal)
register.registerMetric(urlRedirectsTotal)

// Export metrics for use in routes
export const metrics = {
  httpRequestDuration,
  httpRequestTotal,
  urlsCreatedTotal,
  urlRedirectsTotal
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
