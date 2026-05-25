import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { parse, unparse } from 'papaparse'
import {
  BookOpen,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Download,
  Edit3,
  KeyRound,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react'
import './App.css'
import { BrandLogo } from './components/BrandLogo'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import {
  csvRowToDeviceForm,
  deviceToCsvRow,
  deviceToForm,
  emptyRepairDetails,
  encodeRepairDetails,
  formToRepairDetails,
  getRepairTableValue,
  parseCsvStatus,
  repairCsvHeaders,
  repairFormSections,
  repairTableColumns,
} from './repairInventory'
import type { Device, DeviceForm, DeviceStatus, RepairColumnKey, Profile } from './types'

const deviceStatuses: DeviceStatus[] = ['active', 'maintenance', 'retired']
const memberRoles: Profile['role'][] = ['admin', 'manager', 'member']

const statusLabels: Record<DeviceStatus, string> = {
  active: 'Ativo',
  maintenance: 'Manutencao',
  retired: 'Arquivado',
}

const roleLabels: Record<Profile['role'], string> = {
  admin: 'Administrador',
  manager: 'Gestor',
  member: 'Membro',
}

const authEmailCooldownSeconds = 60
const authCooldownStorageKey = 'mentemovimento-auth-email-cooldowns'

const stripOuterWhitespace = (value: string) => value.replace(/^\s+|\s+$/g, '')
const normalizeEmail = (value: string) => value.toLowerCase()

type AuthCooldownAction = 'signup' | 'resend'

const getCooldowns = () => {
  try {
    return JSON.parse(window.localStorage.getItem(authCooldownStorageKey) ?? '{}') as Record<
      string,
      number
    >
  } catch {
    return {}
  }
}

const getCooldownKey = (action: AuthCooldownAction, email: string) =>
  `${action}:${normalizeEmail(email)}`

const getCooldownUntil = (action: AuthCooldownAction, email: string) =>
  getCooldowns()[getCooldownKey(action, email)] ?? 0

const setCooldownUntil = (action: AuthCooldownAction, email: string) => {
  const cooldowns = getCooldowns()
  const nextUntil = Date.now() + authEmailCooldownSeconds * 1000

  cooldowns[getCooldownKey(action, email)] = nextUntil
  window.localStorage.setItem(authCooldownStorageKey, JSON.stringify(cooldowns))

  return nextUntil
}

const getRemainingSeconds = (until: number, now: number) =>
  Math.max(0, Math.ceil((until - now) / 1000))

const getErrorMessage = (error: unknown) => {
  if (!error) return ''
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error

  if (typeof error === 'object') {
    const source = error as {
      code?: unknown
      details?: unknown
      error?: unknown
      error_description?: unknown
      hint?: unknown
      message?: unknown
    }
    const parts = [
      source.message,
      source.error_description,
      source.error,
      source.details,
      source.hint,
    ]
      .filter((part): part is string => typeof part === 'string' && part.length > 0)
      .filter((part, index, list) => list.indexOf(part) === index)

    if (parts.length > 0) return parts.join(' ')
    if (typeof source.code === 'string') return source.code
  }

  return String(error)
}

const getErrorStatus = (error: unknown) => {
  if (!error || typeof error !== 'object' || !('status' in error)) return undefined

  const status = (error as { status?: unknown }).status
  return typeof status === 'number' ? status : undefined
}

const isEmailRateLimitError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase()
  return getErrorStatus(error) === 429 || message.includes('email rate limit')
}

const isEmailNotConfirmedError = (error: unknown) =>
  getErrorMessage(error).toLowerCase().includes('email not confirmed')

const isExistingAccountError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase()
  return message.includes('already registered') || message.includes('already exists')
}

const getFriendlyAuthError = (error: unknown) => {
  if (isEmailRateLimitError(error)) {
    return 'O Supabase bloqueou temporariamente o envio de emails. Aguarda alguns minutos antes de pedir outro email de confirmacao.'
  }

  if (isEmailNotConfirmedError(error)) {
    return 'Este email ja tem conta, mas ainda precisa de confirmacao. Confirma no email ou usa Reenviar confirmacao.'
  }

  const message = getErrorMessage(error)
  if (message.toLowerCase().includes('invalid login credentials')) {
    return 'Email ou palavra-passe incorretos.'
  }

  if (message.toLowerCase().includes('email logins are disabled')) {
    return 'O login por email esta desativado no Supabase. Ativa o provider Email em Authentication > Providers.'
  }

  return message || 'Nao foi possivel autenticar.'
}

const isMissingEmailColumnError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase()
  return (
    message.includes('profiles.email') ||
    (message.includes('schema cache') &&
      message.includes('email') &&
      message.includes('profiles')) ||
    (message.includes('column') && message.includes('email') && message.includes('does not exist'))
  )
}

const getFriendlyDataError = (error: unknown) => {
  const message = getErrorMessage(error)
  const lowerMessage = message.toLowerCase()

  if (isMissingEmailColumnError(error)) {
    return 'A base de dados ainda nao foi atualizada para a gestao de utilizadores. Executa o ficheiro supabase/user-management.sql no SQL Editor do Supabase.'
  }

  if (lowerMessage.includes('row-level security') || lowerMessage.includes('permission denied')) {
    return 'O Supabase bloqueou o pedido por permissoes/RLS. Executa supabase/user-management.sql e volta a entrar na conta.'
  }

  if (lowerMessage.includes('relation') && lowerMessage.includes('does not exist')) {
    return 'A tabela necessaria ainda nao existe no Supabase. Executa o schema SQL do projeto no SQL Editor.'
  }

  if (lowerMessage.includes('jwt') && lowerMessage.includes('expired')) {
    return 'A tua sessao expirou. Sai e volta a entrar.'
  }

  return message || 'Nao foi possivel carregar os dados.'
}

