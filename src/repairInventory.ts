import type { Device, DeviceForm, DeviceStatus, RepairColumnKey, RepairDetails } from './types'

type RepairColumn = {
  key: RepairColumnKey | 'name' | 'serial_number' | 'model'
  label: string
  aliases?: string[]
  width: string
}

type RepairField = {
  key: RepairColumnKey
  label: string
  multiline?: boolean
}

export type RepairFieldSection = {
  title: string
  fields: RepairField[]
}

type ImportCsvRow = Record<string, string | undefined>

const repairNotesPrefix = '__MENTEMOVIMENTO_REPAIR_V1__'
const stripOuterWhitespace = (value: string) => value.replace(/^\s+|\s+$/g, '')

export const emptyRepairDetails: RepairDetails = {
  entry_date: '',
  brand: '',
  cpu: '',
  ram_gb: '',
  disk: '',
  operating_system: '',
  powers_on: '',
  has_image: '',
  bios: '',
  physical_state: '',
  needs_cleaning: '',
  fault: '',
  diagnosis: '',
  parts_needed: '',
  estimated_cost: '',
  estimated_time_min: '',
  technician: '',
  repair_status: '',
  final_result: '',
  admin_credential: '',
  privilege: '',
  chrome: '',
  application: '',
  backup_date: '',
  usb_blocked: '',
  gd_account: '',
  google_drive_backup_date: '',
  track_accounts_sharing: '',
  standardize_desktop: '',
  cognitive_app: '',
  observations: '',
}

export const repairTableColumns: RepairColumn[] = [
  { key: 'name', label: 'ID', aliases: ['ID', 'Nome', 'Identificador'], width: '82px' },
  {
    key: 'entry_date',
    label: 'Data Entrada',
    aliases: ['Data Entrada', 'Data de Entrada'],
    width: '126px',
  },
  { key: 'brand', label: 'Marca', aliases: ['Marca'], width: '118px' },
  { key: 'model', label: 'Modelo', aliases: ['Modelo', 'Model'], width: '130px' },
  {
    key: 'serial_number',
    label: 'Nº Série',
    aliases: ['Nº Série', 'N Série', 'Numero de serie', 'Número de série', 'Serial'],
    width: '158px',
  },
  { key: 'cpu', label: 'CPU', aliases: ['CPU', 'Processador'], width: '116px' },
  { key: 'ram_gb', label: 'RAM (GB)', aliases: ['RAM (GB)', 'RAM', 'Memoria'], width: '94px' },
  { key: 'disk', label: 'Disco', aliases: ['Disco', 'SSD', 'HDD'], width: '104px' },
  {
    key: 'operating_system',
    label: 'Sistema Operativo',
    aliases: ['Sistema Operativo', 'SO', 'Sistema Operacional'],
    width: '165px',
  },
  { key: 'powers_on', label: 'Liga', aliases: ['Liga'], width: '82px' },
  { key: 'has_image', label: 'Dá Imagem', aliases: ['Dá Imagem', 'Da Imagem'], width: '108px' },
  { key: 'bios', label: 'BIOS', aliases: ['BIOS'], width: '100px' },
  {
    key: 'physical_state',
    label: 'Estado Físico',
    aliases: ['Estado Físico', 'Estado Fisico'],
    width: '130px',
  },
  {
    key: 'needs_cleaning',
    label: 'Necessita Limpeza',
    aliases: ['Necessita Limpeza', 'Limpeza'],
    width: '154px',
  },
  { key: 'fault', label: 'Avaria', aliases: ['Avaria'], width: '180px' },
  { key: 'diagnosis', label: 'Diagnóstico', aliases: ['Diagnóstico', 'Diagnostico'], width: '260px' },
  {
    key: 'parts_needed',
    label: 'Peças Necessárias',
    aliases: ['Peças Necessárias', 'Pecas Necessarias'],
    width: '190px',
  },
  {
    key: 'estimated_cost',
    label: 'Custo Estimado',
    aliases: ['Custo Estimado'],
    width: '132px',
  },
  {
    key: 'estimated_time_min',
    label: 'Tempo Estimado (min)',
    aliases: ['Tempo Estimado (min)', 'Tempo Estimado'],
    width: '178px',
  },
  { key: 'technician', label: 'Técnico', aliases: ['Técnico', 'Tecnico'], width: '132px' },
  { key: 'repair_status', label: 'Estado', aliases: ['Estado', 'Status'], width: '118px' },
  {
    key: 'final_result',
    label: 'Resultado Final',
    aliases: ['Resultado Final'],
    width: '150px',
  },
  {
    key: 'admin_credential',
    label: 'credencial administrador',
    aliases: ['credencial administrador', 'credencial admin'],
    width: '190px',
  },
  { key: 'privilege', label: 'privilegio', aliases: ['privilegio', 'privilégio'], width: '120px' },
  { key: 'chrome', label: 'chrocme', aliases: ['chrocme', 'chrome'], width: '100px' },
  { key: 'application', label: 'aplicação', aliases: ['aplicação', 'aplicacao'], width: '120px' },
  {
    key: 'backup_date',
    label: 'data copia de segurança',
    aliases: ['data copia de segurança', 'data copia de seguranca'],
    width: '190px',
  },
  {
    key: 'usb_blocked',
    label: 'USB bloqueada',
    aliases: ['USB bloqueada', 'USB bloqueado'],
    width: '128px',
  },
  { key: 'gd_account', label: 'Conta GD', aliases: ['Conta GD'], width: '210px' },
  {
    key: 'google_drive_backup_date',
    label: 'data copia de segurança Google Drive',
    aliases: [
      'data copia de segurança  Google Drive',
      'data copia de segurança Google Drive',
      'data copia de seguranca Google Drive',
    ],
    width: '260px',
  },
  {
    key: 'track_accounts_sharing',
    label: 'Rastrear todas as contas GD e gmail e verificar acessos de partilha',
    aliases: ['Rastrear todas as contas GD e gmail e verificar acessos de partilha'],
    width: '390px',
  },
  {
    key: 'standardize_desktop',
    label: 'Unifiormizar o desktop',
    aliases: ['Unifiormizar o desktop', 'Uniformizar o desktop'],
    width: '180px',
  },
  {
    key: 'cognitive_app',
    label: 'App estimulação cognmitiva',
    aliases: ['App estimulação cognmitiva', 'App estimulação cognitiva'],
    width: '200px',
  },
  { key: 'observations', label: 'Observações', aliases: ['Observações', 'Observacoes'], width: '260px' },
]

