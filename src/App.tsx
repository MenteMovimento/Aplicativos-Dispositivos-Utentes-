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
  Languages,
  Loader2,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sun,
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
type AppLanguage = 'pt' | 'en'
type AppTheme = 'light' | 'dark'

const statusLabels: Record<AppLanguage, Record<DeviceStatus, string>> = {
  pt: {
    active: 'Ativo',
    maintenance: 'Manutencao',
    retired: 'Arquivado',
  },
  en: {
    active: 'Active',
    maintenance: 'Maintenance',
    retired: 'Archived',
  },
}

const roleLabels: Record<AppLanguage, Record<Profile['role'], string>> = {
  pt: {
    admin: 'Administrador',
    manager: 'Gestor',
    member: 'Membro',
  },
  en: {
    admin: 'Administrator',
    manager: 'Manager',
    member: 'Member',
  },
}

const authEmailCooldownSeconds = 60
const authCooldownStorageKey = 'mentemovimento-auth-email-cooldowns'
const languageStorageKey = 'mentemovimento-language'
const themeStorageKey = 'mentemovimento-theme'

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

const getFriendlyAuthError = (error: unknown, language: AppLanguage) => {
  if (isEmailRateLimitError(error)) {
    return language === 'pt'
      ? 'O Supabase bloqueou temporariamente o envio de emails. Aguarda alguns minutos antes de pedir outro email de confirmacao.'
      : 'Supabase temporarily blocked email sending. Wait a few minutes before requesting another confirmation email.'
  }

  if (isEmailNotConfirmedError(error)) {
    return language === 'pt'
      ? 'Este email ja tem conta, mas ainda precisa de confirmacao. Confirma no email ou usa Reenviar confirmacao.'
      : 'This email already has an account, but it still needs confirmation. Confirm it by email or use Resend confirmation.'
  }

  const message = getErrorMessage(error)
  if (message.toLowerCase().includes('invalid login credentials')) {
    return language === 'pt' ? 'Email ou palavra-passe incorretos.' : 'Incorrect email or password.'
  }

  if (message.toLowerCase().includes('email logins are disabled')) {
    return language === 'pt'
      ? 'O login por email esta desativado no Supabase. Ativa o provider Email em Authentication > Providers.'
      : 'Email login is disabled in Supabase. Enable the Email provider in Authentication > Providers.'
  }

  return message || (language === 'pt' ? 'Nao foi possivel autenticar.' : 'Could not authenticate.')
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

const getFriendlyDataError = (error: unknown, language: AppLanguage) => {
  const message = getErrorMessage(error)
  const lowerMessage = message.toLowerCase()

  if (isMissingEmailColumnError(error)) {
    return language === 'pt'
      ? 'A base de dados ainda nao foi atualizada para a gestao de utilizadores. Executa o ficheiro supabase/user-management.sql no SQL Editor do Supabase.'
      : 'The database has not been updated for user management yet. Run supabase/user-management.sql in the Supabase SQL Editor.'
  }

  if (lowerMessage.includes('row-level security') || lowerMessage.includes('permission denied')) {
    return language === 'pt'
      ? 'O Supabase bloqueou o pedido por permissoes/RLS. Executa supabase/user-management.sql e volta a entrar na conta.'
      : 'Supabase blocked the request because of permissions/RLS. Run supabase/user-management.sql and sign in again.'
  }

  if (lowerMessage.includes('relation') && lowerMessage.includes('does not exist')) {
    return language === 'pt'
      ? 'A tabela necessaria ainda nao existe no Supabase. Executa o schema SQL do projeto no SQL Editor.'
      : 'The required table does not exist in Supabase yet. Run the project SQL schema in the SQL Editor.'
  }

  if (lowerMessage.includes('jwt') && lowerMessage.includes('expired')) {
    return language === 'pt' ? 'A tua sessao expirou. Sai e volta a entrar.' : 'Your session expired. Sign out and sign in again.'
  }

  return message || (language === 'pt' ? 'Nao foi possivel carregar os dados.' : 'Could not load the data.')
}

const manualSectionsByLanguage: Record<
  AppLanguage,
  Array<{
    title: string
    steps: string[]
  }>
> = {
  pt: [
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
        'Usa as secoes Identificacao, Hardware e sistema, Diagnostico e reparacao, Configuracao e contas.',
        'Clica em Adicionar dispositivo para guardar na base de dados.',
      ],
    },
    {
      title: '3. Editar ou desativar',
      steps: [
        'Na tabela, clica no icone de lapis da linha que queres alterar.',
        'Altera os campos necessarios e clica em Guardar alteracoes.',
        'Para deixar desativo, escreve Arquivado ou Abate no campo Estado da secao Diagnostico e reparacao.',
      ],
    },
    {
      title: '4. Importar do Google Sheets',
      steps: [
        'No Google Sheets, vai a Ficheiro > Transferir > Valores separados por virgulas (.csv).',
        'No site, clica em Importar CSV e escolhe o ficheiro exportado.',
        'A importacao usa o Nº Série para atualizar dispositivos existentes sem duplicar.',
        'As colunas principais esperadas sao ID, Data Entrada, Marca, Modelo, Nº Série, CPU, RAM, Disco, Estado e Observacoes.',
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
        'Na tabela, podes alterar a permissao para Administrador, Gestor ou Membro depois da criacao.',
        'A tua propria permissao fica bloqueada para evitar perderes acesso ao painel.',
      ],
    },
  ],
  en: [
    {
      title: '1. Sign in',
      steps: [
        'Open the Vercel site and sign in with the email and password created in Supabase.',
        'If a session already exists, the dashboard opens automatically.',
        'If the email is already registered, use Sign in instead of creating the account again.',
        'If Supabase asks for confirmation, use Resend confirmation only after the cooldown.',
        'All authenticated users can manage devices and open the Users area.',
      ],
    },
    {
      title: '2. Create a device',
      steps: [
        'In New device, fill at least ID, Model and Serial number.',
        'Use the Identification, Hardware and system, Diagnosis and repair, and Configuration and accounts sections.',
        'Click Add device to save it to the database.',
      ],
    },
    {
      title: '3. Edit or deactivate',
      steps: [
        'In the table, click the pencil icon on the row you want to change.',
        'Update the necessary fields and click Save changes.',
        'To deactivate it, write Archived or Disposal in the State field inside Diagnosis and repair.',
      ],
    },
    {
      title: '4. Import from Google Sheets',
      steps: [
        'In Google Sheets, go to File > Download > Comma separated values (.csv).',
        'In the site, click Import CSV and choose the exported file.',
        'Import uses the Serial number to update existing devices without duplicating them.',
        'The main expected columns are ID, Entry Date, Brand, Model, Serial number, CPU, RAM, Disk, State and Notes.',
      ],
    },
    {
      title: '5. Export to Google Sheets',
      steps: [
        'Click Export CSV to download the visible list.',
        'Open or import that CSV file in Google Sheets.',
        'If you search or filter before exporting, only visible records are exported.',
      ],
    },
    {
      title: '6. Delete records',
      steps: [
        'To delete one row, use the red trash icon on that row.',
        'To delete everything, use Delete all. The system asks for confirmation and requires typing APAGAR.',
        'After deleting everything, the action cannot be undone. Export a CSV first if you need a copy.',
      ],
    },
    {
      title: '7. Manage users',
      steps: [
        'Sign in with a confirmed account and open the Users tab.',
        'Fill name, email and temporary password in the Create user form.',
        'All accounts created in this area are automatically Administrators.',
        'In the table, you can later change the permission to Administrator, Manager or Member.',
        'Your own permission is locked to avoid losing access to the panel.',
      ],
    },
  ],
}

