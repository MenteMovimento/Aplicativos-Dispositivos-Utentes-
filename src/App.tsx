import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Edit3,
  KeyRound,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import './App.css'
import { BrandLogo } from './components/BrandLogo'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { Device, DeviceForm, DeviceStatus, Profile } from './types'

const deviceStatuses: DeviceStatus[] = ['active', 'maintenance', 'retired']

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

const emptyDeviceForm: DeviceForm = {
  name: '',
  serial_number: '',
  model: '',
  location: '',
  status: 'active',
  notes: '',
}

const dateFormatter = new Intl.DateTimeFormat('pt-PT', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const demoStorageKey = 'mentemovimento-demo-devices'

const initialDemoDevices: Device[] = [
  {
    id: 'demo-1',
    name: 'Portatil rececao',
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
    name: 'Tablet sala de formacao',
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

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [devices, setDevices] = useState<Device[]>(() =>
    isSupabaseConfigured ? [] : loadDemoDevices(),
  )
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured)
  const [isSaving, setIsSaving] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [authLoading, setAuthLoading] = useState(false)
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    fullName: '',
  })
  const [authError, setAuthError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [deviceForm, setDeviceForm] = useState<DeviceForm>(emptyDeviceForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | DeviceStatus>('all')

  const isDemoMode = !isSupabaseConfigured
  const currentRole: Profile['role'] = isDemoMode ? 'admin' : (profile?.role ?? 'member')
  const currentEmail = session?.user.email ?? 'demo@mentemovimento.pt'
  const isAuthenticated = isDemoMode || Boolean(session)
  const canManageDevices = isDemoMode || currentRole === 'admin' || currentRole === 'manager'

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', userId)
      .maybeSingle()

    if (error) throw error
    setProfile(
      (data as Profile | null) ?? {
        id: userId,
        full_name: null,
        role: 'member',
      },
    )
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

  const refreshData = useCallback(
    async (currentSession: Session) => {
      setIsLoading(true)
      setAuthError(null)

      try {
        await Promise.all([loadProfile(currentSession.user.id), loadDevices()])
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'Nao foi possivel carregar os dados.')
      } finally {
        setIsLoading(false)
      }
    },
    [loadDevices, loadProfile],
  )

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
      setDevices([])
      setIsLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [refreshData])

  const filteredDevices = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return devices.filter((device) => {
      const matchesStatus = statusFilter === 'all' || device.status === statusFilter
      const matchesSearch =
        query.length === 0 ||
        [device.name, device.serial_number, device.model, device.location ?? '']
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

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return

    setAuthError(null)
    setNotice(null)
    setAuthLoading(true)

    try {
      if (authForm.password.length < 6) {
        throw new Error('A palavra-passe deve ter pelo menos 6 caracteres.')
      }

      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: authForm.email,
          password: authForm.password,
        })

        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: authForm.email,
          password: authForm.password,
          options: {
            data: {
              full_name: authForm.fullName,
            },
          },
        })

        if (error) throw error

        if (data.user && !data.session) {
          setNotice('Conta criada. Confirma o email antes de entrar.')
        } else {
          setNotice('Conta criada com sucesso.')
        }
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Nao foi possivel autenticar.')
    } finally {
      setAuthLoading(false)
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
    setDeviceForm(emptyDeviceForm)
    setEditingId(null)
  }

  const handleDeviceSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canManageDevices) return

    setIsSaving(true)
    setAuthError(null)
    setNotice(null)

    const payload = {
      name: deviceForm.name.trim(),
      serial_number: deviceForm.serial_number.trim(),
      model: deviceForm.model.trim(),
      location: deviceForm.location.trim() || null,
      status: deviceForm.status,
      notes: deviceForm.notes.trim() || null,
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
    setDeviceForm({
      name: device.name,
      serial_number: device.serial_number,
      model: device.model,
      location: device.location ?? '',
      status: device.status,
      notes: device.notes ?? '',
    })
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

  if (!isAuthenticated) {
    return (
      <main className="auth-shell">
        <section className="auth-panel" aria-labelledby="auth-title">
          <BrandLogo className="auth-logo" />
          <div>
            <h1 id="auth-title">Gestor de dispositivos</h1>
            <p className="auth-subtitle">Acesso interno da associacao</p>
          </div>

          <div className="mode-tabs" role="tablist" aria-label="Autenticacao">
            <button
              type="button"
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => setAuthMode('login')}
            >
              Entrar
            </button>
            <button
              type="button"
              className={authMode === 'signup' ? 'active' : ''}
              onClick={() => setAuthMode('signup')}
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
                onChange={(event) =>
                  setAuthForm((current) => ({ ...current, email: event.target.value }))
                }
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

            <button className="primary-action" type="submit" disabled={authLoading}>
              {authLoading ? <Loader2 className="spin" aria-hidden="true" /> : <KeyRound />}
              {authMode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>
        </section>
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
              <label>
                Nome
                <input
                  required
                  value={deviceForm.name}
                  onChange={(event) =>
                    setDeviceForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>

              <label>
                Numero de serie
                <input
                  required
                  value={deviceForm.serial_number}
                  onChange={(event) =>
                    setDeviceForm((current) => ({
                      ...current,
                      serial_number: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Modelo
                <input
                  required
                  value={deviceForm.model}
                  onChange={(event) =>
                    setDeviceForm((current) => ({ ...current, model: event.target.value }))
                  }
                />
              </label>

              <label>
                Local
                <input
                  value={deviceForm.location}
                  onChange={(event) =>
                    setDeviceForm((current) => ({ ...current, location: event.target.value }))
                  }
                />
              </label>

              <label>
                Estado
                <select
                  value={deviceForm.status}
                  onChange={(event) =>
                    setDeviceForm((current) => ({
                      ...current,
                      status: event.target.value as DeviceStatus,
                    }))
                  }
                >
                  {deviceStatuses.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="span-2">
                Notas
                <textarea
                  rows={4}
                  value={deviceForm.notes}
                  onChange={(event) =>
                    setDeviceForm((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </label>

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
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Numero de serie</th>
                    <th>Modelo</th>
                    <th>Local</th>
                    <th>Estado</th>
                    <th>Atualizado</th>
                    {canManageDevices && <th aria-label="Acoes" />}
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.map((device) => (
                    <tr key={device.id}>
                      <td>{device.name}</td>
                      <td>{device.serial_number}</td>
                      <td>{device.model}</td>
                      <td>{device.location ?? '-'}</td>
                      <td>
                        <span className={`status-pill ${device.status}`}>
                          {statusLabels[device.status]}
                        </span>
                      </td>
                      <td>{dateFormatter.format(new Date(device.updated_at))}</td>
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
    </main>
  )
}

export default App
