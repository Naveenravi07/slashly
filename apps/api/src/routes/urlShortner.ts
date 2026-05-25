import { FastifyPluginAsync } from 'fastify';
import { Type, Static } from '@sinclair/typebox';
import { encodeBase62 } from '../utils/base62';

const ShortenBodySchema = Type.Object({
  url: Type.String({ format: 'uri', minLength: 1 })
});

const SlugParamsSchema = Type.Object({
  slug: Type.String({ minLength: 1 })
});

type ShortenBody = Static<typeof ShortenBodySchema>;
type SlugParams = Static<typeof SlugParamsSchema>;

const urlShortenerRoutes: FastifyPluginAsync = async (server) => {
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

    const urlRecord = await server.prisma.url.findUnique({
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

    const urlRecord = await server.prisma.url.findUnique({
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