export const repairCsvHeaders = repairTableColumns.map((column) => column.label)

export const repairFormSections: RepairFieldSection[] = [
  {
    title: 'Hardware e sistema',
    fields: [
      { key: 'cpu', label: 'CPU' },
      { key: 'ram_gb', label: 'RAM (GB)' },
      { key: 'disk', label: 'Disco' },
      { key: 'operating_system', label: 'Sistema Operativo' },
      { key: 'powers_on', label: 'Liga' },
      { key: 'has_image', label: 'Dá Imagem' },
      { key: 'bios', label: 'BIOS' },
      { key: 'physical_state', label: 'Estado Físico' },
      { key: 'needs_cleaning', label: 'Necessita Limpeza' },
    ],
  },
  {
    title: 'Diagnóstico e reparação',
    fields: [
      { key: 'fault', label: 'Avaria' },
      { key: 'diagnosis', label: 'Diagnóstico', multiline: true },
      { key: 'parts_needed', label: 'Peças Necessárias' },
      { key: 'estimated_cost', label: 'Custo Estimado' },
      { key: 'estimated_time_min', label: 'Tempo Estimado (min)' },
      { key: 'technician', label: 'Técnico' },
      { key: 'repair_status', label: 'Estado' },
      { key: 'final_result', label: 'Resultado Final' },
    ],
  },
  {
    title: 'Configuração e contas',
    fields: [
      { key: 'admin_credential', label: 'credencial administrador' },
      { key: 'privilege', label: 'privilegio' },
      { key: 'chrome', label: 'chrocme' },
      { key: 'application', label: 'aplicação' },
      { key: 'backup_date', label: 'data copia de segurança' },
      { key: 'usb_blocked', label: 'USB bloqueada' },
      { key: 'gd_account', label: 'Conta GD' },
      { key: 'google_drive_backup_date', label: 'data copia de segurança Google Drive' },
      {
        key: 'track_accounts_sharing',
        label: 'Rastrear contas GD/Gmail e acessos de partilha',
        multiline: true,
      },
      { key: 'standardize_desktop', label: 'Unifiormizar o desktop' },
      { key: 'cognitive_app', label: 'App estimulação cognmitiva' },
      { key: 'observations', label: 'Observações', multiline: true },
    ],
  },
]

