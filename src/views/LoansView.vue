<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { employeeLoanApi, type Loan } from '../api/employeeLoan'
import { LOAN_TYPES, LOAN_STATUS_LABELS, loanApi, type LoanInstallment } from '../api/loan'

const loans = ref<Loan[]>([])
const loading = ref(false)
const error = ref('')

const filterVrsta = ref('')
const filterBrojRacuna = ref('')
const filterStatus = ref('')

// For installment-based remaining debt calculation
const installmentsCache = ref<Record<number, LoanInstallment[]>>({})

const STATUSES = [
  { value: 'zahtev',   label: 'Zahtev' },
  { value: 'odobren',  label: 'Odobren' },
  { value: 'odbijen',  label: 'Odbijen' },
  { value: 'aktivan',  label: 'Aktivan' },
  { value: 'zatvoren', label: 'Zatvoren' },
]

// Sorted by broj_racuna as per spec
const sortedLoans = computed(() =>
  [...loans.value].sort((a, b) => a.broj_racuna.localeCompare(b.broj_racuna))
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await employeeLoanApi.listAll({
      vrsta: filterVrsta.value,
      brojRacuna: filterBrojRacuna.value,
      status: filterStatus.value,
    })
    loans.value = res.data ?? []
    // Load installments for active loans to compute remaining debt
    installmentsCache.value = {}
    const activeLoans = loans.value.filter(l => l.status === 'aktivan' || l.status === 'odobren')
    await Promise.all(
      activeLoans.map(async (loan) => {
        try {
          const res = await loanApi.listInstallments(loan.id)
          installmentsCache.value[loan.id] = res.data ?? []
        } catch {
          installmentsCache.value[loan.id] = []
        }
      })
    )
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Greška pri učitavanju kredita.'
  } finally {
    loading.value = false
  }
}

function clearFilters() {
  filterVrsta.value = ''
  filterBrojRacuna.value = ''
  filterStatus.value = ''
  load()
}

function remainingDebt(loan: Loan): string {
  const installments = installmentsCache.value[loan.id]
  if (!installments || installments.length === 0) return '—'
  const debt = installments
    .filter(i => i.status === 'ocekuje' || i.status === 'kasni')
    .reduce((sum, i) => sum + i.iznos, 0)
  return fmtMoney(debt)
}

function vrstaLabel(v: string) {
  return LOAN_TYPES.find(t => t.value === v)?.label ?? v
}

function statusBadgeClass(s: string) {
  switch (s) {
    case 'aktivan':  return 'badge badge-green'
    case 'zahtev':   return 'badge badge-yellow'
    case 'odobren':  return 'badge badge-blue'
    case 'odbijen':  return 'badge badge-red'
    case 'zatvoren': return 'badge badge-gray'
    default: return 'badge badge-gray'
  }
}

function fmtMoney(n: number) {
  if (n == null) return '—'
  return n.toLocaleString('sr-RS', { minimumFractionDigits: 2 })
}

function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('sr-RS')
}

onMounted(load)
</script>

<template>
  <div class="page-content">
    <div class="page-header">
      <h1>Svi krediti</h1>
      <span style="font-size:14px;color:#6b7280">{{ loans.length }} pronađeno</span>
    </div>

    <!-- Filters -->
    <div class="filters">
      <select v-model="filterVrsta" @change="load">
        <option value="">Sve vrste</option>
        <option v-for="t in LOAN_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
      </select>
      <select v-model="filterStatus" @change="load">
        <option value="">Svi statusi</option>
        <option v-for="s in STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>
      <input
        v-model="filterBrojRacuna"
        placeholder="Broj računa"
        @keyup.enter="load"
      />
      <button class="btn-primary" @click="load">Pretraži</button>
      <button class="btn-secondary" @click="clearFilters">Poništi</button>
    </div>

    <p v-if="error" class="global-error" style="margin-bottom:12px">{{ error }}</p>

    <div class="card" style="padding:0;overflow:hidden">
      <table>
        <thead>
          <tr>
            <th>Vrsta</th>
            <th>Tip kamate</th>
            <th>Datum ugovaranja</th>
            <th>Period</th>
            <th>Broj računa</th>
            <th>Iznos</th>
            <th>Preostalo dugovanje</th>
            <th>Valuta</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="9" style="text-align:center;padding:24px;color:#6b7280">Učitavam...</td>
          </tr>
          <tr v-else-if="sortedLoans.length === 0">
            <td colspan="9" style="text-align:center;padding:24px;color:#6b7280">Nema kredita koji odgovaraju filterima.</td>
          </tr>
          <tr v-for="loan in sortedLoans" :key="loan.id">
            <td>{{ vrstaLabel(loan.vrsta) }}</td>
            <td>{{ loan.tip_kamate === 'fiksna' ? 'Fiksna' : 'Varijabilna' }}</td>
            <td>{{ fmtDate(loan.datum_kreiranja) }}</td>
            <td>{{ loan.period }} mes.</td>
            <td><code style="font-size:12px">{{ loan.broj_racuna }}</code></td>
            <td style="font-weight:600">{{ fmtMoney(loan.iznos) }}</td>
            <td>{{ remainingDebt(loan) }}</td>
            <td>RSD</td>
            <td><span :class="statusBadgeClass(loan.status)">{{ LOAN_STATUS_LABELS[loan.status] ?? loan.status }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h1 { font-size: 22px; font-weight: 700; }
.filters { display: flex; gap: 10px; margin-bottom: 16px; align-items: center; flex-wrap: wrap; }
.filters select, .filters input { width: auto; min-width: 160px; }
.badge-yellow { background: #fef9c3; color: #854d0e; }
.badge-blue   { background: #dbeafe; color: #1d4ed8; }
.badge-gray   { background: #f1f5f9; color: #475569; }
</style>
