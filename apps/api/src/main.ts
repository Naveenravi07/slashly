import fastify from 'fastify'
import prismaPlugin from './plugins/prismaPlgin'
import urlShortenerRoutes from './routes/urlShortner'

const server = fastify()


server.get('/ping', async (request, reply) => {
  return 'pong\n'
})

server.register(prismaPlugin)
server.register(urlShortenerRoutes)

server.listen({ port: 8080, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  console.log(`Server listening at ${address}`)
})