const translations = {
  pt: {
    addDevice: 'Adicionar dispositivo',
    actions: 'Acoes',
    all: 'Todos',
    appTitle: 'Gestor de dispositivos',
    archived: 'Arquivados',
    authTabLabel: 'Autenticacao',
    cancel: 'Cancelar',
    closeManual: 'Fechar manual',
    confirmEmailTitle: 'Email por confirmar',
    created: 'Criado',
    createAccount: 'Criar conta',
    createUser: 'Criar utilizador',
    currentPermission: 'Permissao atual',
    dashboardAccess: 'Acesso interno da associacao',
    darkTheme: 'Ativar tema escuro',
    delete: 'Apagar',
    deleteAll: 'Apagar tudo',
    demoMode: 'Modo demonstracao',
    demoModeDescription:
      'Podes adicionar, editar e apagar dispositivos. Os dados ficam guardados neste navegador ate configurares o Supabase.',
    devices: 'Dispositivos',
    devicesSummary: 'Resumo dos dispositivos',
    displaySettings: 'Preferencias de visualizacao',
    edit: 'Editar',
    editDevice: 'Editar dispositivo',
    email: 'Email',
    exportCsv: 'Exportar CSV',
    fixedRoleLabel: 'Permissao',
    filterByStatus: 'Filtrar por estado',
    formIdentification: 'Identificacao',
    help: 'Ajuda',
    importCsv: 'Importar CSV',
    language: 'Idioma',
    lightTheme: 'Ativar tema claro',
    loading: 'A carregar',
    loadingUsers: 'A carregar utilizadores',
    manual: 'Manual',
    manualTitle: 'Manual de utilizacao',
    maintenance: 'Manutencao',
    managementAreas: 'Areas de gestao',
    name: 'Nome',
    newDevice: 'Novo dispositivo',
    noDevices: 'Nenhum dispositivo encontrado.',
    noName: 'Sem nome',
    noUsers: 'Nenhum utilizador encontrado.',
    password: 'Palavra-passe',
    permission: 'Permissao',
    protectedRole: 'Protegido para manter o teu acesso.',
    refresh: 'Atualizar',
    registeredProfiles: 'perfis registados',
    resendConfirmation: 'Reenviar confirmacao',
    saveChanges: 'Guardar alteracoes',
    search: 'Pesquisar',
    signIn: 'Entrar',
    signOut: 'Sair',
    temporaryPassword: 'Palavra-passe temporaria',
    thisIsYou: 'Tu',
    total: 'Total',
    updatePermission: 'Alterar permissao',
    updated: 'Atualizado',
    users: 'Utilizadores',
    usersNote:
      'Cria utilizadores nesta area. Todas as contas novas ficam como Administrador e prontas para entrar com a palavra-passe definida.',
    usersNoteCreate: 'As novas contas ficam automaticamente com acesso de administrador.',
    visibleRecords: 'registos visiveis',
    readOnlyAccount: 'Esta conta tem acesso de leitura.',
    accountCreated: 'Conta criada com sucesso.',
    accountCreatedConfirm:
      'Conta criada. Confirma o email antes de entrar. Evitei novos envios automaticos para nao bater no limite do Supabase.',
    allDeleted: 'Todos os dispositivos foram apagados.',
    allDeletedDemo: 'Todos os dispositivos foram apagados em modo demonstracao.',
    confirmationResent: 'Email de confirmacao reenviado. Verifica a caixa de entrada e o spam.',
    csvEmpty: 'O CSV nao tem dispositivos para importar.',
    csvExported: 'CSV exportado para abrir no Google Sheets.',
    csvImportFailed: 'Nao foi possivel importar o CSV.',
    csvUnreadable: 'O CSV tem linhas que nao foi possivel ler.',
    deleteAllCancelled: 'Eliminacao cancelada. Confirmacao incorreta.',
    deleteAllPrompt: 'Para confirmar, escreve APAGAR',
    demoRefreshed: 'Modo demonstracao atualizado.',
    demoSupabaseRequired: 'Modo demonstracao ativo. Configura o Supabase para usar login real.',
    deviceAdded: 'Dispositivo adicionado.',
    deviceAddedDemo: 'Dispositivo adicionado em modo demonstracao.',
    deviceDeleted: 'Dispositivo apagado.',
    deviceDeletedDemo: 'Dispositivo apagado em modo demonstracao.',
    deviceUpdated: 'Dispositivo atualizado.',
    deviceUpdatedDemo: 'Dispositivo atualizado em modo demonstracao.',
    emailRegistered: 'Este email ja esta registado. Usa Entrar para aceder.',
    enterEmailToConfirm: 'Indica o email antes de pedir nova confirmacao.',
    fillRequiredDevice: 'Preenche o nome, numero de serie e modelo.',
    fillUser: 'Preenche nome, email e palavra-passe.',
    noDevicesToDelete: 'Nao ha dispositivos para apagar.',
    noExportVisible: 'Nao ha dispositivos visiveis para exportar.',
    ownRoleBlocked: 'Nao podes alterar a permissao da tua propria conta.',
    passwordMin: 'A palavra-passe deve ter pelo menos 6 caracteres.',
    saveFailed: 'Nao foi possivel guardar.',
    sessionActive: 'Sessao ja ativa. Entraste diretamente no painel.',
    userCreated: 'Utilizador criado com a permissao definida.',
    userCreatedDemo: 'Utilizador criado em modo demonstracao.',
    userExists: 'Ja existe um utilizador com esse email.',
    resendIn: (seconds: number) => `Reenviar em ${seconds}s`,
    waitSeconds: (seconds: number) => `Aguarda ${seconds}s`,
    changePermissionFor: (name: string) => `Alterar permissao de ${name}`,
    csvImported: (count: number) => `${count} dispositivos importados do CSV.`,
    csvImportedUpdated: (count: number) => `${count} dispositivos importados/atualizados.`,
    csvLineRequired: (row: number) => `Linha ${row}: ID, Nº Série e Modelo sao obrigatorios.`,
    deleteAllConfirm: (count: number) =>
      `Vais apagar TODOS os ${count} dispositivos. Esta acao nao pode ser desfeita. Continuar?`,
    deleteOne: (name: string) => `Apagar "${name}"?`,
    recentConfirmation: (seconds: number) =>
      `Ja foi enviado um email de confirmacao recentemente. Aguarda ${seconds} segundos antes de tentar novamente.`,
    roleUpdated: (name: string) => `Permissao de ${name} atualizada.`,
    waitBeforeResend: (seconds: number) =>
      `Aguarda ${seconds} segundos antes de reenviar o email de confirmacao.`,
  },
  en: {
    addDevice: 'Add device',
    actions: 'Actions',
    all: 'All',
    appTitle: 'Device manager',
    archived: 'Archived',
    authTabLabel: 'Authentication',
    cancel: 'Cancel',
    closeManual: 'Close manual',
    confirmEmailTitle: 'Email not confirmed',
    created: 'Created',
    createAccount: 'Create account',
    createUser: 'Create user',
    currentPermission: 'Current permission',
    dashboardAccess: 'Internal association access',
    darkTheme: 'Turn on dark theme',
    delete: 'Delete',
    deleteAll: 'Delete all',
    demoMode: 'Demo mode',
    demoModeDescription:
      'You can add, edit and delete devices. Data stays in this browser until Supabase is configured.',
    devices: 'Devices',
    devicesSummary: 'Devices summary',
    displaySettings: 'Display preferences',
    edit: 'Edit',
    editDevice: 'Edit device',
    email: 'Email',
    exportCsv: 'Export CSV',
    fixedRoleLabel: 'Permission',
    filterByStatus: 'Filter by status',
    formIdentification: 'Identification',
    help: 'Help',
    importCsv: 'Import CSV',
    language: 'Language',
    lightTheme: 'Turn on light theme',
    loading: 'Loading',
    loadingUsers: 'Loading users',
    maintenance: 'Maintenance',
    managementAreas: 'Management areas',
    manual: 'Manual',
    manualTitle: 'User manual',
    name: 'Name',
    newDevice: 'New device',
    noDevices: 'No devices found.',
    noName: 'No name',
    noUsers: 'No users found.',
    password: 'Password',
    permission: 'Permission',
    protectedRole: 'Protected to keep your access.',
    refresh: 'Refresh',
    registeredProfiles: 'registered profiles',
    resendConfirmation: 'Resend confirmation',
    saveChanges: 'Save changes',
    search: 'Search',
    signIn: 'Sign in',
    signOut: 'Sign out',
    temporaryPassword: 'Temporary password',
    thisIsYou: 'You',
    total: 'Total',
    updatePermission: 'Change permission',
    updated: 'Updated',
    users: 'Users',
    usersNote:
      'Create users in this area. All new accounts are Administrators and ready to sign in with the defined password.',
    usersNoteCreate: 'New accounts automatically get administrator access.',
    visibleRecords: 'visible records',
    readOnlyAccount: 'This account has read-only access.',
    accountCreated: 'Account created successfully.',
    accountCreatedConfirm:
      'Account created. Confirm the email before signing in. Automatic resends were avoided to prevent hitting the Supabase limit.',
    allDeleted: 'All devices were deleted.',
    allDeletedDemo: 'All devices were deleted in demo mode.',
    confirmationResent: 'Confirmation email resent. Check the inbox and spam folder.',
    csvEmpty: 'The CSV has no devices to import.',
    csvExported: 'CSV exported for Google Sheets.',
    csvImportFailed: 'Could not import the CSV.',
    csvUnreadable: 'The CSV has rows that could not be read.',
    deleteAllCancelled: 'Deletion cancelled. Incorrect confirmation.',
    deleteAllPrompt: 'To confirm, type APAGAR',
    demoRefreshed: 'Demo mode refreshed.',
    demoSupabaseRequired: 'Demo mode is active. Configure Supabase to use real login.',
    deviceAdded: 'Device added.',
    deviceAddedDemo: 'Device added in demo mode.',
    deviceDeleted: 'Device deleted.',
    deviceDeletedDemo: 'Device deleted in demo mode.',
    deviceUpdated: 'Device updated.',
    deviceUpdatedDemo: 'Device updated in demo mode.',
    emailRegistered: 'This email is already registered. Use Sign in to access.',
    enterEmailToConfirm: 'Enter the email before requesting a new confirmation.',
    fillRequiredDevice: 'Fill name, serial number and model.',
    fillUser: 'Fill name, email and password.',
    noDevicesToDelete: 'There are no devices to delete.',
    noExportVisible: 'There are no visible devices to export.',
    ownRoleBlocked: 'You cannot change your own account permission.',
    passwordMin: 'Password must be at least 6 characters.',
    saveFailed: 'Could not save.',
    sessionActive: 'Session already active. You went straight to the dashboard.',
    userCreated: 'User created with the defined permission.',
    userCreatedDemo: 'User created in demo mode.',
    userExists: 'A user with that email already exists.',
    resendIn: (seconds: number) => `Resend in ${seconds}s`,
    waitSeconds: (seconds: number) => `Wait ${seconds}s`,
    changePermissionFor: (name: string) => `Change permission for ${name}`,
    csvImported: (count: number) => `${count} devices imported from CSV.`,
    csvImportedUpdated: (count: number) => `${count} devices imported/updated.`,
    csvLineRequired: (row: number) => `Row ${row}: ID, Serial No. and Model are required.`,
    deleteAllConfirm: (count: number) =>
      `You are about to delete ALL ${count} devices. This action cannot be undone. Continue?`,
    deleteOne: (name: string) => `Delete "${name}"?`,
    recentConfirmation: (seconds: number) =>
      `A confirmation email was sent recently. Wait ${seconds} seconds before trying again.`,
    roleUpdated: (name: string) => `${name}'s permission was updated.`,
    waitBeforeResend: (seconds: number) =>
      `Wait ${seconds} seconds before resending the confirmation email.`,
  },
} as const

