import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function validateApiKey(headers) {
  const apiKey = headers['x-api-key']
  if (!apiKey) return null

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('api_key', apiKey)
    .single()

  if (error || !data) return null
  return data
}
