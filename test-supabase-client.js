import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lzxkvtwuatsrczhctsxb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6eGt2dHd1YXRzcmN6aGN0c3hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyNTQzMzIsImV4cCI6MjA3MjgzMDMzMn0.aj3h4C4TvTBvM3iNbxQR-xOXVcZJs4ayorqF48nIr94'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase client connection...')
    
    // Test basic connection
    const { data, error } = await supabase.from('_supabase_version').select('*').limit(1)
    
    if (error && error.code !== 'PGRST116') {
      console.log('Testing with a simple query instead...')
      // Try a different approach - get current timestamp
      const { data: timestampData, error: timestampError } = await supabase.rpc('now')
      
      if (timestampError) {
        console.error('❌ Supabase connection failed:', timestampError.message)
      } else {
        console.log('✅ Supabase client connection successful!')
      }
    } else {
      console.log('✅ Supabase client connection successful!')
    }

    // Test auth
    console.log('\n🔐 Testing auth service...')
    const { data: authData, error: authError } = await supabase.auth.getSession()
    if (authError) {
      console.log('Auth service available but no session')
    } else {
      console.log('Auth service is working')
    }

    // List available tables
    console.log('\n📋 Checking available tables...')
    const { data: tablesData, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
    
    if (tablesData && tablesData.length > 0) {
      console.log('Available tables:')
      tablesData.forEach(table => {
        console.log(`  - ${table.table_name}`)
      })
    } else {
      console.log('No public tables found or unable to access schema info')
    }

  } catch (error) {
    console.error('❌ Connection test failed:', error.message)
  }
}

testSupabaseConnection()