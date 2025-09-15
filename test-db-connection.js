const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
})

async function testConnection() {
  try {
    console.log('Testing database connection...')
    
    // Simple connection test
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log('✅ Database connection successful!')
    console.log('Database version:', result[0].version)
    
    // Test if tables exist
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `
    console.log('\n📋 Current tables in database:')
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`)
    })
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()