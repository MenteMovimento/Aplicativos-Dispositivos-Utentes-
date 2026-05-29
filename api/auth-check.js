import { createClient } from '@supabase/supabase-js'

const sendJson = (response, status, body) => {
  response.status(status).json(body)
}

const readBody = async (request) => {
  if (request.body && typeof request.body === 'object') {
    return request.body
  }

  if (typeof request.body === 'string') {
    return request.body ? JSON.parse(request.body) : {}
  }

  const chunks = []

  for await (const chunk of request) {
    chunks.push(chunk)
  }

  const rawBody = Buffer.concat(chunks).toString('utf8')
  return rawBody ? JSON.parse(rawBody) : {}
}

const authUserExists = async (client, email) => {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 })

    if (error) return false

    const users = data?.users ?? []
    if (users.some((user) => user.email?.toLowerCase() === email)) {
      return true
    }

    if (users.length < 1000) return false
  }

  return false
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    sendJson(response, 405, { error: 'Metodo nao permitido.' })
    return
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    sendJson(response, 200, { canCheck: false, exists: false })
    return
  }

  try {
    const body = await readBody(request)
    const email = String(body.email ?? '').toLowerCase()

    if (!email) {
      sendJson(response, 200, { canCheck: true, exists: false })
      return
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: profile, error } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (error) {
      sendJson(response, 200, {
        canCheck: true,
        exists: await authUserExists(adminClient, email),
      })
      return
    }

    sendJson(response, 200, {
      canCheck: true,
      exists: Boolean(profile) || (await authUserExists(adminClient, email)),
    })
  } catch {
    sendJson(response, 200, { canCheck: false, exists: false })
  }
}
