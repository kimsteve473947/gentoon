import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

// ⚡ DIRECT_URL 우선 사용 (RLS 우회를 위한 service role 권한)
// Fallback: DATABASE_URL (로컬 개발용)
const databaseUrl = process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:@rlawndgnl0206@lzxkvtwuatsrczhctsxb.supabase.co:5432/postgres";

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