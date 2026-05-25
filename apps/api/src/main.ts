import fastify from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import prismaPlugin from './plugins/prismaPlgin'
import metricsPlugin from './plugins/metricsPlugin'
import urlShortenerRoutes from './routes/urlShortner'

const server = fastify()

// Register metrics plugin first
server.register(metricsPlugin)

server.register(swagger, {
  openapi: {
    info: {
      title: 'Slashly URL Shortener API',
      description: 'API for shortening URLs with Base62 encoding',
      version: '1.0.0'
    },
    servers: [
      {
        url: 'http://localhost:8080',
        description: 'Development server'
      }
    ],
    tags: [
      { name: 'url', description: 'URL shortening endpoints' }
    ]
  }
})

server.register(swaggerUI, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false
  }
})

server.get('/ping', async () => {
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
  console.log(`Swagger docs available at ${address}/docs`)
  console.log(`Metrics available at ${address}/metrics`)
})