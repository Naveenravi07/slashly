import { FastifyPluginAsync } from 'fastify';
import { Type, Static } from '@sinclair/typebox';
import { encodeBase62 } from '../utils/base62';

const ShortenBodySchema = Type.Object({
  url: Type.String({ format: 'uri', minLength: 1 })
});

const SlugParamsSchema = Type.Object({
  slug: Type.String({ minLength: 1 })
});

const ListQuerySchema = Type.Object({
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 10 })),
  offset: Type.Optional(Type.Number({ minimum: 0, default: 0 }))
});

type ShortenBody = Static<typeof ShortenBodySchema>;
type SlugParams = Static<typeof SlugParamsSchema>;
type ListQuery = Static<typeof ListQuerySchema>;

const urlShortenerRoutes: FastifyPluginAsync = async (server) => {
  server.get<{ Querystring: ListQuery }>('/urls', {
    schema: {
      tags: ['url'],
      description: 'List all shortened URLs with pagination',
      querystring: ListQuerySchema,
      response: {
        200: Type.Object({
          urls: Type.Array(Type.Object({
            slug: Type.String(),
            original_url: Type.String(),
            created_at: Type.String({ format: 'date-time' })
          })),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number()
        })
      }
    }
  }, async (request, reply) => {
    const { limit = 10, offset = 0 } = request.query;

    const [urls, total] = await Promise.all([
      server.prismaRead.url.findMany({
        take: limit,
        skip: offset,
        orderBy: { created_at: 'desc' }
      }),
      server.prismaRead.url.count()
    ]);

    return {
      urls: urls.map(url => ({
        slug: url.slug,
        original_url: url.original_url,
        created_at: url.created_at.toISOString()
      })),
      total,
      limit,
      offset
    };
  });

  server.post<{ Body: ShortenBody }>('/shorten', {
    schema: {
      tags: ['url'],
      description: 'Create a shortened URL',
      body: ShortenBodySchema,
      response: {
        200: Type.Object({
          slug: Type.String(),
          short_url: Type.String()
        }),
        400: Type.Object({
          error: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { url } = request.body;

    // Use a transaction to ensure atomicity
    const result = await server.prisma.$transaction(async (tx) => {
      // Check if URL already exists with a valid slug
      const existingUrl = await tx.url.findFirst({
        where: { 
          original_url: url,
          slug: { not: { startsWith: 'temp_' } }
        },
      });

      if (existingUrl) {
        return existingUrl;
      }

      // Create URL with a temporary unique slug
      const tempSlug = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const urlRecord = await tx.url.create({
        data: {
          original_url: url,
          slug: tempSlug,
        },
      });

      const slug = encodeBase62(urlRecord.id);
      
      // Update with the final slug
      const updatedUrl = await tx.url.update({
        where: { id: urlRecord.id },
        data: { slug },
      });

      return updatedUrl;
    });

    // Track URL creation metric (only if it's a new URL)
    if (!result.slug.startsWith('temp_')) {
      server.metrics.urlsCreatedTotal.inc();
    }

    return { 
      slug: result.slug, 
      short_url: `${process.env.SERVER_URL || 'http://localhost:8080'}/s/${result.slug}` 
    };
  });

  server.get<{ Params: SlugParams }>('/s/:slug', {
    schema: {
      tags: ['url'],
      description: 'Redirect to the original URL',
      params: SlugParamsSchema,
      response: {
        404: Type.Object({
          error: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { slug } = request.params;

    const urlRecord = await server.prismaRead.url.findUnique({
      where: { slug },
    });

    if (!urlRecord) {
      server.metrics.urlNotFoundTotal.inc();
      return reply.code(404).send({ error: 'URL not found' });
    }

    // Track redirect metric
    server.metrics.urlRedirectsTotal.inc()

    // Increment published metric BEFORE publishing
    // This ensures published >= processed (no race condition)
    server.metrics.analyticsEventsPublished.inc();

    // Publish analytics event to queue (non-blocking)
    const ipAddress = (Array.isArray(request.headers['x-forwarded-for']) 
      ? request.headers['x-forwarded-for'][0] 
      : request.headers['x-forwarded-for']) || 
      (Array.isArray(request.headers['x-real-ip']) 
        ? request.headers['x-real-ip'][0] 
        : request.headers['x-real-ip']) || 
      request.ip;
    const userAgent = Array.isArray(request.headers['user-agent']) 
      ? request.headers['user-agent'][0] 
      : request.headers['user-agent'];
    const referer = (Array.isArray(request.headers['referer']) 
      ? request.headers['referer'][0] 
      : request.headers['referer']) || 
      (Array.isArray(request.headers['referrer']) 
        ? request.headers['referrer'][0] 
        : request.headers['referrer']);

    server.messageQueue.publishAnalyticsEvent({
      urlId: urlRecord.id,
      slug: urlRecord.slug,
      ipAddress,
      userAgent,
      referer,
    }).catch(err => {
      console.error('Failed to publish analytics event:', err);
      server.metrics.errorTotal.inc({ type: 'analytics_publish', route: '/s/:slug' });
    });

    return reply.redirect(urlRecord.original_url, 301);
  });

  server.get<{ Params: SlugParams }>('/info/:slug', {
    schema: {
      tags: ['url'],
      description: 'Get information about a shortened URL',
      params: SlugParamsSchema,
      response: {
        200: Type.Object({
          slug: Type.String(),
          original_url: Type.String(),
          created_at: Type.String({ format: 'date-time' })
        }),
        404: Type.Object({
          error: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { slug } = request.params;

    const urlRecord = await server.prismaRead.url.findUnique({
      where: { slug },
    });

    if (!urlRecord) {
      return reply.code(404).send({ error: 'URL not found' });
    }

    return {
      slug: urlRecord.slug,
      original_url: urlRecord.original_url,
      created_at: urlRecord.created_at.toISOString(),
    };
  });

  server.get<{ Params: SlugParams }>('/analytics/:slug', {
    schema: {
      tags: ['analytics'],
      description: 'Get analytics summary for a shortened URL',
      params: SlugParamsSchema,
      response: {
        200: Type.Object({
          slug: Type.String(),
          total_clicks: Type.Number(),
          unique_ips: Type.Number(),
          top_countries: Type.Array(Type.Object({
            country: Type.String(),
            count: Type.Number()
          })),
          top_devices: Type.Array(Type.Object({
            device_type: Type.String(),
            count: Type.Number()
          })),
          top_browsers: Type.Array(Type.Object({
            browser: Type.String(),
            count: Type.Number()
          })),
          top_referers: Type.Array(Type.Object({
            referer: Type.String(),
            count: Type.Number()
          }))
        }),
        404: Type.Object({
          error: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { slug } = request.params;

    const urlRecord = await server.prismaRead.url.findUnique({
      where: { slug },
    });

    if (!urlRecord) {
      return reply.code(404).send({ error: 'URL not found' });
    }

    // Get analytics data
    const analytics = await server.prismaRead.urlAnalytics.findMany({
      where: { url_id: urlRecord.id },
    });

    const totalClicks = analytics.length;
    const uniqueIps = new Set(analytics.map(a => a.ip_address).filter(Boolean)).size;

    // Aggregate by country
    const countryMap = new Map<string, number>();
    analytics.forEach(a => {
      if (a.country) {
        countryMap.set(a.country, (countryMap.get(a.country) || 0) + 1);
      }
    });
    const topCountries = Array.from(countryMap.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Aggregate by device
    const deviceMap = new Map<string, number>();
    analytics.forEach(a => {
      if (a.device_type) {
        deviceMap.set(a.device_type, (deviceMap.get(a.device_type) || 0) + 1);
      }
    });
    const topDevices = Array.from(deviceMap.entries())
      .map(([device_type, count]) => ({ device_type, count }))
      .sort((a, b) => b.count - a.count);

    // Aggregate by browser
    const browserMap = new Map<string, number>();
    analytics.forEach(a => {
      if (a.browser) {
        browserMap.set(a.browser, (browserMap.get(a.browser) || 0) + 1);
      }
    });
    const topBrowsers = Array.from(browserMap.entries())
      .map(([browser, count]) => ({ browser, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Aggregate by referer
    const refererMap = new Map<string, number>();
    analytics.forEach(a => {
      if (a.referer) {
        refererMap.set(a.referer, (refererMap.get(a.referer) || 0) + 1);
      }
    });
    const topReferers = Array.from(refererMap.entries())
      .map(([referer, count]) => ({ referer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      slug,
      total_clicks: totalClicks,
      unique_ips: uniqueIps,
      top_countries: topCountries,
      top_devices: topDevices,
      top_browsers: topBrowsers,
      top_referers: topReferers,
    };
  });

  server.get<{ Params: SlugParams, Querystring: { days?: number } }>('/analytics/:slug/timeline', {
    schema: {
      tags: ['analytics'],
      description: 'Get click timeline for a shortened URL',
      params: SlugParamsSchema,
      querystring: Type.Object({
        days: Type.Optional(Type.Number({ minimum: 1, maximum: 365, default: 30 }))
      }),
      response: {
        200: Type.Object({
          slug: Type.String(),
          timeline: Type.Array(Type.Object({
            date: Type.String(),
            clicks: Type.Number()
          }))
        }),
        404: Type.Object({
          error: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { slug } = request.params;
    const { days = 30 } = request.query;

    const urlRecord = await server.prismaRead.url.findUnique({
      where: { slug },
    });

    if (!urlRecord) {
      return reply.code(404).send({ error: 'URL not found' });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const analytics = await server.prismaRead.urlAnalytics.findMany({
      where: {
        url_id: urlRecord.id,
        clicked_at: {
          gte: startDate,
        },
      },
      orderBy: {
        clicked_at: 'asc',
      },
    });

    // Group by date
    const dateMap = new Map<string, number>();
    analytics.forEach(a => {
      const date = a.clicked_at.toISOString().split('T')[0];
      dateMap.set(date, (dateMap.get(date) || 0) + 1);
    });

    const timeline = Array.from(dateMap.entries())
      .map(([date, clicks]) => ({ date, clicks }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      slug,
      timeline,
    };
  });
};

export default urlShortenerRoutes;
