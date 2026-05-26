export type DeviceStatus = 'active' | 'maintenance' | 'retired'

export type MemberRole = 'admin' | 'manager' | 'member'

export type Profile = {
  id: string
  email?: string | null
  full_name: string | null
  role: MemberRole
  created_at?: string
  updated_at?: string
}

export type Device = {
  id: string
  name: string
  serial_number: string
  model: string
  location: string | null
  status: DeviceStatus
  notes: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type DeviceHistoryEntry = {
  id: string
  device_id: string | null
  device_name: string | null
  serial_number: string | null
  action: string
  summary: string | null
  created_by: string | null
  created_at: string
}

export type DeviceAttachment = {
  id: string
  device_id: string
  file_name: string
  file_path: string
  file_type: string | null
  file_size: number | null
  uploaded_by: string | null
  created_at: string
}

export type RepairDetails = {
  entry_date: string
  brand: string
  cpu: string
  ram_gb: string
  disk: string
  operating_system: string
  powers_on: string
  has_image: string
  bios: string
  physical_state: string
  needs_cleaning: string
  fault: string
  diagnosis: string
  parts_needed: string
  estimated_cost: string
  estimated_time_min: string
  technician: string
  repair_status: string
  final_result: string
  admin_credential: string
  privilege: string
  chrome: string
  application: string
  backup_date: string
  usb_blocked: string
  gd_account: string
  google_drive_backup_date: string
  track_accounts_sharing: string
  standardize_desktop: string
  cognitive_app: string
  observations: string
}

export type RepairColumnKey = keyof RepairDetails

export type DeviceForm = {
  name: string
  serial_number: string
  model: string
  brand: string
  status: DeviceStatus
  repair: RepairDetails
}
