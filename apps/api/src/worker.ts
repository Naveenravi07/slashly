import { PrismaClient } from './generated/prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { MessageQueue } from './services/messageQueue';
import { AnalyticsProcessor } from './services/analyticsProcessor';
import dotenv from 'dotenv';
import fastify from 'fastify';
import client from 'prom-client';

dotenv.config();

// Create a Registry for worker metrics
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Worker-specific metrics
const analyticsEventsProcessed = new client.Counter({
  name: 'analytics_events_processed_total',
  help: 'Total number of analytics events successfully processed',
  registers: [register]
});

const analyticsEventsFailed = new client.Counter({
  name: 'analytics_events_failed_total',
  help: 'Total number of analytics events that failed processing',
  registers: [register]
});

const analyticsProcessingDuration = new client.Histogram({
  name: 'analytics_processing_duration_seconds',
  help: 'Duration of analytics event processing',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

const analyticsWorkerConcurrency = new client.Gauge({
  name: 'analytics_worker_concurrency',
  help: 'Current number of events being processed by this worker instance',
  registers: [register]
});

const workerMetrics = {
  analyticsEventsProcessed,
  analyticsEventsFailed,
  analyticsProcessingDuration,
  analyticsWorkerConcurrency
};

async function startWorker() {
  // Initialize Prisma
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // Initialize message queue
  const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672';
  const messageQueue = new MessageQueue(rabbitmqUrl);
  await messageQueue.connect();

  // Initialize analytics processor with metrics
  const analyticsProcessor = new AnalyticsProcessor(prisma, workerMetrics);

  // Start metrics server on a different port
  const metricsServer = fastify();
  metricsServer.get('/metrics', async (request, reply) => {
    reply.type('text/plain');
    return register.metrics();
  });

  metricsServer.get('/health', async () => {
    return { status: 'ok', worker: 'analytics' };
  });

  await metricsServer.listen({ port: 8081, host: '0.0.0.0' });
  console.log('📊 Worker metrics available at http://0.0.0.0:8081/metrics');

  // Start consuming messages
  await messageQueue.consumeAnalytics(async (data) => {
    analyticsWorkerConcurrency.inc();
    
    try {
      await analyticsProcessor.processEvent(data);
    } finally {
      analyticsWorkerConcurrency.dec();
    }
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down worker...');
    await messageQueue.close();
    await metricsServer.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

startWorker().catch((error) => {
  console.error('Failed to start worker:', error);
  process.exit(1);
});
