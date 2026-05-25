import { createClient } from '@supabase/supabase-js'

const profileColumns = 'id, email, full_name, role, created_at, updated_at'
const fallbackProfileColumns = 'id, full_name, role, created_at, updated_at'
const allowedRoles = new Set(['admin', 'manager', 'member'])

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

const getErrorMessage = (error) => {
  if (!error) return ''
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error

  if (typeof error === 'object') {
    const parts = [
      error.message,
      error.error_description,
      error.error,
      error.details,
      error.hint,
    ].filter((part, index, list) => typeof part === 'string' && part.length > 0 && list.indexOf(part) === index)

    if (parts.length > 0) return parts.join(' ')
    if (typeof error.code === 'string') return error.code
  }

  return String(error)
}

const isMissingEmailColumnError = (error) => {
  const message = getErrorMessage(error).toLowerCase()
  return (
    message.includes('profiles.email') ||
    (message.includes('column') && message.includes('email') && message.includes('does not exist'))
  )
}

const createAdminClient = (response) => {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    sendJson(response, 500, {
      error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY na Vercel.',
    })
    return null
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

const requireUser = async (request, response, adminClient) => {
  const authHeader = request.headers.authorization ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token) {
    sendJson(response, 401, { error: 'Sessao em falta.' })
    return null
  }

  const {
    data: { user },
    error,
  } = await adminClient.auth.getUser(token)

  if (error || !user) {
    sendJson(response, 401, { error: 'Sessao invalida.' })
    return null
  }

  return user
}

const upsertProfile = async (adminClient, profile) => {
  const { data, error } = await adminClient
    .from('profiles')
    .upsert(profile, { onConflict: 'id' })
    .select(profileColumns)
    .single()

  if (!error) return data

  if (!isMissingEmailColumnError(error)) throw error

  const { email: _email, ...fallbackProfile } = profile
  const { data: fallbackData, error: fallbackError } = await adminClient
    .from('profiles')
    .upsert(fallbackProfile, { onConflict: 'id' })
    .select(fallbackProfileColumns)
    .single()

  if (fallbackError) throw fallbackError

  return {
    ...fallbackData,
    email: profile.email ?? null,
  }
}

const ensureRequesterProfile = async (adminClient, user) => {
  const fullName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null

  await upsertProfile(adminClient, {
    id: user.id,
    email: user.email ?? null,
    full_name: fullName,
    role: 'admin',
  })
}

const getAuthUserEmails = async (adminClient) => {
  const emails = new Map()

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 })

    if (error) return emails

    const users = data?.users ?? []
    users.forEach((user) => {
      if (user.email) emails.set(user.id, user.email)
    })

    if (users.length < 1000) return emails
  }

  return emails
}

const listProfiles = async (adminClient) => {
  const emails = await getAuthUserEmails(adminClient)
  const { data, error } = await adminClient
    .from('profiles')
    .select(profileColumns)
    .order('created_at', { ascending: true })

  if (!error) {
    return (data ?? []).map((profile) => ({
      ...profile,
      email: profile.email ?? emails.get(profile.id) ?? null,
    }))
  }

  if (!isMissingEmailColumnError(error)) throw error

  const { data: fallbackData, error: fallbackError } = await adminClient
    .from('profiles')
    .select(fallbackProfileColumns)
    .order('created_at', { ascending: true })

  if (fallbackError) throw fallbackError

  return (fallbackData ?? []).map((profile) => ({
    ...profile,
    email: emails.get(profile.id) ?? null,
  }))
}

const updateProfileRole = async (adminClient, profileId, role) => {
  const { data, error } = await adminClient
    .from('profiles')
    .update({ role })
    .eq('id', profileId)
    .select(profileColumns)
    .single()

  if (!error) return data
  if (!isMissingEmailColumnError(error)) throw error

  const { data: fallbackData, error: fallbackError } = await adminClient
    .from('profiles')
    .update({ role })
    .eq('id', profileId)
    .select(fallbackProfileColumns)
    .single()

  if (fallbackError) throw fallbackError

  return {
    ...fallbackData,
    email: null,
  }
}

export default async function handler(request, response) {
  if (!['GET', 'POST', 'PATCH'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST, PATCH')
    sendJson(response, 405, { error: 'Metodo nao permitido.' })
    return
  }

  const adminClient = createAdminClient(response)
  if (!adminClient) return

  const user = await requireUser(request, response, adminClient)
  if (!user) return

  try {
    await ensureRequesterProfile(adminClient, user)

    if (request.method === 'GET') {
      sendJson(response, 200, { profiles: await listProfiles(adminClient) })
      return
    }

    const body = await readBody(request)

    if (request.method === 'PATCH') {
      const profileId = String(body.profileId ?? '')
      const role = String(body.role ?? '')

      if (!profileId || !allowedRoles.has(role)) {
        sendJson(response, 400, { error: 'Utilizador ou permissao invalida.' })
        return
      }

      sendJson(response, 200, { profile: await updateProfileRole(adminClient, profileId, role) })
      return
    }

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

    const profile = await upsertProfile(adminClient, {
      id: createdUser.user.id,
      email,
      full_name: fullName,
      role: 'admin',
    })

    sendJson(response, 200, { profile })
  } catch (error) {
    sendJson(response, 400, { error: getErrorMessage(error) || 'Pedido invalido.' })
  }
}
