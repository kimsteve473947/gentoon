import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

// Supabase 연결 설정 (MCP와 동일한 직접 연결 방식)
const databaseUrl = process.env.DATABASE_URL || 
  "postgresql://postgres.lzxkvtwuatsrczhctsxb:@rlawndgnl0206@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true";

console.log('🔗 Prisma DATABASE_URL:', databaseUrl.substring(0, 50) + '...');

export const prisma = global.prisma || new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn', 'info'] : ['error'],
  errorFormat: 'pretty'
});

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}