export const normalizeCsvKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

export const parseCsvStatus = (value: string): DeviceStatus => {
  const status = normalizeCsvKey(value)

  if (
    status.includes('reparo') ||
    status.includes('manutencao') ||
    status.includes('maintenance') ||
    status.includes('avaria')
  ) {
    return 'maintenance'
  }

  if (status.includes('arquivado') || status.includes('retired') || status.includes('abate')) {
    return 'retired'
  }

  return 'active'
}

const readCsvField = (row: ImportCsvRow, aliases: string[]) => {
  const normalizedAliases = aliases.map(normalizeCsvKey)
  const match = Object.entries(row).find(([key]) =>
    normalizedAliases.includes(normalizeCsvKey(key)),
  )

  return stripOuterWhitespace(String(match?.[1] ?? ''))
}

export const encodeRepairDetails = (details: RepairDetails) =>
  `${repairNotesPrefix}${JSON.stringify(details)}`

export const decodeRepairDetails = (device: Device): RepairDetails => {
  if (device.notes?.startsWith(repairNotesPrefix)) {
    try {
      return {
        ...emptyRepairDetails,
        ...(JSON.parse(device.notes.slice(repairNotesPrefix.length)) as Partial<RepairDetails>),
        brand: device.location ?? '',
      }
    } catch {
      return { ...emptyRepairDetails, brand: device.location ?? '', observations: device.notes ?? '' }
    }
  }

  return {
    ...emptyRepairDetails,
    brand: device.location ?? '',
    repair_status: device.status,
    observations: device.notes ?? '',
  }
}

export const deviceToForm = (device: Device): DeviceForm => {
  const repair = decodeRepairDetails(device)

  return {
    name: device.name,
    serial_number: device.serial_number,
    model: device.model,
    brand: repair.brand || device.location || '',
    status: device.status,
    repair,
  }
}

export const csvRowToDeviceForm = (row: ImportCsvRow): DeviceForm => {
  const repair = { ...emptyRepairDetails }

  repairTableColumns.forEach((column) => {
    if (column.key === 'name' || column.key === 'serial_number' || column.key === 'model') return
    repair[column.key] = readCsvField(row, [column.label, ...(column.aliases ?? [])])
  })

  const repairStatus = repair.repair_status || readCsvField(row, ['Estado', 'Status'])

  return {
    name: readCsvField(row, ['ID', 'Nome', 'Identificador']),
    serial_number: readCsvField(row, ['Nº Série', 'Numero de serie', 'Número de série', 'Serial']),
    model: readCsvField(row, ['Modelo', 'Model']),
    brand: repair.brand,
    status: parseCsvStatus(repairStatus),
    repair: {
      ...repair,
      repair_status: repairStatus,
    },
  }
}

export const formToRepairDetails = (form: DeviceForm): RepairDetails => ({
  ...form.repair,
  brand: form.brand,
  repair_status: form.repair.repair_status || form.status,
})

export const deviceToCsvRow = (device: Device): Record<string, string> => {
  const repair = decodeRepairDetails(device)

  return Object.fromEntries(
    repairTableColumns.map((column) => {
      if (column.key === 'name') return [column.label, device.name]
      if (column.key === 'serial_number') return [column.label, device.serial_number]
      if (column.key === 'model') return [column.label, device.model]

      return [column.label, repair[column.key] ?? '']
    }),
  )
}

export const getRepairTableValue = (device: Device, column: RepairColumn) => {
  if (column.key === 'name') return device.name
  if (column.key === 'serial_number') return device.serial_number
  if (column.key === 'model') return device.model

  return decodeRepairDetails(device)[column.key] || '-'
}
