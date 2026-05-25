import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { PrismaClient } from '../generated/prisma/client/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
    prismaRead: PrismaClient
  }
}

const prismaPlugin: FastifyPluginAsync = fp(async (server) => {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/slashly'
  const readReplicaUrl = process.env.DATABASE_READ_REPLICA_URL || connectionString
  
  console.log('Connecting to primary database:', connectionString)
  console.log('Connecting to read replica:', readReplicaUrl)
  
  // Primary database connection (for writes)
  const primaryPool = new pg.Pool({ 
    connectionString,
  })
  
  const primaryAdapter = new PrismaPg(primaryPool)
  const prisma = new PrismaClient({ adapter: primaryAdapter })

  await prisma.$connect()
  console.log('Primary Prisma connected successfully')

  // Read replica connection (for reads)
  const readPool = new pg.Pool({ 
    connectionString: readReplicaUrl,
  })
  
  const readAdapter = new PrismaPg(readPool)
  const prismaRead = new PrismaClient({ adapter: readAdapter })

  await prismaRead.$connect()
  console.log('Read replica Prisma connected successfully')

  server.decorate('prisma', prisma)
  server.decorate('prismaRead', prismaRead)

  server.addHook('onClose', async (server) => {
    await server.prisma.$disconnect()
    await server.prismaRead.$disconnect()
    await primaryPool.end()
    await readPool.end()
  })
})

export default prismaPlugin