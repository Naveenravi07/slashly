import amqp, { Channel } from 'amqplib';

export class MessageQueue {
  private connection: any = null;
  private channel: Channel | null = null;
  private readonly url: string;
  
  constructor(url: string) {
    this.url = url;
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();
      
      // Declare analytics queue
      await this.channel.assertQueue('analytics', { durable: true });
      
      console.log('✅ Connected to RabbitMQ');
    } catch (error) {
      console.error('❌ Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  async publishAnalyticsEvent(data: {
    urlId: bigint;
    slug: string;
    ipAddress?: string;
    userAgent?: string;
    referer?: string;
  }): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    const message = JSON.stringify({
      ...data,
      urlId: data.urlId.toString(), // Convert BigInt to string for JSON
      timestamp: new Date().toISOString(),
    });

    this.channel.sendToQueue('analytics', Buffer.from(message), {
      persistent: true,
    });
  }

  async consumeAnalytics(handler: (data: any) => Promise<void>): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    await this.channel.prefetch(10); // Process 10 messages at a time
    
    this.channel.consume('analytics', async (msg) => {
      if (msg) {
        try {
          const data = JSON.parse(msg.content.toString());
          await handler(data);
          this.channel!.ack(msg);
        } catch (error) {
          console.error('Error processing analytics message:', error);
          // Reject and requeue on error
          this.channel!.nack(msg, false, true);
        }
      }
    });

    console.log('📊 Analytics worker started, waiting for messages...');
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}
