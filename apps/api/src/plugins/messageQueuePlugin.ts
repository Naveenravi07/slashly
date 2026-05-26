import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { MessageQueue } from '../services/messageQueue';

declare module 'fastify' {
  interface FastifyInstance {
    messageQueue: MessageQueue;
  }
}

const messageQueuePlugin: FastifyPluginAsync = async (server) => {
  const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672';
  const messageQueue = new MessageQueue(rabbitmqUrl);
  
  await messageQueue.connect();
  
  server.decorate('messageQueue', messageQueue);

  server.addHook('onClose', async () => {
    await messageQueue.close();
  });
};

export default fp(messageQueuePlugin);