const manualSections = [
  {
    title: '1. Entrar no sistema',
    steps: [
      'Abre o site da Vercel e entra com o email e palavra-passe criados no Supabase.',
      'Se ja existir uma sessao ativa, o site abre diretamente no painel.',
      'Se o email ja estiver registado, usa Entrar em vez de criar conta novamente.',
      'Se o Supabase pedir confirmacao, usa o botao Reenviar confirmacao apenas depois do cooldown.',
      'Todos os utilizadores autenticados conseguem gerir dispositivos e abrir a area Utilizadores.',
    ],
  },
  {
    title: '2. Criar um dispositivo',
    steps: [
      'No painel Novo dispositivo, preenche pelo menos ID, Modelo e Nº Série.',
      'Usa as secoes Identificação, Hardware e sistema, Diagnóstico e reparação, Configuração e contas.',
      'Clica em Adicionar dispositivo para guardar na base de dados.',
    ],
  },
  {
    title: '3. Editar ou desativar',
    steps: [
      'Na tabela, clica no icone de lapis da linha que queres alterar.',
      'Altera os campos necessarios e clica em Guardar alterações.',
      'Para deixar desativo, escreve Arquivado ou Abate no campo Estado da secao Diagnóstico e reparação.',
    ],
  },
  {
    title: '4. Importar do Google Sheets',
    steps: [
      'No Google Sheets, vai a Ficheiro > Transferir > Valores separados por virgulas (.csv).',
      'No site, clica em Importar CSV e escolhe o ficheiro exportado.',
      'A importação usa o Nº Série para atualizar dispositivos existentes sem duplicar.',
      'As colunas principais esperadas sao ID, Data Entrada, Marca, Modelo, Nº Série, CPU, RAM, Disco, Estado e Observações.',
    ],
  },
  {
    title: '5. Exportar para Google Sheets',
    steps: [
      'Clica em Exportar CSV para baixar a lista visivel na tabela.',
      'No Google Sheets, importa ou abre esse ficheiro CSV.',
      'Se usares pesquisa ou filtro antes de exportar, so os registos visiveis serao exportados.',
    ],
  },
  {
    title: '6. Apagar registos',
    steps: [
      'Para apagar uma linha, usa o icone vermelho de lixo nessa linha.',
      'Para apagar tudo, usa Apagar tudo. O sistema pede confirmacao e exige escrever APAGAR.',
      'Depois de apagar tudo, a acao nao pode ser desfeita. Exporta um CSV antes se precisares de copia.',
    ],
  },
  {
    title: '7. Gerir utilizadores',
    steps: [
      'Entra com uma conta confirmada e abre a aba Utilizadores.',
      'Preenche nome, email e palavra-passe temporaria no formulario Criar utilizador.',
      'Todas as contas criadas nesta area entram automaticamente como Administrador.',
      'Na tabela, podes alterar a permissão para Administrador, Gestor ou Membro depois da criacao.',
      'A tua propria permissao fica bloqueada para evitar perderes acesso ao painel.',
    ],
  },
]

const emptyDeviceForm: DeviceForm = {
  name: '',
  serial_number: '',
  model: '',
  brand: '',
  status: 'active',
  repair: emptyRepairDetails,
}

const demoStorageKey = 'mentemovimento-demo-devices'
const demoProfilesStorageKey = 'mentemovimento-demo-profiles'

const initialDemoDevices: Device[] = [
  {
    id: 'demo-1',
    name: 'PC-RECECAO-01',
    serial_number: 'MM-PT-001',
    model: 'Lenovo ThinkPad T14',
    location: 'Rececao',
    status: 'active',
    notes: 'Registo de exemplo em modo demonstracao.',
    created_by: null,
    updated_by: null,
    created_at: '2026-05-22T09:00:00.000Z',
    updated_at: '2026-05-22T09:00:00.000Z',
  },
  {
    id: 'demo-2',
    name: 'TAB-SALA-02',
    serial_number: 'MM-TB-014',
    model: 'Samsung Galaxy Tab A9',
    location: 'Sala 2',
    status: 'maintenance',
    notes: 'Exemplo para testar filtros e edicao.',
    created_by: null,
    updated_by: null,
    created_at: '2026-05-21T14:30:00.000Z',
    updated_at: '2026-05-21T14:30:00.000Z',
  },
]

const initialDemoProfiles: Profile[] = [
  {
    id: 'demo-admin',
    email: 'admin.demo@mentemovimento.pt',
    full_name: 'Administrador demo',
    role: 'admin',
    created_at: '2026-05-22T09:00:00.000Z',
    updated_at: '2026-05-22T09:00:00.000Z',
  },
  {
    id: 'demo-manager',
    email: 'gestor.demo@mentemovimento.pt',
    full_name: 'Gestor demo',
    role: 'manager',
    created_at: '2026-05-22T09:20:00.000Z',
    updated_at: '2026-05-22T09:20:00.000Z',
  },
  {
    id: 'demo-member',
    email: 'membro.demo@mentemovimento.pt',
    full_name: 'Membro demo',
    role: 'member',
    created_at: '2026-05-22T09:40:00.000Z',
    updated_at: '2026-05-22T09:40:00.000Z',
  },
]

const createDemoId = () => globalThis.crypto?.randomUUID?.() ?? `demo-${Date.now()}`

const loadDemoDevices = () => {
  try {
    const storedDevices = window.localStorage.getItem(demoStorageKey)
    return storedDevices ? (JSON.parse(storedDevices) as Device[]) : initialDemoDevices
  } catch {
    return initialDemoDevices
  }
}

const persistDemoDevices = (nextDevices: Device[]) => {
  window.localStorage.setItem(demoStorageKey, JSON.stringify(nextDevices))
}

const loadDemoProfiles = () => {
  try {
    const storedProfiles = window.localStorage.getItem(demoProfilesStorageKey)
    return storedProfiles ? (JSON.parse(storedProfiles) as Profile[]) : initialDemoProfiles
  } catch {
    return initialDemoProfiles
  }
}

const persistDemoProfiles = (nextProfiles: Profile[]) => {
  window.localStorage.setItem(demoProfilesStorageKey, JSON.stringify(nextProfiles))
}

