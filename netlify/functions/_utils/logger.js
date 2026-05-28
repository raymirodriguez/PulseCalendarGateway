import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function log({ clientId, type, payload, response, error }) {
  try {
    await supabase.from('logs').insert({
      client_id: clientId ?? null,
      type,
      payload: payload ?? null,
      response: response ?? null,
      error: error
        ? typeof error === 'string'
          ? error
          : error.message
        : null,
    })
  } catch (err) {
    console.error('[PCG logger] failed to write log:', err.message)
  }
}