const repairLabelTranslations: Record<AppLanguage, Record<string, string>> = {
  pt: {},
  en: {
    'Data Entrada': 'Entry Date',
    Marca: 'Brand',
    Modelo: 'Model',
    'Nº Série': 'Serial No.',
    'RAM (GB)': 'RAM (GB)',
    Disco: 'Disk',
    'Sistema Operativo': 'Operating System',
    Liga: 'Powers On',
    'Dá Imagem': 'Has Image',
    'Estado Físico': 'Physical State',
    'Necessita Limpeza': 'Needs Cleaning',
    Avaria: 'Fault',
    Diagnóstico: 'Diagnosis',
    'Peças Necessárias': 'Parts Needed',
    'Custo Estimado': 'Estimated Cost',
    'Tempo Estimado (min)': 'Estimated Time (min)',
    Técnico: 'Technician',
    Estado: 'State',
    'Resultado Final': 'Final Result',
    'credencial administrador': 'administrator credential',
    privilegio: 'privilege',
    chrocme: 'chrome',
    aplicação: 'application',
    'data copia de segurança': 'backup date',
    'USB bloqueada': 'USB blocked',
    'Conta GD': 'GD Account',
    'data copia de segurança Google Drive': 'Google Drive backup date',
    'Rastrear todas as contas GD e gmail e verificar acessos de partilha':
      'Track all GD and Gmail accounts and sharing access',
    'Unifiormizar o desktop': 'Standardize desktop',
    'App estimulação cognmitiva': 'Cognitive stimulation app',
    Observações: 'Notes',
    'Hardware e sistema': 'Hardware and system',
    'Diagnóstico e reparação': 'Diagnosis and repair',
    'Configuração e contas': 'Configuration and accounts',
  },
}

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