const formatProfileDate = (value?: string) => {
  if (!value) return 'N/A'

  return new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

const getProfileDisplayName = (userProfile: Profile) =>
  stripOuterWhitespace(userProfile.full_name ?? '') || 'Sem nome'

const emptyCreateUserForm = {
  fullName: '',
  email: '',
  password: '',
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>(() =>
    isSupabaseConfigured ? [] : loadDemoProfiles(),
  )
  const [devices, setDevices] = useState<Device[]>(() =>
    isSupabaseConfigured ? [] : loadDemoDevices(),
  )
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured)
  const [isUsersLoading, setIsUsersLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false)
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [authLoading, setAuthLoading] = useState(false)
  const [authClock, setAuthClock] = useState(() => Date.now())
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    fullName: '',
  })
  const [authError, setAuthError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState('')
  const [signupCooldownUntil, setSignupCooldownUntil] = useState(0)
  const [resendCooldownUntil, setResendCooldownUntil] = useState(0)
  const [deviceForm, setDeviceForm] = useState<DeviceForm>(emptyDeviceForm)
  const [createUserForm, setCreateUserForm] = useState(emptyCreateUserForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | DeviceStatus>('all')
  const [activeView, setActiveView] = useState<'devices' | 'users'>('devices')
  const [isManualOpen, setIsManualOpen] = useState(false)
  const csvInputRef = useRef<HTMLInputElement | null>(null)

  const isDemoMode = !isSupabaseConfigured
  const currentRole: Profile['role'] = isDemoMode ? 'admin' : (profile?.role ?? 'member')
  const currentProfileId = isDemoMode ? 'demo-admin' : profile?.id
  const currentEmail = session?.user.email ?? 'demo@mentemovimento.pt'
  const isAuthenticated = isDemoMode || Boolean(session)
  const canManageDevices = isAuthenticated
  const canManageUsers = isAuthenticated
  const selectedView = canManageUsers ? activeView : 'devices'
  const currentAuthEmail = normalizeEmail(authForm.email)
  const signupCooldownRemaining = getRemainingSeconds(signupCooldownUntil, authClock)
  const resendCooldownRemaining = getRemainingSeconds(resendCooldownUntil, authClock)

  const loadProfile = useCallback(async (userId: string, userEmail?: string | null) => {
    if (!supabase) return

    const fallbackProfile: Profile = {
      id: userId,
      email: userEmail ?? null,
      full_name: null,
      role: 'admin',
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', userId)
      .maybeSingle()

    if (error && isMissingEmailColumnError(error)) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', userId)
        .maybeSingle()

      if (fallbackError) {
        setProfile(fallbackProfile)
        return
      }

      setProfile(
        fallbackData
          ? ({
              ...(fallbackData as Omit<Profile, 'email'>),
              email: userEmail ?? null,
            } as Profile)
          : fallbackProfile,
      )
      return
    }

    if (error) {
      setProfile(fallbackProfile)
      return
    }

    setProfile((data as Profile | null) ?? fallbackProfile)
  }, [])

  const loadDevices = useCallback(async () => {
    if (!supabase) return

    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) throw error
    setDevices((data as Device[]) ?? [])
  }, [])

  const loadProfiles = useCallback(async () => {
    if (isDemoMode) {
      setProfiles(loadDemoProfiles())
      return
    }

    if (!session) return

    const response = await fetch('/api/admin-users', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })
    const result = (await response.json()) as { error?: string; profiles?: Profile[] }

    if (!response.ok || !result.profiles) {
      throw new Error(result.error ?? 'Nao foi possivel carregar os utilizadores.')
    }

    setProfiles(result.profiles)
  }, [isDemoMode, session])

  const refreshData = useCallback(
    async (currentSession: Session) => {
      setIsLoading(true)
      setAuthError(null)

      try {
        await loadProfile(currentSession.user.id, currentSession.user.email)
        await loadDevices()
      } catch (error) {
        setAuthError(getFriendlyDataError(error))
      } finally {
        setIsLoading(false)
      }
    },
    [loadDevices, loadProfile],
  )

  const refreshUsers = useCallback(async () => {
    if (!canManageUsers) return

    setIsUsersLoading(true)
    setAuthError(null)

    try {
      await loadProfiles()
    } catch (error) {
      setAuthError(getFriendlyDataError(error))
    } finally {
      setIsUsersLoading(false)
    }
  }, [canManageUsers, loadProfiles])

  useEffect(() => {
    if (!supabase) return

    let mounted = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return

      if (error) {
        setAuthError(error.message)
        setIsLoading(false)
        return
      }

      setSession(data.session)

      if (data.session) {
        void refreshData(data.session)
      } else {
        setIsLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)

      if (nextSession) {
        void refreshData(nextSession)
        return
      }

      setProfile(null)
      setProfiles([])
      setActiveView('devices')
      setDevices([])
      setIsLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [refreshData])

  useEffect(() => {
    const timer = window.setInterval(() => setAuthClock(Date.now()), 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!isManualOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsManualOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isManualOpen])

  const filteredDevices = useMemo(() => {
    const query = stripOuterWhitespace(searchTerm).toLowerCase()

    return devices.filter((device) => {
      const matchesStatus = statusFilter === 'all' || device.status === statusFilter
      const matchesSearch =
        query.length === 0 ||
        [device.name, device.serial_number, device.model, device.location ?? '', device.notes ?? '']
          .join(' ')
          .toLowerCase()
          .includes(query)

      return matchesStatus && matchesSearch
    })
  }, [devices, searchTerm, statusFilter])

  const totals = useMemo(
    () => ({
      all: devices.length,
      active: devices.filter((device) => device.status === 'active').length,
      maintenance: devices.filter((device) => device.status === 'maintenance').length,
      retired: devices.filter((device) => device.status === 'retired').length,
    }),
    [devices],
  )

  const checkEmailRegistered = useCallback(async (email: string) => {
    if (!email) return false

    try {
      const response = await fetch('/api/auth-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) return false

      const result = (await response.json()) as { canCheck?: boolean; exists?: boolean }
      return Boolean(result.canCheck && result.exists)
    } catch {
      return false
    }
  }, [])

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return

    const email = normalizeEmail(authForm.email)

    setAuthError(null)
    setNotice(null)
    setAuthLoading(true)

    try {
      const { data: existingSession } = await supabase.auth.getSession()

      if (existingSession.session) {
        setSession(existingSession.session)
        await refreshData(existingSession.session)
        setNotice('Sessao ja ativa. Entraste diretamente no painel.')
        return
      }

      if (authForm.password.length < 6) {
        throw new Error('A palavra-passe deve ter pelo menos 6 caracteres.')
      }

      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: authForm.password,
        })

        if (error) throw error
        setPendingConfirmationEmail('')
      } else {
        const storedSignupCooldown = getCooldownUntil('signup', email)
        setSignupCooldownUntil(storedSignupCooldown)

        if (getRemainingSeconds(storedSignupCooldown, Date.now()) > 0) {
          setPendingConfirmationEmail(email)
          setNotice(
            `Ja foi enviado um email de confirmacao recentemente. Aguarda ${getRemainingSeconds(
              storedSignupCooldown,
              Date.now(),
            )} segundos antes de tentar novamente.`,
          )
          return
        }

        const isRegistered = await checkEmailRegistered(email)

        if (isRegistered) {
          setAuthMode('login')
          setNotice('Este email ja esta registado. Usa Entrar para aceder.')
          return
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password: authForm.password,
          options: {
            data: {
              full_name: authForm.fullName,
            },
            emailRedirectTo: window.location.origin,
          },
        })

        if (error) throw error

        if (data.user?.identities && data.user.identities.length === 0) {
          setAuthMode('login')
          setNotice('Este email ja esta registado. Usa Entrar para aceder.')
          return
        }

        if (data.user && !data.session) {
          setPendingConfirmationEmail(email)
          setSignupCooldownUntil(setCooldownUntil('signup', email))
          setResendCooldownUntil(setCooldownUntil('resend', email))
          setNotice(
            'Conta criada. Confirma o email antes de entrar. Evitei novos envios automaticos para nao bater no limite do Supabase.',
          )
        } else {
          setPendingConfirmationEmail('')
          setNotice('Conta criada com sucesso.')
        }
      }
    } catch (error) {
      if (isExistingAccountError(error)) {
        setAuthMode('login')
        setNotice('Este email ja esta registado. Usa Entrar para aceder.')
        return
      }

      if (isEmailNotConfirmedError(error)) {
        setPendingConfirmationEmail(email)
        setResendCooldownUntil(getCooldownUntil('resend', email))
      }

      if (isEmailRateLimitError(error)) {
        setPendingConfirmationEmail(email)
        const nextCooldown = setCooldownUntil(authMode === 'signup' ? 'signup' : 'resend', email)
        setSignupCooldownUntil(nextCooldown)
        setResendCooldownUntil(nextCooldown)
      }

      setAuthError(getFriendlyAuthError(error))
    } finally {
      setAuthLoading(false)
    }
  }

  const resendConfirmationEmail = async () => {
    if (!supabase) return

    const email = pendingConfirmationEmail || currentAuthEmail
    const storedCooldown = getCooldownUntil('resend', email)
    const remaining = getRemainingSeconds(storedCooldown, Date.now())

    if (!email) {
      setAuthError('Indica o email antes de pedir nova confirmacao.')
      return
    }

    setResendCooldownUntil(storedCooldown)

    if (remaining > 0) {
      setNotice(`Aguarda ${remaining} segundos antes de reenviar o email de confirmacao.`)
      return
    }

    setIsResendingConfirmation(true)
    setAuthError(null)
    setNotice(null)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      })

      if (error) throw error

      setPendingConfirmationEmail(email)
      setResendCooldownUntil(setCooldownUntil('resend', email))
      setNotice('Email de confirmacao reenviado. Verifica a caixa de entrada e o spam.')
    } catch (error) {
      if (isEmailRateLimitError(error)) {
        const nextCooldown = setCooldownUntil('resend', email)
        setResendCooldownUntil(nextCooldown)
      }

      setAuthError(getFriendlyAuthError(error))
    } finally {
      setIsResendingConfirmation(false)
    }
  }

  const handleSignOut = async () => {
    if (isDemoMode) {
      setNotice('Modo demonstracao ativo. Configura o Supabase para usar login real.')
      return
    }

    if (!supabase) return

    await supabase.auth.signOut()
    setNotice(null)
    setAuthError(null)
    setPendingConfirmationEmail('')
    setDeviceForm(emptyDeviceForm)
    setEditingId(null)
  }

  const handleDeviceSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canManageDevices) return

    setIsSaving(true)
    setAuthError(null)
    setNotice(null)

    const repairDetails = formToRepairDetails(deviceForm)
    const payload = {
      name: stripOuterWhitespace(deviceForm.name),
      serial_number: stripOuterWhitespace(deviceForm.serial_number),
      model: stripOuterWhitespace(deviceForm.model),
      location: stripOuterWhitespace(deviceForm.brand) || null,
      status: parseCsvStatus(repairDetails.repair_status),
      notes: encodeRepairDetails(repairDetails),
      updated_by: session?.user.id ?? null,
    }

    try {
      if (!payload.name || !payload.serial_number || !payload.model) {
        throw new Error('Preenche o nome, numero de serie e modelo.')
      }

      if (isDemoMode) {
        const now = new Date().toISOString()

        if (editingId) {
          const nextDevices = devices.map((device) =>
            device.id === editingId
              ? {
                  ...device,
                  ...payload,
                  updated_at: now,
                }
              : device,
          )

          setDevices(nextDevices)
          persistDemoDevices(nextDevices)
          setNotice('Dispositivo atualizado em modo demonstracao.')
        } else {
          const nextDevice: Device = {
            id: createDemoId(),
            ...payload,
            created_by: null,
            created_at: now,
            updated_at: now,
          }
          const nextDevices = [nextDevice, ...devices]

          setDevices(nextDevices)
          persistDemoDevices(nextDevices)
          setNotice('Dispositivo adicionado em modo demonstracao.')
        }

        setDeviceForm(emptyDeviceForm)
        setEditingId(null)
        return
      }

      if (!supabase || !session) return

      if (editingId) {
        const { data, error } = await supabase
          .from('devices')
          .update(payload)
          .eq('id', editingId)
          .select()
          .single()

        if (error) throw error

        setDevices((currentDevices) =>
          currentDevices.map((device) => (device.id === editingId ? (data as Device) : device)),
        )
        setNotice('Dispositivo atualizado.')
      } else {
        const { data, error } = await supabase
          .from('devices')
          .insert({
            ...payload,
            created_by: session.user.id,
          })
          .select()
          .single()

        if (error) throw error

        setDevices((currentDevices) => [data as Device, ...currentDevices])
        setNotice('Dispositivo adicionado.')
      }

      setDeviceForm(emptyDeviceForm)
      setEditingId(null)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Nao foi possivel guardar.')
    } finally {
      setIsSaving(false)
    }
  }

  const startEditing = (device: Device) => {
    setEditingId(device.id)
    setDeviceForm(deviceToForm(device))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setDeviceForm(emptyDeviceForm)
  }

  const deleteDevice = async (device: Device) => {
    if (!canManageDevices) return

    const confirmed = window.confirm(`Apagar "${device.name}"?`)
    if (!confirmed) return

    setAuthError(null)
    setNotice(null)

    if (isDemoMode) {
      const nextDevices = devices.filter((item) => item.id !== device.id)
      setDevices(nextDevices)
      persistDemoDevices(nextDevices)

      if (editingId === device.id) {
        cancelEditing()
      }

      setNotice('Dispositivo apagado em modo demonstracao.')
      return
    }

    if (!supabase) return

    const { error } = await supabase.from('devices').delete().eq('id', device.id)

    if (error) {
      setAuthError(error.message)
      return
    }

    setDevices((currentDevices) => currentDevices.filter((item) => item.id !== device.id))

    if (editingId === device.id) {
      cancelEditing()
    }

    setNotice('Dispositivo apagado.')
  }

  const deleteAllDevices = async () => {
    if (!canManageDevices) return

    if (devices.length === 0) {
      setNotice('Nao ha dispositivos para apagar.')
      return
    }

    const firstConfirmation = window.confirm(
      `Vais apagar TODOS os ${devices.length} dispositivos. Esta acao nao pode ser desfeita. Continuar?`,
    )
    if (!firstConfirmation) return

    const typedConfirmation = window.prompt('Para confirmar, escreve APAGAR')
    if (typedConfirmation !== 'APAGAR') {
      setNotice('Eliminacao cancelada. Confirmacao incorreta.')
      return
    }

    setAuthError(null)
    setNotice(null)

    if (isDemoMode) {
      setDevices([])
      persistDemoDevices([])
      cancelEditing()
      setNotice('Todos os dispositivos foram apagados em modo demonstracao.')
      return
    }

    if (!supabase) return

    const { error } = await supabase
      .from('devices')
      .delete()
      .in(
        'id',
        devices.map((device) => device.id),
      )

    if (error) {
      setAuthError(error.message)
      return
    }

    setDevices([])
    cancelEditing()
    setNotice('Todos os dispositivos foram apagados.')
  }

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canManageUsers) return

    const payload = {
      fullName: stripOuterWhitespace(createUserForm.fullName),
      email: normalizeEmail(createUserForm.email),
      password: createUserForm.password,
    }

    setIsCreatingUser(true)
    setAuthError(null)
    setNotice(null)

    try {
      if (!payload.fullName || !payload.email || !payload.password) {
        throw new Error('Preenche nome, email e palavra-passe.')
      }

      if (payload.password.length < 6) {
        throw new Error('A palavra-passe deve ter pelo menos 6 caracteres.')
      }

      if (profiles.some((userProfile) => userProfile.email?.toLowerCase() === payload.email)) {
        throw new Error('Ja existe um utilizador com esse email.')
      }

      if (isDemoMode) {
        const now = new Date().toISOString()
        const nextProfile: Profile = {
          id: createDemoId(),
          email: payload.email,
          full_name: payload.fullName,
          role: 'admin',
          created_at: now,
          updated_at: now,
        }
        const nextProfiles = [...profiles, nextProfile]

        setProfiles(nextProfiles)
        persistDemoProfiles(nextProfiles)
        setCreateUserForm(emptyCreateUserForm)
        setNotice('Utilizador criado em modo demonstracao.')
        return
      }

      if (!session) return

      const response = await fetch('/api/admin-users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const result = (await response.json()) as { error?: string; profile?: Profile }

      if (!response.ok || !result.profile) {
        throw new Error(result.error ?? 'Nao foi possivel criar o utilizador.')
      }

      setProfiles((currentProfiles) => [...currentProfiles, result.profile as Profile])
      setCreateUserForm(emptyCreateUserForm)
      setNotice('Utilizador criado com a permissao definida.')
    } catch (error) {
      setAuthError(getFriendlyDataError(error))
    } finally {
      setIsCreatingUser(false)
    }
  }

  const updateProfileRole = async (targetProfile: Profile, nextRole: Profile['role']) => {
    if (!canManageUsers || targetProfile.role === nextRole) return

    if (targetProfile.id === currentProfileId) {
      setNotice('Nao podes alterar a permissao da tua propria conta.')
      return
    }

    setSavingProfileId(targetProfile.id)
    setAuthError(null)
    setNotice(null)

    try {
      if (isDemoMode) {
        const updatedAt = new Date().toISOString()
        const nextProfiles = profiles.map((item) =>
          item.id === targetProfile.id ? { ...item, role: nextRole, updated_at: updatedAt } : item,
        )

        setProfiles(nextProfiles)
        persistDemoProfiles(nextProfiles)
        setNotice(`Permissao de ${getProfileDisplayName(targetProfile)} atualizada.`)
        return
      }

      if (!session) return

      const response = await fetch('/api/admin-users', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileId: targetProfile.id,
          role: nextRole,
        }),
      })
      const result = (await response.json()) as { error?: string; profile?: Profile }

      if (!response.ok || !result.profile) {
        throw new Error(result.error ?? 'Nao foi possivel atualizar a permissao.')
      }

      const data = result.profile
      setProfiles((currentProfiles) =>
        currentProfiles.map((item) => (item.id === targetProfile.id ? (data as Profile) : item)),
      )
      setNotice(`Permissao de ${getProfileDisplayName(targetProfile)} atualizada.`)
    } catch (error) {
      setAuthError(getFriendlyDataError(error))
    } finally {
      setSavingProfileId(null)
    }
  }

  const exportDevicesCsv = () => {
    if (filteredDevices.length === 0) {
      setNotice('Nao ha dispositivos visiveis para exportar.')
      return
    }

    const csv = unparse(filteredDevices.map(deviceToCsvRow), {
      columns: repairCsvHeaders,
      quotes: true,
    })
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `dispositivos-mentemovimento-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
    setNotice('CSV exportado para abrir no Google Sheets.')
  }

  const importDevicesCsv = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file || !canManageDevices) return

    setIsImporting(true)
    setAuthError(null)
    setNotice(null)

    parse<Record<string, string | undefined>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          if (results.errors.length > 0) {
            throw new Error('O CSV tem linhas que nao foi possivel ler.')
          }

          const importedBySerial = new Map<string, DeviceForm>()

          results.data.forEach((row, index) => {
            const importedDevice = csvRowToDeviceForm(row)
            const hasAnyValue = Object.values(row).some((value) =>
              Boolean(stripOuterWhitespace(String(value ?? ''))),
            )

            if (!hasAnyValue) {
              return
            }

            if (!importedDevice.name || !importedDevice.serial_number || !importedDevice.model) {
              throw new Error(`Linha ${index + 2}: ID, Nº Série e Modelo sao obrigatorios.`)
            }

            importedBySerial.set(importedDevice.serial_number, importedDevice)
          })

          const importedDevices = Array.from(importedBySerial.values())

          if (importedDevices.length === 0) {
            throw new Error('O CSV nao tem dispositivos para importar.')
          }

          if (isDemoMode) {
            const now = new Date().toISOString()
            const nextDevicesBySerial = new Map(
              devices.map((device) => [device.serial_number, device] as const),
            )

            importedDevices.forEach((importedDevice) => {
              const existingDevice = nextDevicesBySerial.get(importedDevice.serial_number)

              nextDevicesBySerial.set(importedDevice.serial_number, {
                id: existingDevice?.id ?? createDemoId(),
                name: importedDevice.name,
                serial_number: importedDevice.serial_number,
                model: importedDevice.model,
                location: importedDevice.brand || null,
                status: parseCsvStatus(importedDevice.repair.repair_status),
                notes: encodeRepairDetails(formToRepairDetails(importedDevice)),
                created_by: existingDevice?.created_by ?? null,
                updated_by: null,
                created_at: existingDevice?.created_at ?? now,
                updated_at: now,
              })
            })

            const nextDevices = Array.from(nextDevicesBySerial.values()).sort((first, second) =>
              second.updated_at.localeCompare(first.updated_at),
            )

            setDevices(nextDevices)
            persistDemoDevices(nextDevices)
            setNotice(`${importedDevices.length} dispositivos importados do CSV.`)
            return
          }

          if (!supabase || !session) return

          const { error } = await supabase.from('devices').upsert(
            importedDevices.map((device) => ({
              name: device.name,
              serial_number: device.serial_number,
              model: device.model,
              location: device.brand || null,
              status: parseCsvStatus(device.repair.repair_status),
              notes: encodeRepairDetails(formToRepairDetails(device)),
              created_by: session.user.id,
              updated_by: session.user.id,
            })),
            { onConflict: 'serial_number' },
          )

          if (error) throw error

          await loadDevices()
          setNotice(`${importedDevices.length} dispositivos importados/atualizados.`)
        } catch (error) {
          setAuthError(error instanceof Error ? error.message : 'Nao foi possivel importar o CSV.')
        } finally {
          setIsImporting(false)
        }
      },
      error: (error) => {
        setAuthError(error.message)
        setIsImporting(false)
      },
    })
  }

  const updateRepairField = (key: RepairColumnKey, value: string) => {
    setDeviceForm((current) => ({
      ...current,
      status: key === 'repair_status' ? parseCsvStatus(value) : current.status,
      repair: {
        ...current.repair,
        [key]: value,
      },
    }))
  }

  const manualDialog = isManualOpen ? (
    <div
      className="manual-overlay"
      onClick={() => setIsManualOpen(false)}
      role="presentation"
    >
      <section
        className="manual-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="manual-header">
          <div>
            <p className="manual-kicker">Ajuda</p>
            <h2 id="manual-title">Manual de utilização</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => setIsManualOpen(false)}
            title="Fechar manual"
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="manual-body">
          {manualSections.map((section) => (
            <article className="manual-section" key={section.title}>
              <h3>{section.title}</h3>
              <ol>
                {section.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>
    </div>
  ) : null

  if (!isAuthenticated) {
    return (
      <main className="auth-shell">
        <section className="auth-panel" aria-labelledby="auth-title">
          <BrandLogo className="auth-logo" />
          <div>
            <h1 id="auth-title">Gestor de dispositivos</h1>
            <p className="auth-subtitle">Acesso interno da associacao</p>
            <button
              type="button"
              className="manual-button auth-manual-button"
              onClick={() => setIsManualOpen(true)}
              title="Abrir manual"
            >
              <BookOpen aria-hidden="true" />
              Manual
            </button>
          </div>

          <div className="mode-tabs" role="tablist" aria-label="Autenticacao">
            <button
              type="button"
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => {
                setAuthMode('login')
                setAuthError(null)
                setNotice(null)
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              className={authMode === 'signup' ? 'active' : ''}
              onClick={() => {
                setAuthMode('signup')
                setAuthError(null)
                setNotice(null)
                setSignupCooldownUntil(getCooldownUntil('signup', currentAuthEmail))
              }}
            >
              Criar conta
            </button>
          </div>

          <form className="stack-form" onSubmit={handleAuthSubmit}>
            {authMode === 'signup' && (
              <label>
                Nome
                <input
                  autoComplete="name"
                  value={authForm.fullName}
                  onChange={(event) =>
                    setAuthForm((current) => ({ ...current, fullName: event.target.value }))
                  }
                />
              </label>
            )}
            <label>
              Email
              <input
                required
                type="email"
                autoComplete="email"
                value={authForm.email}
                onChange={(event) => {
                  const nextEmail = normalizeEmail(event.target.value)

                  setAuthForm((current) => ({ ...current, email: event.target.value }))
                  setSignupCooldownUntil(getCooldownUntil('signup', nextEmail))
                  setResendCooldownUntil(getCooldownUntil('resend', nextEmail))
                }}
              />
            </label>
            <label>
              Palavra-passe
              <input
                required
                minLength={6}
                type="password"
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                value={authForm.password}
                onChange={(event) =>
                  setAuthForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </label>

            {authError && (
              <p className="feedback error">
                <CircleAlert size={18} aria-hidden="true" />
                {authError}
              </p>
            )}
            {notice && (
              <p className="feedback success">
                <CheckCircle2 size={18} aria-hidden="true" />
                {notice}
              </p>
            )}

            {pendingConfirmationEmail && (
              <div className="confirmation-panel">
                <div>
                  <strong>Email por confirmar</strong>
                  <p>{pendingConfirmationEmail}</p>
                </div>
                <button
                  type="button"
                  className="ghost-action"
                  onClick={() => void resendConfirmationEmail()}
                  disabled={isResendingConfirmation || resendCooldownRemaining > 0}
                >
                  {isResendingConfirmation ? (
                    <Loader2 className="spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw aria-hidden="true" />
                  )}
                  {resendCooldownRemaining > 0
                    ? `Reenviar em ${resendCooldownRemaining}s`
                    : 'Reenviar confirmacao'}
                </button>
              </div>
            )}

            <button
              className="primary-action"
              type="submit"
              disabled={authLoading || (authMode === 'signup' && signupCooldownRemaining > 0)}
            >
              {authLoading ? <Loader2 className="spin" aria-hidden="true" /> : <KeyRound />}
              {authMode === 'login'
                ? 'Entrar'
                : signupCooldownRemaining > 0
                  ? `Aguarda ${signupCooldownRemaining}s`
                  : 'Criar conta'}
            </button>
          </form>
        </section>
        {manualDialog}
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-heading">
          <BrandLogo compact />
          <h1>Gestor de dispositivos</h1>
        </div>
        <div className="account-box">
          <span className="role-badge">{roleLabels[currentRole]}</span>
          <span>{currentEmail}</span>
          <button
            type="button"
            className="manual-button"
            onClick={() => setIsManualOpen(true)}
            title="Abrir manual"
          >
            <BookOpen aria-hidden="true" />
            Manual
          </button>
          <button type="button" className="icon-button" onClick={handleSignOut} title="Sair">
            <LogOut aria-hidden="true" />
          </button>
        </div>
      </header>

      {isDemoMode && (
        <section className="demo-banner">
          <div>
            <strong>Modo demonstracao</strong>
            <span>
              Podes adicionar, editar e apagar dispositivos. Os dados ficam guardados neste
              navegador ate configurares o Supabase.
            </span>
          </div>
          <code>.env.local</code>
        </section>
      )}

      {canManageUsers && (
        <nav className="view-tabs" aria-label="Areas de gestao">
          <button
            type="button"
            className={selectedView === 'devices' ? 'active' : ''}
            onClick={() => setActiveView('devices')}
          >
            <ClipboardList aria-hidden="true" />
            Dispositivos
          </button>
          <button
            type="button"
            className={selectedView === 'users' ? 'active' : ''}
            onClick={() => {
              setActiveView('users')
              void refreshUsers()
            }}
          >
            <UsersRound aria-hidden="true" />
            Utilizadores
          </button>
        </nav>
      )}

      {selectedView === 'devices' ? (
        <>
      <section className="stats-grid" aria-label="Resumo dos dispositivos">
        <article>
          <span>Total</span>
          <strong>{totals.all}</strong>
        </article>
        <article>
          <span>Ativos</span>
          <strong>{totals.active}</strong>
        </article>
        <article>
          <span>Manutencao</span>
          <strong>{totals.maintenance}</strong>
        </article>
        <article>
          <span>Arquivados</span>
          <strong>{totals.retired}</strong>
        </article>
      </section>

      <div className="workspace">
        <section className="form-panel" aria-labelledby="device-form-title">
          <div className="section-heading">
            <h2 id="device-form-title">{editingId ? 'Editar dispositivo' : 'Novo dispositivo'}</h2>
            {editingId && (
              <button type="button" className="ghost-action" onClick={cancelEditing}>
                <X aria-hidden="true" />
                Cancelar
              </button>
            )}
          </div>

          {canManageDevices ? (
            <form className="device-form" onSubmit={handleDeviceSubmit}>
              <div className="form-section span-2">
                <h3>Identificação</h3>
                <div className="section-grid">
                  <label>
                    ID
                    <input
                      required
                      placeholder="Ex: 1"
                      value={deviceForm.name}
                      onChange={(event) =>
                        setDeviceForm((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </label>

                  <label>
                    Data Entrada
                    <input
                      placeholder="Ex: 15/04/2026"
                      value={deviceForm.repair.entry_date}
                      onChange={(event) => updateRepairField('entry_date', event.target.value)}
                    />
                  </label>

                  <label>
                    Marca
                    <input
                      placeholder="Ex: Lenovo"
                      value={deviceForm.brand}
                      onChange={(event) =>
                        setDeviceForm((current) => ({
                          ...current,
                          brand: event.target.value,
                          repair: { ...current.repair, brand: event.target.value },
                        }))
                      }
                    />
                  </label>

                  <label>
                    Modelo
                    <input
                      required
                      placeholder="Ex: ThinkPad"
                      value={deviceForm.model}
                      onChange={(event) =>
                        setDeviceForm((current) => ({ ...current, model: event.target.value }))
                      }
                    />
                  </label>

                  <label>
                    Nº Série
                    <input
                      required
                      placeholder="Ex: PF-09UN6N"
                      value={deviceForm.serial_number}
                      onChange={(event) =>
                        setDeviceForm((current) => ({
                          ...current,
                          serial_number: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              </div>

              {repairFormSections.map((section) => (
                <div className="form-section span-2" key={section.title}>
                  <h3>{section.title}</h3>
                  <div className="section-grid">
                    {section.fields.map((field) => (
                      <label className={field.multiline ? 'span-2' : ''} key={field.key}>
                        {field.label}
                        {field.multiline ? (
                          <textarea
                            rows={3}
                            value={deviceForm.repair[field.key]}
                            onChange={(event) => updateRepairField(field.key, event.target.value)}
                          />
                        ) : (
                          <input
                            value={deviceForm.repair[field.key]}
                            onChange={(event) => updateRepairField(field.key, event.target.value)}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <button className="primary-action span-2" type="submit" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="spin" aria-hidden="true" />
                ) : editingId ? (
                  <Save aria-hidden="true" />
                ) : (
                  <Plus aria-hidden="true" />
                )}
                {editingId ? 'Guardar alteracoes' : 'Adicionar dispositivo'}
              </button>
            </form>
          ) : (
            <div className="permission-panel">
              <CircleAlert aria-hidden="true" />
              <p>Esta conta tem acesso de leitura.</p>
            </div>
          )}
        </section>

        <section className="list-panel" aria-labelledby="devices-title">
          <div className="section-heading">
            <div>
              <h2 id="devices-title">Dispositivos</h2>
              <p>{filteredDevices.length} registos visiveis</p>
            </div>
            <div className="list-actions">
              <input
                ref={csvInputRef}
                className="import-file-input"
                type="file"
                accept=".csv,text/csv"
                onChange={importDevicesCsv}
              />
              <button type="button" className="ghost-action" onClick={exportDevicesCsv}>
                <Download aria-hidden="true" />
                Exportar CSV
              </button>
              {canManageDevices && (
                <button
                  type="button"
                  className="ghost-action"
                  onClick={() => csvInputRef.current?.click()}
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <Loader2 className="spin" aria-hidden="true" />
                  ) : (
                    <Upload aria-hidden="true" />
                  )}
                  Importar CSV
                </button>
              )}
              {canManageDevices && (
                <button
                  type="button"
                  className="danger-action"
                  onClick={() => void deleteAllDevices()}
                >
                  <Trash2 aria-hidden="true" />
                  Apagar tudo
                </button>
              )}
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  if (isDemoMode) {
                    setNotice('Modo demonstracao atualizado.')
                    return
                  }

                  if (session) void refreshData(session)
                }}
                title="Atualizar"
              >
                <RefreshCw aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="filters-row">
            <label className="search-field">
              <Search aria-hidden="true" />
              <input
                placeholder="Pesquisar"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | DeviceStatus)}
              aria-label="Filtrar por estado"
            >
              <option value="all">Todos</option>
              {deviceStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </div>

          {authError && (
            <p className="feedback error">
              <CircleAlert size={18} aria-hidden="true" />
              {authError}
            </p>
          )}
          {notice && (
            <p className="feedback success">
              <CheckCircle2 size={18} aria-hidden="true" />
              {notice}
            </p>
          )}

          {isLoading ? (
            <div className="loading-state">
              <Loader2 className="spin" aria-hidden="true" />
              A carregar
            </div>
          ) : filteredDevices.length === 0 ? (
            <div className="empty-state">
              <ClipboardList aria-hidden="true" />
              <p>Nenhum dispositivo encontrado.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className={`repair-table ${canManageDevices ? 'has-actions' : ''}`}>
                <colgroup>
                  {repairTableColumns.map((column) => (
                    <col key={column.key} style={{ width: column.width }} />
                  ))}
                  {canManageDevices && <col className="col-actions" />}
                </colgroup>
                <thead>
                  <tr>
                    {repairTableColumns.map((column) => (
                      <th key={column.key}>{column.label}</th>
                    ))}
                    {canManageDevices && <th aria-label="Acoes" />}
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.map((device) => (
                    <tr key={device.id}>
                      {repairTableColumns.map((column) => {
                        const value = getRepairTableValue(device, column)
                        return (
                          <td
                            className={column.key === 'name' ? 'device-id-cell' : ''}
                            key={column.key}
                            title={value}
                          >
                            {column.key === 'repair_status' ? (
                              <span className={`status-pill ${device.status}`}>{value}</span>
                            ) : (
                              value
                            )}
                          </td>
                        )
                      })}
                      {canManageDevices && (
                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => startEditing(device)}
                              title="Editar"
                            >
                              <Edit3 aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="icon-button danger"
                              onClick={() => void deleteDevice(device)}
                              title="Apagar"
                            >
                              <Trash2 aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
        </>
      ) : (
        <section className="users-panel" aria-labelledby="users-title">
          <div className="section-heading">
            <div>
              <h2 id="users-title">Utilizadores</h2>
              <p>{profiles.length} perfis registados</p>
            </div>
            <button
              type="button"
              className="ghost-action"
              onClick={() => void refreshUsers()}
              disabled={isUsersLoading}
            >
              {isUsersLoading ? (
                <Loader2 className="spin" aria-hidden="true" />
              ) : (
                <RefreshCw aria-hidden="true" />
              )}
              Atualizar
            </button>
          </div>

          <div className="users-note">
            <ShieldCheck aria-hidden="true" />
            <p>
              Cria utilizadores nesta area. Todas as contas novas ficam como Administrador e
              prontas para entrar com a palavra-passe definida.
            </p>
          </div>

          <form className="user-create-panel" onSubmit={createUser}>
            <div className="user-create-heading">
              <UserPlus aria-hidden="true" />
              <div>
                <h3>Criar utilizador</h3>
                <p>As novas contas ficam automaticamente com acesso de administrador.</p>
              </div>
            </div>
            <div className="user-create-form">
              <label>
                Nome
                <input
                  required
                  value={createUserForm.fullName}
                  onChange={(event) =>
                    setCreateUserForm((current) => ({
                      ...current,
                      fullName: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Email
                <input
                  required
                  type="email"
                  value={createUserForm.email}
                  onChange={(event) =>
                    setCreateUserForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Palavra-passe temporaria
                <input
                  required
                  minLength={6}
                  type="password"
                  value={createUserForm.password}
                  onChange={(event) =>
                    setCreateUserForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="fixed-role-preview" aria-label="Permissao das contas novas">
                <span>Permissao</span>
                <strong>Administrador</strong>
              </div>
            </div>
            <button className="primary-action" type="submit" disabled={isCreatingUser}>
              {isCreatingUser ? (
                <Loader2 className="spin" aria-hidden="true" />
              ) : (
                <UserPlus aria-hidden="true" />
              )}
              Criar utilizador
            </button>
          </form>

          {authError && (
            <p className="feedback error">
              <CircleAlert size={18} aria-hidden="true" />
              {authError}
            </p>
          )}
          {notice && (
            <p className="feedback success">
              <CheckCircle2 size={18} aria-hidden="true" />
              {notice}
            </p>
          )}

          {isUsersLoading ? (
            <div className="loading-state">
              <Loader2 className="spin" aria-hidden="true" />
              A carregar utilizadores
            </div>
          ) : profiles.length === 0 ? (
            <div className="empty-state">
              <UsersRound aria-hidden="true" />
              <p>Nenhum utilizador encontrado.</p>
            </div>
          ) : (
            <div className="table-wrap users-table-wrap">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Utilizador</th>
                    <th>Permissao atual</th>
                    <th>Alterar permissao</th>
                    <th>Criado</th>
                    <th>Atualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((userProfile) => {
                    const isCurrentProfile = userProfile.id === currentProfileId

                    return (
                      <tr key={userProfile.id}>
                        <td>
                          <div className="user-identity">
                            <strong>{getProfileDisplayName(userProfile)}</strong>
                            {isCurrentProfile && <span>Tu</span>}
                            {userProfile.email && <small>{userProfile.email}</small>}
                            <small>{userProfile.id}</small>
                          </div>
                        </td>
                        <td>
                          <span className={`role-badge role-${userProfile.role}`}>
                            {roleLabels[userProfile.role]}
                          </span>
                        </td>
                        <td>
                          <div className="role-control">
                            <select
                              value={userProfile.role}
                              onChange={(event) =>
                                void updateProfileRole(
                                  userProfile,
                                  event.target.value as Profile['role'],
                                )
                              }
                              disabled={isCurrentProfile || savingProfileId === userProfile.id}
                              aria-label={`Alterar permissao de ${getProfileDisplayName(userProfile)}`}
                            >
                              {memberRoles.map((role) => (
                                <option key={role} value={role}>
                                  {roleLabels[role]}
                                </option>
                              ))}
                            </select>
                            {isCurrentProfile && (
                              <span className="role-helper">Protegido para manter o teu acesso.</span>
                            )}
                          </div>
                        </td>
                        <td>{formatProfileDate(userProfile.created_at)}</td>
                        <td>{formatProfileDate(userProfile.updated_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {manualDialog}
    </main>
  )
}

export default App
