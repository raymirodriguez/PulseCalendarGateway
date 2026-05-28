import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function getClientConfig(clientId) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  if (error || !data) throw new Error(`Client not found: ${clientId}`)
  return data
}

export async function getClientByAssistantId(assistantId) {
  if (!assistantId) return null
  const { data } = await supabase
    .from('clients')
    .select('*')
    .eq('assistant_id', assistantId)
    .single()
  return data ?? null
}
