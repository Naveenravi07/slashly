import { PrismaClient } from './generated/prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { MessageQueue } from './services/messageQueue';
import { AnalyticsProcessor } from './services/analyticsProcessor';
import dotenv from 'dotenv';

dotenv.config();

async function startWorker() {
  // Initialize Prisma
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // Initialize message queue
  const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672';
  const messageQueue = new MessageQueue(rabbitmqUrl);
  await messageQueue.connect();

  // Initialize analytics processor
  const analyticsProcessor = new AnalyticsProcessor(prisma);

  // Start consuming messages
  await messageQueue.consumeAnalytics(async (data) => {
    await analyticsProcessor.processEvent(data);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down worker...');
    await messageQueue.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

startWorker().catch((error) => {
  console.error('Failed to start worker:', error);
  process.exit(1);
});