const formatProfileDate = (value: string | undefined, language: AppLanguage) => {
  if (!value) return 'N/A'

  return new Intl.DateTimeFormat(language === 'pt' ? 'pt-PT' : 'en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

const getProfileDisplayName = (userProfile: Profile, fallback = 'Sem nome') =>
  stripOuterWhitespace(userProfile.full_name ?? '') || fallback

const emptyCreateUserForm = {
  fullName: '',
  email: '',
  password: '',
}

function App() {
  const [language, setLanguage] = useState<AppLanguage>(() =>
    window.localStorage.getItem(languageStorageKey) === 'en' ? 'en' : 'pt',
  )
  const [theme, setTheme] = useState<AppTheme>(() => {
    const storedTheme = window.localStorage.getItem(themeStorageKey)

    if (storedTheme === 'dark' || storedTheme === 'light') return storedTheme
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
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
  const t = translations[language]
  const localizedRoleLabels = roleLabels[language]
  const localizedStatusLabels = statusLabels[language]
  const manualSections = manualSectionsByLanguage[language]
  const translateRepairLabel = (label: string) => repairLabelTranslations[language][label] ?? label

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
        setAuthError(getFriendlyDataError(error, language))
      } finally {
        setIsLoading(false)
      }
    },
    [language, loadDevices, loadProfile],
  )

  const refreshUsers = useCallback(async () => {
    if (!canManageUsers) return

    setIsUsersLoading(true)
    setAuthError(null)

    try {
      await loadProfiles()
    } catch (error) {
      setAuthError(getFriendlyDataError(error, language))
    } finally {
      setIsUsersLoading(false)
    }
  }, [canManageUsers, language, loadProfiles])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(themeStorageKey, theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = language === 'pt' ? 'pt-PT' : 'en'
    window.localStorage.setItem(languageStorageKey, language)
  }, [language])

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
        setNotice(t.sessionActive)
        return
      }

      if (authForm.password.length < 6) {
        throw new Error(t.passwordMin)
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
          setNotice(t.recentConfirmation(getRemainingSeconds(storedSignupCooldown, Date.now())))
          return
        }

        const isRegistered = await checkEmailRegistered(email)

        if (isRegistered) {
          setAuthMode('login')
          setNotice(t.emailRegistered)
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
          setNotice(t.emailRegistered)
          return
        }

        if (data.user && !data.session) {
          setPendingConfirmationEmail(email)
          setSignupCooldownUntil(setCooldownUntil('signup', email))
          setResendCooldownUntil(setCooldownUntil('resend', email))
          setNotice(t.accountCreatedConfirm)
        } else {
          setPendingConfirmationEmail('')
          setNotice(t.accountCreated)
        }
      }
    } catch (error) {
      if (isExistingAccountError(error)) {
        setAuthMode('login')
        setNotice(t.emailRegistered)
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

      setAuthError(getFriendlyAuthError(error, language))
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
      setAuthError(t.enterEmailToConfirm)
      return
    }

    setResendCooldownUntil(storedCooldown)

    if (remaining > 0) {
      setNotice(t.waitBeforeResend(remaining))
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
      setNotice(t.confirmationResent)
    } catch (error) {
      if (isEmailRateLimitError(error)) {
        const nextCooldown = setCooldownUntil('resend', email)
        setResendCooldownUntil(nextCooldown)
      }

      setAuthError(getFriendlyAuthError(error, language))
    } finally {
      setIsResendingConfirmation(false)
    }
  }

  const handleSignOut = async () => {
    if (isDemoMode) {
      setNotice(t.demoSupabaseRequired)
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
        throw new Error(t.fillRequiredDevice)
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
          setNotice(t.deviceUpdatedDemo)
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
          setNotice(t.deviceAddedDemo)
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
        setNotice(t.deviceUpdated)
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
        setNotice(t.deviceAdded)
      }

      setDeviceForm(emptyDeviceForm)
      setEditingId(null)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : t.saveFailed)
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

    const confirmed = window.confirm(t.deleteOne(device.name))
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

      setNotice(t.deviceDeletedDemo)
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

    setNotice(t.deviceDeleted)
  }

  const deleteAllDevices = async () => {
    if (!canManageDevices) return

    if (devices.length === 0) {
      setNotice(t.noDevicesToDelete)
      return
    }

    const firstConfirmation = window.confirm(t.deleteAllConfirm(devices.length))
    if (!firstConfirmation) return

    const typedConfirmation = window.prompt(t.deleteAllPrompt)
    if (typedConfirmation !== 'APAGAR') {
      setNotice(t.deleteAllCancelled)
      return
    }

    setAuthError(null)
    setNotice(null)

    if (isDemoMode) {
      setDevices([])
      persistDemoDevices([])
      cancelEditing()
      setNotice(t.allDeletedDemo)
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
    setNotice(t.allDeleted)
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
        throw new Error(t.fillUser)
      }

      if (payload.password.length < 6) {
        throw new Error(t.passwordMin)
      }

      if (profiles.some((userProfile) => userProfile.email?.toLowerCase() === payload.email)) {
        throw new Error(t.userExists)
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
        setNotice(t.userCreatedDemo)
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
      setNotice(t.userCreated)
    } catch (error) {
      setAuthError(getFriendlyDataError(error, language))
    } finally {
      setIsCreatingUser(false)
    }
  }

  const updateProfileRole = async (targetProfile: Profile, nextRole: Profile['role']) => {
    if (!canManageUsers || targetProfile.role === nextRole) return

    if (targetProfile.id === currentProfileId) {
      setNotice(t.ownRoleBlocked)
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
        setNotice(t.roleUpdated(getProfileDisplayName(targetProfile, t.noName)))
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
      setNotice(t.roleUpdated(getProfileDisplayName(targetProfile, t.noName)))
    } catch (error) {
      setAuthError(getFriendlyDataError(error, language))
    } finally {
      setSavingProfileId(null)
    }
  }

  const exportDevicesCsv = () => {
    if (filteredDevices.length === 0) {
      setNotice(t.noExportVisible)
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
    setNotice(t.csvExported)
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
            throw new Error(t.csvUnreadable)
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
              throw new Error(t.csvLineRequired(index + 2))
            }

            importedBySerial.set(importedDevice.serial_number, importedDevice)
          })

          const importedDevices = Array.from(importedBySerial.values())

          if (importedDevices.length === 0) {
            throw new Error(t.csvEmpty)
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
            setNotice(t.csvImported(importedDevices.length))
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
          setNotice(t.csvImportedUpdated(importedDevices.length))
        } catch (error) {
          setAuthError(error instanceof Error ? error.message : t.csvImportFailed)
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

  const appControls = (
    <div className="app-controls" aria-label={t.displaySettings}>
      <label className="language-control">
        <Languages aria-hidden="true" />
        <span className="sr-only">{t.language}</span>
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value === 'en' ? 'en' : 'pt')}
          aria-label={t.language}
        >
          <option value="pt">PT</option>
          <option value="en">EN</option>
        </select>
      </label>
      <button
        type="button"
        className="icon-button"
        onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
        title={theme === 'dark' ? t.lightTheme : t.darkTheme}
        aria-label={theme === 'dark' ? t.lightTheme : t.darkTheme}
      >
        {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      </button>
    </div>
  )

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
            <p className="manual-kicker">{t.help}</p>
            <h2 id="manual-title">{t.manualTitle}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => setIsManualOpen(false)}
            title={t.closeManual}
            aria-label={t.closeManual}
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
          <div className="auth-toolbar">{appControls}</div>
          <BrandLogo className="auth-logo" />
          <div>
            <h1 id="auth-title">{t.appTitle}</h1>
            <p className="auth-subtitle">{t.dashboardAccess}</p>
            <button
              type="button"
              className="manual-button auth-manual-button"
              onClick={() => setIsManualOpen(true)}
              title={t.manual}
            >
              <BookOpen aria-hidden="true" />
              {t.manual}
            </button>
          </div>

          <div className="mode-tabs" role="tablist" aria-label={t.authTabLabel}>
            <button
              type="button"
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => {
                setAuthMode('login')
                setAuthError(null)
                setNotice(null)
              }}
            >
              {t.signIn}
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
              {t.createAccount}
            </button>
          </div>

          <form className="stack-form" onSubmit={handleAuthSubmit}>
            {authMode === 'signup' && (
              <label>
                {t.name}
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
              {t.email}
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
              {t.password}
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
                  <strong>{t.confirmEmailTitle}</strong>
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
                    ? t.resendIn(resendCooldownRemaining)
                    : t.resendConfirmation}
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
                ? t.signIn
                : signupCooldownRemaining > 0
                  ? t.waitSeconds(signupCooldownRemaining)
                  : t.createAccount}
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
          <h1>{t.appTitle}</h1>
        </div>
        <div className="topbar-actions">
          {appControls}
          <div className="account-box">
            <span className="role-badge">{localizedRoleLabels[currentRole]}</span>
            <span>{currentEmail}</span>
            <button
              type="button"
              className="manual-button"
              onClick={() => setIsManualOpen(true)}
              title={t.manual}
            >
              <BookOpen aria-hidden="true" />
              {t.manual}
            </button>
            <button type="button" className="icon-button" onClick={handleSignOut} title={t.signOut}>
              <LogOut aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {isDemoMode && (
        <section className="demo-banner">
          <div>
            <strong>{t.demoMode}</strong>
            <span>{t.demoModeDescription}</span>
          </div>
          <code>.env.local</code>
        </section>
      )}

      {canManageUsers && (
        <nav className="view-tabs" aria-label={t.managementAreas}>
          <button
            type="button"
            className={selectedView === 'devices' ? 'active' : ''}
            onClick={() => setActiveView('devices')}
          >
            <ClipboardList aria-hidden="true" />
            {t.devices}
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
            {t.users}
          </button>
        </nav>
      )}

      {selectedView === 'devices' ? (
        <>
      <section className="stats-grid" aria-label={t.devicesSummary}>
        <article>
          <span>{t.total}</span>
          <strong>{totals.all}</strong>
        </article>
        <article>
          <span>{localizedStatusLabels.active}</span>
          <strong>{totals.active}</strong>
        </article>
        <article>
          <span>{t.maintenance}</span>
          <strong>{totals.maintenance}</strong>
        </article>
        <article>
          <span>{t.archived}</span>
          <strong>{totals.retired}</strong>
        </article>
      </section>

      <div className="workspace">
        <section className="form-panel" aria-labelledby="device-form-title">
          <div className="section-heading">
            <h2 id="device-form-title">{editingId ? t.editDevice : t.newDevice}</h2>
            {editingId && (
              <button type="button" className="ghost-action" onClick={cancelEditing}>
                <X aria-hidden="true" />
                {t.cancel}
              </button>
            )}
          </div>

          {canManageDevices ? (
            <form className="device-form" onSubmit={handleDeviceSubmit}>
              <div className="form-section span-2">
                <h3>{t.formIdentification}</h3>
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
                    {translateRepairLabel('Data Entrada')}
                    <input
                      placeholder="Ex: 15/04/2026"
                      value={deviceForm.repair.entry_date}
                      onChange={(event) => updateRepairField('entry_date', event.target.value)}
                    />
                  </label>

                  <label>
                    {translateRepairLabel('Marca')}
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
                    {translateRepairLabel('Modelo')}
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
                    {translateRepairLabel('Nº Série')}
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
                  <h3>{translateRepairLabel(section.title)}</h3>
                  <div className="section-grid">
                    {section.fields.map((field) => (
                      <label className={field.multiline ? 'span-2' : ''} key={field.key}>
                        {translateRepairLabel(field.label)}
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
                {editingId ? t.saveChanges : t.addDevice}
              </button>
            </form>
          ) : (
            <div className="permission-panel">
              <CircleAlert aria-hidden="true" />
              <p>{t.readOnlyAccount}</p>
            </div>
          )}
        </section>

        <section className="list-panel" aria-labelledby="devices-title">
          <div className="section-heading">
            <div>
              <h2 id="devices-title">{t.devices}</h2>
              <p>
                {filteredDevices.length} {t.visibleRecords}
              </p>
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
                {t.exportCsv}
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
                  {t.importCsv}
                </button>
              )}
              {canManageDevices && (
                <button
                  type="button"
                  className="danger-action"
                  onClick={() => void deleteAllDevices()}
                >
                  <Trash2 aria-hidden="true" />
                  {t.deleteAll}
                </button>
              )}
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  if (isDemoMode) {
                    setNotice(t.demoRefreshed)
                    return
                  }

                  if (session) void refreshData(session)
                }}
                title={t.refresh}
                aria-label={t.refresh}
              >
                <RefreshCw aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="filters-row">
            <label className="search-field">
              <Search aria-hidden="true" />
              <input
                placeholder={t.search}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | DeviceStatus)}
              aria-label={t.filterByStatus}
            >
              <option value="all">{t.all}</option>
              {deviceStatuses.map((status) => (
                <option key={status} value={status}>
                  {localizedStatusLabels[status]}
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
              {t.loading}
            </div>
          ) : filteredDevices.length === 0 ? (
            <div className="empty-state">
              <ClipboardList aria-hidden="true" />
              <p>{t.noDevices}</p>
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
                      <th key={column.key}>{translateRepairLabel(column.label)}</th>
                    ))}
                    {canManageDevices && <th aria-label={t.actions} />}
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
                              title={t.edit}
                              aria-label={t.edit}
                            >
                              <Edit3 aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="icon-button danger"
                              onClick={() => void deleteDevice(device)}
                              title={t.delete}
                              aria-label={t.delete}
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
              <h2 id="users-title">{t.users}</h2>
              <p>
                {profiles.length} {t.registeredProfiles}
              </p>
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
              {t.refresh}
            </button>
          </div>

          <div className="users-note">
            <ShieldCheck aria-hidden="true" />
            <p>{t.usersNote}</p>
          </div>

          <form className="user-create-panel" onSubmit={createUser}>
            <div className="user-create-heading">
              <UserPlus aria-hidden="true" />
              <div>
                <h3>{t.createUser}</h3>
                <p>{t.usersNoteCreate}</p>
              </div>
            </div>
            <div className="user-create-form">
              <label>
                {t.name}
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
                {t.email}
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
                {t.temporaryPassword}
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
              <div className="fixed-role-preview" aria-label={t.permission}>
                <span>{t.permission}</span>
                <strong>{localizedRoleLabels.admin}</strong>
              </div>
            </div>
            <button className="primary-action" type="submit" disabled={isCreatingUser}>
              {isCreatingUser ? (
                <Loader2 className="spin" aria-hidden="true" />
              ) : (
                <UserPlus aria-hidden="true" />
              )}
              {t.createUser}
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
              {t.loadingUsers}
            </div>
          ) : profiles.length === 0 ? (
            <div className="empty-state">
              <UsersRound aria-hidden="true" />
              <p>{t.noUsers}</p>
            </div>
          ) : (
            <div className="table-wrap users-table-wrap">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>{t.users}</th>
                    <th>{t.currentPermission}</th>
                    <th>{t.updatePermission}</th>
                    <th>{t.created}</th>
                    <th>{t.updated}</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((userProfile) => {
                    const isCurrentProfile = userProfile.id === currentProfileId

                    return (
                      <tr key={userProfile.id}>
                        <td>
                          <div className="user-identity">
                            <strong>{getProfileDisplayName(userProfile, t.noName)}</strong>
                            {isCurrentProfile && <span>{t.thisIsYou}</span>}
                            {userProfile.email && <small>{userProfile.email}</small>}
                            <small>{userProfile.id}</small>
                          </div>
                        </td>
                        <td>
                          <span className={`role-badge role-${userProfile.role}`}>
                            {localizedRoleLabels[userProfile.role]}
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
                              aria-label={t.changePermissionFor(
                                getProfileDisplayName(userProfile, t.noName),
                              )}
                            >
                              {memberRoles.map((role) => (
                                <option key={role} value={role}>
                                  {localizedRoleLabels[role]}
                                </option>
                              ))}
                            </select>
                            {isCurrentProfile && (
                              <span className="role-helper">{t.protectedRole}</span>
                            )}
                          </div>
                        </td>
                        <td>{formatProfileDate(userProfile.created_at, language)}</td>
                        <td>{formatProfileDate(userProfile.updated_at, language)}</td>
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
