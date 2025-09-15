#!/bin/bash

# Vercel 환경 변수 설정 스크립트

echo "Adding environment variables to Vercel..."

# Google AI API Key
echo "AIzaSyAif-ezEb80ozFmXAtZ148XXg29NZZJ8ls" | vercel env add GOOGLE_AI_API_KEY production

# Supabase Configuration
echo "https://lzxkvtwuatsrczhctsxb.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL production
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6eGt2dHd1YXRzcmN6aGN0c3hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyNTQzMzIsImV4cCI6MjA3MjgzMDMzMn0.aj3h4C4TvTBvM3iNbxQR-xOXVcZJs4ayorqF48nIr94" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6eGt2dHd1YXRzcmN6aGN0c3hiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI1NDMzMiwiZXhwIjoyMDcyODMwMzMyfQ.qWdvXnKCyGuG7xPSeYRWZge5iplRQw4Y9j4De_gjW_k" | vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Database URL
echo "postgresql://postgres:@rlawndgnl0206@db.lzxkvtwuatsrczhctsxb.supabase.co:5432/postgres" | vercel env add DATABASE_URL production

# Toss Payments
echo "test_ck_Poxy1XQL8RJo12Y4P0eN87nO5Wml" | vercel env add NEXT_PUBLIC_TOSS_CLIENT_KEY production
echo "test_sk_XZYkKL4MrjBP5P6aMPpAr0zJwlEW" | vercel env add TOSS_SECRET_KEY production

# App URL (임시)
echo "https://gentoon-saas.vercel.app" | vercel env add NEXT_PUBLIC_APP_URL production

echo "Environment variables added successfully!"