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

    const urlRecord = await server.prisma.url.create({
      data: {
        original_url: url,
        slug: '',
      },
    });

    const slug = encodeBase62(urlRecord.id);
    
    await server.prisma.url.update({
      where: { id: urlRecord.id },
      data: { slug },
    });

    // Track URL creation metric
    server.metrics.urlsCreatedTotal.inc()

    return { slug, short_url: `${process.env.SERVER_URL || 'http://localhost:8080'}/s/${slug}` };
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
      return reply.code(404).send({ error: 'URL not found' });
    }

    // Track redirect metric
    server.metrics.urlRedirectsTotal.inc()

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
};

export default urlShortenerRoutes;
