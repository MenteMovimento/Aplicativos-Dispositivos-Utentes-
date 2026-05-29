import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  CheckCircle2,
  CircleAlert,
  Edit3,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react'
import type { Utente, UtenteForm } from '../types'

type AppLanguage = 'pt' | 'en'

type UtentesPanelProps = {
  session: Session | null
  isDemoMode: boolean
  language: AppLanguage
}

const stripOuterWhitespace = (value: string) => value.replace(/^\s+|\s+$/g, '')

const demoUtentesStorageKey = 'mentemovimento-demo-utentes'

const emptyUtenteForm: UtenteForm = {
  nome: '',
  data_nascimento: '',
  telefone: '',
  email: '',
  morada: '',
  numero_utente: '',
  nif: '',
  contacto_emergencia: '',
  estado: 'Ativo',
  observacoes: '',
}

const labels = {
  pt: {
    actions: 'Acoes',
    add: 'Adicionar utente',
    birthDate: 'Data nascimento',
    cancel: 'Cancelar',
    contact: 'Contacto',
    created: 'Criado',
    delete: 'Apagar',
    edit: 'Editar',
    email: 'Email',
    emergency: 'Contacto emergencia',
    empty: 'Nenhum utente encontrado.',
    fillName: 'Preenche o nome do utente.',
    formTitleNew: 'Novo utente',
    formTitleEdit: 'Editar utente',
    identification: 'Identificacao',
    loading: 'A carregar utentes',
    morada: 'Morada',
    name: 'Nome',
    nif: 'NIF',
    notes: 'Observacoes',
    number: 'Nº utente',
    phone: 'Telefone',
    refresh: 'Atualizar',
    save: 'Guardar alteracoes',
    search: 'Pesquisar utentes',
    state: 'Estado',
    title: 'Utentes',
    updated: 'Atualizado',
    saved: 'Utente guardado.',
    savedDemo: 'Utente guardado em modo demonstracao.',
    deleted: 'Utente apagado.',
    deletedDemo: 'Utente apagado em modo demonstracao.',
    setupRequired:
      'Nao foi possivel carregar utentes. Confirma se apps/utentes/supabase_schema.sql foi executado no Supabase.',
    deleteConfirm: (name: string) => `Apagar o utente "${name}"?`,
    count: (value: number) => `${value} utentes registados`,
  },
  en: {
    actions: 'Actions',
    add: 'Add service user',
    birthDate: 'Birth date',
    cancel: 'Cancel',
    contact: 'Contact',
    created: 'Created',
    delete: 'Delete',
    edit: 'Edit',
    email: 'Email',
    emergency: 'Emergency contact',
    empty: 'No service users found.',
    fillName: 'Fill the service user name.',
    formTitleNew: 'New service user',
    formTitleEdit: 'Edit service user',
    identification: 'Identification',
    loading: 'Loading service users',
    morada: 'Address',
    name: 'Name',
    nif: 'Tax ID',
    notes: 'Notes',
    number: 'User No.',
    phone: 'Phone',
    refresh: 'Refresh',
    save: 'Save changes',
    search: 'Search service users',
    state: 'Status',
    title: 'Service users',
    updated: 'Updated',
    saved: 'Service user saved.',
    savedDemo: 'Service user saved in demo mode.',
    deleted: 'Service user deleted.',
    deletedDemo: 'Service user deleted in demo mode.',
    setupRequired:
      'Could not load service users. Confirm apps/utentes/supabase_schema.sql was executed in Supabase.',
    deleteConfirm: (name: string) => `Delete service user "${name}"?`,
    count: (value: number) => `${value} registered service users`,
  },
} as const

const loadDemoUtentes = (): Utente[] => {
  try {
    const stored = window.localStorage.getItem(demoUtentesStorageKey)
    if (!stored) return []

    return JSON.parse(stored) as Utente[]
  } catch {
    return []
  }
}

const persistDemoUtentes = (utentes: Utente[]) => {
  window.localStorage.setItem(demoUtentesStorageKey, JSON.stringify(utentes))
}

const formToPayload = (form: UtenteForm) => ({
  nome: stripOuterWhitespace(form.nome),
  data_nascimento: stripOuterWhitespace(form.data_nascimento),
  telefone: stripOuterWhitespace(form.telefone),
  email: stripOuterWhitespace(form.email).toLowerCase(),
  morada: stripOuterWhitespace(form.morada),
  numero_utente: stripOuterWhitespace(form.numero_utente),
  nif: stripOuterWhitespace(form.nif),
  contacto_emergencia: stripOuterWhitespace(form.contacto_emergencia),
  estado: stripOuterWhitespace(form.estado) || 'Ativo',
  observacoes: stripOuterWhitespace(form.observacoes),
})

