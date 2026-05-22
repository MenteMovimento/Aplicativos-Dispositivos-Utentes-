export type DeviceStatus = 'active' | 'maintenance' | 'retired'

export type MemberRole = 'admin' | 'manager' | 'member'

export type Profile = {
  id: string
  full_name: string | null
  role: MemberRole
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

export type DeviceForm = {
  name: string
  serial_number: string
  model: string
  location: string
  status: DeviceStatus
  notes: string
}
