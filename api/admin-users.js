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

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    sendJson(response, 405, { error: 'Metodo nao permitido.' })
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    sendJson(response, 500, {
      error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY na Vercel.',
    })
    return
  }

  const authHeader = request.headers.authorization ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token) {
    sendJson(response, 401, { error: 'Sessao em falta.' })
    return
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(token)

  if (userError || !user) {
    sendJson(response, 401, { error: 'Sessao invalida.' })
    return
  }

  const { data: requesterProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || requesterProfile?.role !== 'admin') {
    sendJson(response, 403, { error: 'Apenas administradores podem criar utilizadores.' })
    return
  }

  try {
    const body = await readBody(request)
    const email = String(body.email ?? '').toLowerCase()
    const password = String(body.password ?? '')
    const fullName = String(body.fullName ?? '')

    if (!email || !password || !fullName) {
      sendJson(response, 400, { error: 'Nome, email e palavra-passe sao obrigatorios.' })
      return
    }

    if (password.length < 6) {
      sendJson(response, 400, { error: 'A palavra-passe deve ter pelo menos 6 caracteres.' })
      return
    }

    const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    })

    if (createError || !createdUser.user) {
      sendJson(response, 400, {
        error: createError?.message ?? 'Nao foi possivel criar o utilizador.',
      })
      return
    }

    const { data: profile, error: upsertError } = await adminClient
      .from('profiles')
      .upsert({
        id: createdUser.user.id,
        email,
        full_name: fullName,
        role: 'admin',
      })
      .select('id, email, full_name, role, created_at, updated_at')
      .single()

    if (upsertError) {
      sendJson(response, 400, { error: upsertError.message })
      return
    }

    sendJson(response, 200, { profile })
  } catch {
    sendJson(response, 400, { error: 'Pedido invalido.' })
  }
}
