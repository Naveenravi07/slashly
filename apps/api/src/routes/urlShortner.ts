import { FastifyPluginAsync } from 'fastify';
import { encodeBase62, decodeBase62 } from '../utils/base62';
import dotenv from "dotenv"

dotenv.config({})

const urlShortenerRoutes: FastifyPluginAsync = async (server) => {

  server.post('/shorten', async (request, reply) => {
    const { url } = request.body as { url: string };
    
    if (!url) {
      return reply.code(400).send({ error: 'URL is required' });
    }
    const urlRecord = await server.prisma.url.create({
      data: {
        original_url: url,
        slug: '',
      },
    });

    const slug = encodeBase62(urlRecord.id);
    
    const updatedRecord = await server.prisma.url.update({
      where: { id: urlRecord.id },
      data: { slug },
    });

    return { slug, short_url: `${process.env.SERVER_URL}/s/${slug}` };
  });


  server.get('/s/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const urlRecord = await server.prisma.url.findUnique({
      where: { slug },
    });

    if (!urlRecord) {
      return reply.code(404).send({ error: 'URL not found' });
    }

    return reply.redirect(urlRecord.original_url, 301);
  });


  server.get('/info/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const urlRecord = await server.prisma.url.findUnique({
      where: { slug },
    });

    if (!urlRecord) {
      return reply.code(404).send({ error: 'URL not found' });
    }

    return {
      slug: urlRecord.slug,
      original_url: urlRecord.original_url,
      created_at: urlRecord.created_at,
    };
  });
};

export default urlShortenerRoutes;
