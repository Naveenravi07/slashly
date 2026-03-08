import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { PrismaClient } from '../generated/prisma/client/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
  }
}

const prismaPlugin: FastifyPluginAsync = fp(async (server) => {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/slashly'
  
  console.log('Connecting to database with:', connectionString)
  
  const pool = new pg.Pool({ 
    connectionString,
  })
  
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  await prisma.$connect()
  
  console.log('Prisma connected successfully')

  server.decorate('prisma', prisma)

  server.addHook('onClose', async (server) => {
    await server.prisma.$disconnect()
    await pool.end()
  })
})

export default prismaPlugin