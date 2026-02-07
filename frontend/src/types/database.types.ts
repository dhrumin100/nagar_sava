export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            civic_reports: {
                Row: {
                    id: string
                    created_at: string
                    updated_at: string
                    issue_type: string
                    description: string
                    photo_urls: string[] | null
                    latitude: number
                    longitude: number
                    address: string
                    status: string
                    priority: string | null
                    user_id: string
                    reporter_name: string | null
                    reporter_phone: string | null
                    assigned_to: string | null
                    assigned_dept_id: string | null
                    resolution_notes: string | null
                    alert_triggered: boolean | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    issue_type: string
                    description: string
                    photo_urls?: string[] | null
                    latitude: number
                    longitude: number
                    address: string
                    status?: string
                    priority?: string | null
                    user_id: string
                    reporter_name?: string | null
                    reporter_phone?: string | null
                    assigned_to?: string | null
                    assigned_dept_id?: string | null
                    resolution_notes?: string | null
                    alert_triggered?: boolean | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    issue_type?: string
                    description?: string
                    photo_urls?: string[] | null
                    latitude?: number
                    longitude?: number
                    address?: string
                    status?: string
                    priority?: string | null
                    user_id?: string
                    reporter_name?: string | null
                    reporter_phone?: string | null
                    assigned_to?: string | null
                    assigned_dept_id?: string | null
                    resolution_notes?: string | null
                    alert_triggered?: boolean | null
                }
            }
            profiles: {
                Row: {
                    id: string
                    email: string | null
                    full_name: string | null
                    avatar_url: string | null
                    role: string | null
                    dept_id: string | null
                    points: number | null
                    level: string | null
                    updated_at: string | null
                }
                Insert: {
                    id: string
                    email?: string | null
                    full_name?: string | null
                    avatar_url?: string | null
                    role?: string | null
                    dept_id?: string | null
                    points?: number | null
                    level?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    email?: string | null
                    full_name?: string | null
                    avatar_url?: string | null
                    role?: string | null
                    dept_id?: string | null
                    points?: number | null
                    level?: string | null
                    updated_at?: string | null
                }
            }
        }
    }
}
