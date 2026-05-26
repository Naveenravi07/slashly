import geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';
import { PrismaClient } from '../generated/prisma/client';

export class AnalyticsProcessor {
  constructor(private prisma: PrismaClient) {}

  async processEvent(data: {
    urlId: string;
    slug: string;
    ipAddress?: string;
    userAgent?: string;
    referer?: string;
    timestamp: string;
  }): Promise<void> {
    const urlId = BigInt(data.urlId);
    
    // Parse geolocation from IP
    let country: string | null = null;
    let city: string | null = null;
    
    if (data.ipAddress) {
      const geo = geoip.lookup(data.ipAddress);
      if (geo) {
        country = geo.country;
        city = geo.city;
      }
    }

    // Parse user agent
    let deviceType: string | null = null;
    let browser: string | null = null;
    let os: string | null = null;

    if (data.userAgent) {
      const parser = new UAParser(data.userAgent);
      const result = parser.getResult();
      
      deviceType = result.device.type || 'desktop';
      browser = result.browser.name || null;
      os = result.os.name || null;
    }

    // Store analytics
    await this.prisma.urlAnalytics.create({
      data: {
        url_id: urlId,
        ip_address: data.ipAddress || null,
        user_agent: data.userAgent || null,
        referer: data.referer || null,
        country,
        city,
        device_type: deviceType,
        browser,
        os,
        clicked_at: new Date(data.timestamp),
      },
    });

    console.log(`✅ Processed analytics for slug: ${data.slug}`);
  }
}
