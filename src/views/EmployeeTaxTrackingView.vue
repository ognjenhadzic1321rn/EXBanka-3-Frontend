<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { clientManagementApi } from '../api/clientManagement'
import { actuaryApi } from '../api/actuary'
import { employeeTaxApi, type TaxRecord } from '../api/tax'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface TaxRow {
  id: string
  userType: 'client' | 'employee'
  ime: string
  prezime: string
  unpaidDebt: number
}

const rows = ref<TaxRow[]>([])
const loading = ref(false)
const error = ref('')

const typeFilter = ref<'all' | 'client' | 'employee'>('all')
const nameSearch = ref('')

const collecting = ref(false)
const collectResult = ref('')
const collectError = ref('')

const currentPeriod = new Date().toISOString().slice(0, 7) // YYYY-MM

// ---------------------------------------------------------------------------
// Filtered rows
// ---------------------------------------------------------------------------

const filteredRows = computed(() => {
  let r = rows.value
  if (typeFilter.value !== 'all') {
    r = r.filter(row => row.userType === typeFilter.value)
  }
  const needle = nameSearch.value.trim().toLowerCase()
  if (needle) {
    r = r.filter(row =>
      `${row.ime} ${row.prezime}`.toLowerCase().includes(needle)
    )
  }
  return r
})

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

async function loadAll() {
  loading.value = true
  error.value = ''
  try {
    const [clientRes, actuaryRes, recordsRes] = await Promise.all([
      clientManagementApi.list({ page: 1, pageSize: 1000 }),
      actuaryApi.list(),
      employeeTaxApi.getAllRecords(currentPeriod),
    ])

    const clients = clientRes.data.clients ?? []
    const actuaries = actuaryRes.data.actuaries ?? []
    const records: TaxRecord[] = Array.isArray(recordsRes.data) ? recordsRes.data : []

    // Build debt map: `${userType}:${userId}` → sum of unpaid tax_rsd
    const debtMap = new Map<string, number>()
    for (const rec of records) {
      if (rec.status !== 'unpaid') continue
      const key = `${rec.user_type}:${rec.user_id}`
      debtMap.set(key, (debtMap.get(key) ?? 0) + rec.tax_rsd)
    }

    const result: TaxRow[] = []

    for (const c of clients) {
      result.push({
        id: c.id,
        userType: 'client',
        ime: c.ime,
        prezime: c.prezime,
        unpaidDebt: debtMap.get(`client:${c.id}`) ?? 0,
      })
    }

    for (const a of actuaries) {
      result.push({
        id: a.employeeId,
        userType: 'employee',
        ime: a.ime,
        prezime: a.prezime,
        unpaidDebt: debtMap.get(`employee:${a.employeeId}`) ?? 0,
      })
    }

    // Sort: users with debt first, then alphabetically
    result.sort((a, b) => b.unpaidDebt - a.unpaidDebt || a.prezime.localeCompare(b.prezime))

    rows.value = result
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Greška pri učitavanju podataka.'
  } finally {
    loading.value = false
  }
}

// ---------------------------------------------------------------------------
// Manual collection trigger
// ---------------------------------------------------------------------------