const utenteToForm = (utente: Utente): UtenteForm => ({
  nome: utente.nome,
  data_nascimento: utente.data_nascimento ?? '',
  telefone: utente.telefone ?? '',
  email: utente.email ?? '',
  morada: utente.morada ?? '',
  numero_utente: utente.numero_utente ?? '',
  nif: utente.nif ?? '',
  contacto_emergencia: utente.contacto_emergencia ?? '',
  estado: utente.estado,
  observacoes: utente.observacoes ?? '',
})

const formatDateTime = (value: string, language: AppLanguage) =>
  new Intl.DateTimeFormat(language === 'pt' ? 'pt-PT' : 'en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))

const getFriendlyError = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return fallback
}

export function UtentesPanel({ session, isDemoMode, language }: UtentesPanelProps) {
  const t = labels[language]
  const [utentes, setUtentes] = useState<Utente[]>(() => (isDemoMode ? loadDemoUtentes() : []))
  const [form, setForm] = useState<UtenteForm>(emptyUtenteForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const filteredUtentes = useMemo(() => {
    const query = stripOuterWhitespace(searchTerm).toLowerCase()

    if (!query) return utentes

    return utentes.filter((utente) =>
      [
        utente.nome,
        utente.email ?? '',
        utente.telefone ?? '',
        utente.numero_utente ?? '',
        utente.nif ?? '',
        utente.estado,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [searchTerm, utentes])

  const loadUtentes = async () => {
    if (isDemoMode) {
      setUtentes(loadDemoUtentes())
      return
    }

    if (!session) return

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await fetch('/api/utentes', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const result = (await response.json()) as { error?: string; utentes?: Utente[] }

      if (!response.ok || !result.utentes) {
        throw new Error(result.error ?? t.setupRequired)
      }

      setUtentes(result.utentes)
    } catch (error) {
      setErrorMessage(getFriendlyError(error, t.setupRequired))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUtentes()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode, session?.access_token])

  const resetForm = () => {
    setForm(emptyUtenteForm)
    setEditingId(null)
  }

  const startEditing = (utente: Utente) => {
    setForm(utenteToForm(utente))
    setEditingId(utente.id)
    setNotice(null)
    setErrorMessage(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const payload = formToPayload(form)

    if (!payload.nome) {
      setErrorMessage(t.fillName)
      return
    }

    setIsSaving(true)
    setNotice(null)
    setErrorMessage(null)

    try {
      if (isDemoMode) {
        const now = new Date().toISOString()
        const nextUtente: Utente = {
          id: editingId ?? Date.now(),
          nome: payload.nome,
          data_nascimento: payload.data_nascimento || null,
          telefone: payload.telefone || null,
          email: payload.email || null,
          morada: payload.morada || null,
          numero_utente: payload.numero_utente || null,
          nif: payload.nif || null,
          contacto_emergencia: payload.contacto_emergencia || null,
          estado: payload.estado,
          observacoes: payload.observacoes || null,
          created_at:
            utentes.find((utente) => utente.id === editingId)?.created_at ?? now,
          updated_at: now,
        }
        const nextUtentes = editingId
          ? utentes.map((utente) => (utente.id === editingId ? nextUtente : utente))
          : [nextUtente, ...utentes]

        setUtentes(nextUtentes)
        persistDemoUtentes(nextUtentes)
        resetForm()
        setNotice(t.savedDemo)
        return
      }

      if (!session) return

      const response = await fetch('/api/utentes', {
        method: editingId ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      })
      const result = (await response.json()) as { error?: string; utente?: Utente }

      if (!response.ok || !result.utente) {
        throw new Error(result.error ?? t.setupRequired)
      }

      setUtentes((current) =>
        editingId
          ? current.map((utente) => (utente.id === editingId ? (result.utente as Utente) : utente))
          : [result.utente as Utente, ...current],
      )
      resetForm()
      setNotice(t.saved)
    } catch (error) {
      setErrorMessage(getFriendlyError(error, t.setupRequired))
    } finally {
      setIsSaving(false)
    }
  }

  const deleteUtente = async (utente: Utente) => {
    const confirmed = window.confirm(t.deleteConfirm(utente.nome))

    if (!confirmed) return

    setDeletingId(utente.id)
    setNotice(null)
    setErrorMessage(null)

    try {
      if (isDemoMode) {
        const nextUtentes = utentes.filter((item) => item.id !== utente.id)
        setUtentes(nextUtentes)
        persistDemoUtentes(nextUtentes)
        if (editingId === utente.id) resetForm()
        setNotice(t.deletedDemo)
        return
      }

      if (!session) return

      const response = await fetch('/api/utentes', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: utente.id }),
      })
      const result = (await response.json()) as { error?: string; ok?: boolean }

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? t.setupRequired)
      }

      setUtentes((current) => current.filter((item) => item.id !== utente.id))
      if (editingId === utente.id) resetForm()
      setNotice(t.deleted)
    } catch (error) {
      setErrorMessage(getFriendlyError(error, t.setupRequired))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="utentes-page" aria-labelledby="utentes-title">
      <div className="section-heading">
        <div>
          <h2 id="utentes-title">{t.title}</h2>
          <p>{t.count(utentes.length)}</p>
        </div>
        <button
          type="button"
          className="ghost-action"
          onClick={() => void loadUtentes()}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
          {t.refresh}
        </button>
      </div>

      {errorMessage && (
        <p className="feedback error">
          <CircleAlert size={18} aria-hidden="true" />
          {errorMessage}
        </p>
      )}
      {notice && (
        <p className="feedback success">
          <CheckCircle2 size={18} aria-hidden="true" />
          {notice}
        </p>
      )}

      <div className="utentes-workspace">
        <form className="form-panel utente-form-panel" onSubmit={handleSubmit}>
          <div className="section-heading">
            <div>
              <h2>{editingId ? t.formTitleEdit : t.formTitleNew}</h2>
              <p>{t.identification}</p>
            </div>
            {editingId && (
              <button type="button" className="icon-button" onClick={resetForm} title={t.cancel}>
                <X aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="device-form">
            <label className="span-2">
              {t.name}
              <input
                required
                value={form.nome}
                onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
              />
            </label>
            <label>
              {t.number}
              <input
                value={form.numero_utente}
                onChange={(event) =>
                  setForm((current) => ({ ...current, numero_utente: event.target.value }))
                }
              />
            </label>
            <label>
              {t.state}
              <input
                list="utente-status-options"
                value={form.estado}
                onChange={(event) => setForm((current) => ({ ...current, estado: event.target.value }))}
              />
              <datalist id="utente-status-options">
                <option value="Ativo" />
                <option value="Em acompanhamento" />
                <option value="Arquivado" />
              </datalist>
            </label>
            <label>
              {t.birthDate}
              <input
                type="date"
                value={form.data_nascimento}
                onChange={(event) =>
                  setForm((current) => ({ ...current, data_nascimento: event.target.value }))
                }
              />
            </label>
            <label>
              {t.nif}
              <input
                value={form.nif}
                onChange={(event) => setForm((current) => ({ ...current, nif: event.target.value }))}
              />
            </label>
            <label>
              {t.phone}
              <input
                value={form.telefone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, telefone: event.target.value }))
                }
              />
            </label>
            <label>
              {t.email}
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <label className="span-2">
              {t.emergency}
              <input
                value={form.contacto_emergencia}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    contacto_emergencia: event.target.value,
                  }))
                }
              />
            </label>
            <label className="span-2">
              {t.morada}
              <input
                value={form.morada}
                onChange={(event) => setForm((current) => ({ ...current, morada: event.target.value }))}
              />
            </label>
            <label className="span-2">
              {t.notes}
              <textarea
                value={form.observacoes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, observacoes: event.target.value }))
                }
              />
            </label>
          </div>

          <button className="primary-action" type="submit" disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="spin" aria-hidden="true" />
            ) : editingId ? (
              <Save aria-hidden="true" />
            ) : (
              <UserPlus aria-hidden="true" />
            )}
            {editingId ? t.save : t.add}
          </button>
        </form>

        <section className="list-panel utentes-list-panel">
          <div className="filters-row">
            <label className="search-box">
              <Search aria-hidden="true" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t.search}
              />
            </label>
          </div>

          {isLoading ? (
            <div className="loading-state">
              <Loader2 className="spin" aria-hidden="true" />
              {t.loading}
            </div>
          ) : filteredUtentes.length === 0 ? (
            <div className="empty-state">
              <UsersRound aria-hidden="true" />
              <p>{t.empty}</p>
            </div>
          ) : (
            <div className="table-wrap utentes-table-wrap">
              <table className="utentes-table">
                <thead>
                  <tr>
                    <th>{t.name}</th>
                    <th>{t.contact}</th>
                    <th>{t.state}</th>
                    <th>{t.updated}</th>
                    <th>{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUtentes.map((utente) => (
                    <tr key={utente.id}>
                      <td>
                        <div className="user-identity">
                          <strong>{utente.nome}</strong>
                          {utente.numero_utente && <small>{utente.numero_utente}</small>}
                          {utente.nif && <small>{utente.nif}</small>}
                        </div>
                      </td>
                      <td>
                        <div className="user-identity">
                          {utente.telefone && <small>{utente.telefone}</small>}
                          {utente.email && <small>{utente.email}</small>}
                          {utente.contacto_emergencia && <small>{utente.contacto_emergencia}</small>}
                        </div>
                      </td>
                      <td>
                        <span className="status-pill active">{utente.estado}</span>
                      </td>
                      <td>{formatDateTime(utente.updated_at, language)}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => startEditing(utente)}
                            title={t.edit}
                          >
                            <Edit3 aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="icon-button danger"
                            onClick={() => void deleteUtente(utente)}
                            disabled={deletingId === utente.id}
                            title={t.delete}
                          >
                            {deletingId === utente.id ? (
                              <Loader2 className="spin" aria-hidden="true" />
                            ) : (
                              <Trash2 aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </section>
  )
}
