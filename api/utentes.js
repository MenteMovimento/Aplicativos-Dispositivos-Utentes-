import { createClient } from '@supabase/supabase-js'

const utenteColumns =
  'id, nome, data_nascimento, telefone, email, morada, numero_utente, nif, contacto_emergencia, estado, observacoes, created_at, updated_at'

const stripOuterWhitespace = (value) => value.replace(/^\s+|\s+$/g, '')

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

const createAdminClient = (response) => {
  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    sendJson(response, 500, {
      error: 'Falta configurar as variaveis Supabase na Vercel.',
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

const optionalText = (value) => {
  const text = stripOuterWhitespace(String(value ?? ''))
  return text || null
}

const requiredText = (value) => stripOuterWhitespace(String(value ?? ''))

const buildUtentePayload = (body, now) => ({
  nome: requiredText(body.nome),
  data_nascimento: optionalText(body.data_nascimento),
  telefone: optionalText(body.telefone),
  email: optionalText(body.email)?.toLowerCase() ?? null,
  morada: optionalText(body.morada),
  numero_utente: optionalText(body.numero_utente),
  nif: optionalText(body.nif),
  contacto_emergencia: optionalText(body.contacto_emergencia),
  estado: optionalText(body.estado) ?? 'Ativo',
  observacoes: optionalText(body.observacoes),
  updated_at: now,
})

const recordHistory = async (adminClient, user, action, targetId, details) => {
  try {
    await adminClient.from('historico').insert({
      utilizador_id: null,
      utilizador_nome: user.email ?? 'Utilizador autenticado',
      acao: action,
      alvo_tipo: 'utente',
      alvo_id: targetId,
      detalhes: details,
      created_at: new Date().toISOString(),
    })
  } catch {
    // Historico dos utentes e opcional ate o SQL respetivo existir.
  }
}

const getUtente = async (adminClient, id) => {
  const { data, error } = await adminClient
    .from('utentes')
    .select(utenteColumns)
    .eq('id', id)
    .single()

  if (error) throw error

  return data
}

export default async function handler(request, response) {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST, PATCH, DELETE')
    sendJson(response, 405, { error: 'Metodo nao permitido.' })
    return
  }

  const adminClient = createAdminClient(response)
  if (!adminClient) return

  const user = await requireUser(request, response, adminClient)
  if (!user) return

  try {
    if (request.method === 'GET') {
      const search = stripOuterWhitespace(String(request.query?.search ?? ''))
      let query = adminClient
        .from('utentes')
        .select(utenteColumns)
        .order('updated_at', { ascending: false })
        .limit(500)

      if (search) {
        const safeSearch = search.replace(/[%(),]/g, '')
        query = query.or(
          `nome.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,telefone.ilike.%${safeSearch}%,numero_utente.ilike.%${safeSearch}%,nif.ilike.%${safeSearch}%`,
        )
      }

      const { data, error } = await query

      if (error) throw error

      sendJson(response, 200, { utentes: data ?? [] })
      return
    }

    const body = await readBody(request)

    if (request.method === 'POST') {
      const now = new Date().toISOString()
      const payload = {
        ...buildUtentePayload(body, now),
        created_at: now,
      }

      if (!payload.nome) {
        sendJson(response, 400, { error: 'O nome do utente e obrigatorio.' })
        return
      }

      const { data, error } = await adminClient
        .from('utentes')
        .insert(payload)
        .select(utenteColumns)
        .single()

      if (error) throw error

      await recordHistory(adminClient, user, 'Criar utente', data.id, data.nome)
      sendJson(response, 200, { utente: data })
      return
    }

    const id = Number(body.id)

    if (!Number.isFinite(id)) {
      sendJson(response, 400, { error: 'Utente invalido.' })
      return
    }

    if (request.method === 'PATCH') {
      const payload = buildUtentePayload(body, new Date().toISOString())

      if (!payload.nome) {
        sendJson(response, 400, { error: 'O nome do utente e obrigatorio.' })
        return
      }

      const { data, error } = await adminClient
        .from('utentes')
        .update(payload)
        .eq('id', id)
        .select(utenteColumns)
        .single()

      if (error) throw error

      await recordHistory(adminClient, user, 'Atualizar utente', data.id, data.nome)
      sendJson(response, 200, { utente: data })
      return
    }

    const existing = await getUtente(adminClient, id)
    const { error } = await adminClient.from('utentes').delete().eq('id', id)

    if (error) throw error

    await recordHistory(adminClient, user, 'Eliminar utente', id, existing.nome)
    sendJson(response, 200, { ok: true })
  } catch (error) {
    sendJson(response, 400, {
      error:
        getErrorMessage(error) ||
        'Nao foi possivel gerir utentes. Confirma se apps/utentes/supabase_schema.sql foi executado.',
    })
  }
}
