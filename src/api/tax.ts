import clientApi from './clientAuth'
import employeeApi from './client'

// ---------------------------------------------------------------------------
// Types — mirror getUserSummary response from tax_http_handler.go
// ---------------------------------------------------------------------------

export interface TaxSummary {
  user_id: number
  user_type: string
  period: string
  total_unpaid: number
  paid_this_year: number
  record_count: number
}

// ---------------------------------------------------------------------------
// Client-facing API (uses client JWT)
// ---------------------------------------------------------------------------

export const clientTaxApi = {
  /** GET /api/v1/tax/summary/{userId}?userType=client&period=YYYY-MM */
  getSummary(userId: number, period?: string): Promise<{ data: TaxSummary }> {
    const params: Record<string, string> = { userType: 'client' }
    if (period) params.period = period
    return clientApi.get(`/api/v1/tax/summary/${userId}`, { params })
  },
}

// ---------------------------------------------------------------------------
// Employee-facing API (uses employee JWT)
// ---------------------------------------------------------------------------

export interface TaxRecord {
  id: number
  user_id: number
  user_type: string
  asset_id: number
  profit_rsd: number
  tax_rsd: number
  period: string
  status: 'unpaid' | 'paid'
  created_at: string
}

export const employeeTaxApi = {
  /** GET /api/v1/tax/summary/{userId}?userType=employee&period=YYYY-MM */
  getSummary(userId: number, userType = 'employee', period?: string): Promise<{ data: TaxSummary }> {
    const params: Record<string, string> = { userType }
    if (period) params.period = period
    return employeeApi.get(`/api/v1/tax/summary/${userId}`, { params })
  },

  /** GET /api/v1/tax/records?period=YYYY-MM — supervisor only */
  getAllRecords(period?: string): Promise<{ data: TaxRecord[] }> {
    const params: Record<string, string> = {}
    if (period) params.period = period
    return employeeApi.get('/api/v1/tax/records', { params })
  },

  /** POST /api/v1/tax/collect — supervisor only */
  triggerCollection(period?: string): Promise<{ data: { period: string; users_processed: number; total_collected: number } }> {
    return employeeApi.post('/api/v1/tax/collect', period ? { period } : {})
  },
}