async function triggerCollection() {
  collecting.value = true
  collectResult.value = ''
  collectError.value = ''
  try {
    const res = await employeeTaxApi.triggerCollection(currentPeriod)
    const d = res.data
    collectResult.value = `Obračun završen za period ${d.period}: ${d.users_processed} korisnika, ukupno naplaćeno ${fmt(d.total_collected)} RSD.`
    await loadAll()
  } catch (e: any) {
    collectError.value = e?.response?.data?.message ?? 'Greška pri pokretanju obračuna.'
  } finally {
    collecting.value = false
  }
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const formatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function fmt(v: number) { return formatter.format(v) }

onMounted(loadAll)
</script>

<template>
  <div class="tax-tracking-page">
    <div class="page-header">
      <div>
        <h1>Porez na kapitalnu dobit</h1>
        <p>Pregled dugovanja i pokretanje obračuna poreza — dostupno samo supervizorima.</p>
      </div>
      <button class="collect-btn" :disabled="collecting" @click="triggerCollection">
        {{ collecting ? 'Obračunavam...' : 'Pokreni obračun' }}
      </button>
    </div>

    <div v-if="collectResult" class="success-box">{{ collectResult }}</div>
    <div v-if="collectError" class="error-box">{{ collectError }}</div>

    <div class="filters">
      <input
        v-model="nameSearch"
        type="text"
        placeholder="Pretraži po imenu/prezimenu..."
        class="search-input"
      />
      <div class="type-tabs">
        <button
          v-for="opt in ([['all','Svi'],['client','Klijenti'],['employee','Aktuari']] as const)"
          :key="opt[0]"
          class="tab-btn"
          :class="{ active: typeFilter === opt[0] }"
          @click="typeFilter = opt[0]"
        >{{ opt[1] }}</button>
      </div>
    </div>

    <div v-if="loading" class="empty-state">Učitavam podatke...</div>
    <div v-else-if="error" class="error-box">{{ error }}</div>
    <div v-else>
      <div class="summary-bar">
        Prikazano {{ filteredRows.length }} od {{ rows.length }} korisnika za period {{ currentPeriod }}
      </div>

      <section class="panel">
        <div class="table-wrap">
          <table class="tax-table">
            <thead>
              <tr>
                <th>Ime</th>
                <th>Prezime</th>
                <th>Tip</th>
                <th>Dug za {{ currentPeriod }} (RSD)</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in filteredRows"
                :key="`${row.userType}:${row.id}`"
                :class="{ 'has-debt': row.unpaidDebt > 0 }"
              >
                <td>{{ row.ime }}</td>
                <td>{{ row.prezime }}</td>
                <td>
                  <span class="type-badge" :class="row.userType">
                    {{ row.userType === 'client' ? 'Klijent' : 'Aktuar' }}
                  </span>
                </td>
                <td>
                  <span :class="{ debt: row.unpaidDebt > 0 }">
                    {{ fmt(row.unpaidDebt) }}
                  </span>
                </td>
              </tr>
              <tr v-if="filteredRows.length === 0">
                <td colspan="4" class="empty-cell">Nema korisnika za prikaz.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.tax-tracking-page {
  padding: 32px;
  max-width: 1100px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0;
  font-size: 30px;
  color: #0f172a;
}

.page-header p {
  margin: 8px 0 0;
  color: #64748b;
}

.collect-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 10px;
  background: #0f172a;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}
.collect-btn:hover:not(:disabled) { background: #1e293b; }
.collect-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.filters {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 220px;
  padding: 9px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  font-size: 14px;
  color: #0f172a;
}
.search-input:focus { outline: none; border-color: #2563eb; }

.type-tabs {
  display: flex;
  gap: 6px;
}

.tab-btn {
  padding: 7px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.tab-btn.active {
  background: #0f172a;
  color: #fff;
  border-color: #0f172a;
}

.summary-bar {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 12px;
}

.panel {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.table-wrap { overflow-x: auto; }

.tax-table {
  width: 100%;
  border-collapse: collapse;
}

.tax-table th,
.tax-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
}

.tax-table th {
  font-size: 12px;
  text-transform: uppercase;
  color: #64748b;
}

.tax-table tr.has-debt {
  background: #fef9ec;
}

.type-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.type-badge.client {
  background: #eff6ff;
  color: #2563eb;
}

.type-badge.employee {
  background: #f5f3ff;
  color: #7c3aed;
}

.debt {
  color: #b91c1c;
  font-weight: 700;
}

.empty-cell {
  text-align: center;
  color: #64748b;
  padding: 24px;
}

.empty-state {
  padding: 32px;
  border-radius: 16px;
  background: #fff;
  color: #64748b;
  border: 1px solid #e2e8f0;
  text-align: center;
}

.error-box {
  padding: 14px 18px;
  border-radius: 12px;
  background: #fef2f2;
  color: #b91c1c;
  margin-bottom: 16px;
}

.success-box {
  padding: 14px 18px;
  border-radius: 12px;
  background: #f0fdf4;
  color: #15803d;
  margin-bottom: 16px;
}
</style>
