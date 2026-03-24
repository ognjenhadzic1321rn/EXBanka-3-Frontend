<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePaymentStore } from '../../stores/payment'
import { useClientAuthStore } from '../../stores/clientAuth'
import type { PaymentItem } from '../../api/payment'
import jsPDF from 'jspdf'

const router = useRouter()
const clientAuthStore = useClientAuthStore()
const paymentStore = usePaymentStore()

const clientId = computed(() => String(clientAuthStore.client?.id ?? ''))

const selectedPayment = ref<PaymentItem | null>(null)
const filter = ref({ status: '', dateFrom: '', dateTo: '' })

async function applyFilter() {
  paymentStore.page = 1
  await paymentStore.fetchByClient(clientId.value, {
    status: filter.value.status || undefined,
    dateFrom: filter.value.dateFrom || undefined,
    dateTo: filter.value.dateTo || undefined,
  })
}

async function prevPage() {
  if (paymentStore.page > 1) { paymentStore.page--; await applyFilter() }
}
async function nextPage() {
  if (paymentStore.page * paymentStore.pageSize < paymentStore.total) { paymentStore.page++; await applyFilter() }
}

const totalPages = computed(() => Math.ceil(paymentStore.total / paymentStore.pageSize) || 1)

function statusLabel(s: string) {
  switch (s) {
    case 'uspesno': return 'Uspešno'
    case 'neuspesno': return 'Neuspešno'
    case 'u_obradi': return 'U obradi'
    case 'stornirano': return 'Stornirano'
    default: return s
  }
}

function statusClass(s: string) {
  switch (s) {
    case 'uspesno': return 'pst-success'
    case 'neuspesno': return 'pst-error'
    case 'u_obradi': return 'pst-pending'
    case 'stornirano': return 'pst-neutral'
    default: return 'pst-neutral'
  }
}

function printPotvrda(p: PaymentItem) {
  const doc = new jsPDF()
  const date = new Date(p.vremeTransakcije).toLocaleString('sr-RS')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Potvrda o plaćanju', 105, 20, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text('EXBanka — potvrda transakcije', 105, 28, { align: 'center' })
  doc.line(14, 33, 196, 33)

  doc.setTextColor(0)
  doc.setFontSize(12)
  const rows: [string, string][] = [
    ['ID transakcije', `#${p.id}`],
    ['Status', statusLabel(p.status)],
    ['Iznos', `${p.iznos.toLocaleString('sr-RS', { minimumFractionDigits: 2 })} RSD`],
    ['Račun primaoca', p.racunPrimaocaBroj],
    ['Šifra plaćanja', p.sifraPlacanja || '—'],
    ['Poziv na broj', p.pozivNaBroj || '—'],
    ['Svrha', p.svrha || '—'],
    ['Datum i vreme', date],
  ]
  let y = 45
  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'bold')
    doc.text(label + ':', 14, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, 80, y)
    y += 10
  }

  doc.line(14, y + 2, 196, y + 2)
  doc.setFontSize(9)
  doc.setTextColor(150)
  doc.text('Ovaj dokument je automatski generisan i važi bez potpisa.', 105, y + 10, { align: 'center' })

  doc.save(`potvrda-placanja-${p.id}.pdf`)
}

onMounted(async () => {
  if (clientId.value) await paymentStore.fetchByClient(clientId.value)
})
</script>

<template>
  <div class="pv-page">
    <div class="pv-header">
      <div>
        <h1 class="pv-title">Pregled plaćanja</h1>
        <p class="pv-subtitle">Istorija svih vaših plaćanja</p>
      </div>
      <button class="pv-btn pv-btn-primary" @click="router.push('/client/payments/new')">+ Novo plaćanje</button>
    </div>

    <!-- Filters -->
    <div class="pv-filters">
      <select v-model="filter.status" @change="applyFilter">
        <option value="">Svi statusi</option>
        <option value="u_obradi">U obradi</option>
        <option value="uspesno">Uspešno</option>
        <option value="neuspesno">Neuspešno</option>
        <option value="stornirano">Stornirano</option>
      </select>
      <div class="pv-date-group">
        <label>Od</label>
        <input v-model="filter.dateFrom" type="date" @change="applyFilter" />
      </div>
      <div class="pv-date-group">
        <label>Do</label>
        <input v-model="filter.dateTo" type="date" @change="applyFilter" />
      </div>
    </div>

    <!-- Content -->
    <div v-if="paymentStore.loading" class="pv-empty">Učitavam...</div>
    <div v-else-if="paymentStore.error" class="pv-error">{{ paymentStore.error }}</div>
    <div v-else-if="paymentStore.payments.length === 0" class="pv-empty-state">
      <div class="pv-empty-icon">▤</div>
      <h3>Nema plaćanja</h3>
      <p>Kreirajte novo plaćanje da biste započeli.</p>
      <button class="pv-btn pv-btn-primary" @click="router.push('/client/payments/new')">+ Novo plaćanje</button>
    </div>

    <div v-else class="pv-list">
      <div
        v-for="p in paymentStore.payments"
        :key="p.id"
        class="pv-card"
        @click="selectedPayment = p"
      >
        <div class="pv-card-left">
          <div class="pv-card-icon" :class="statusClass(p.status)">▤</div>
          <div class="pv-card-info">
            <div class="pv-card-svrha">{{ p.svrha || 'Plaćanje' }}</div>
            <div class="pv-card-meta">
              {{ new Date(p.vremeTransakcije).toLocaleDateString('sr-RS') }} · {{ p.racunPrimaocaBroj }}
            </div>
          </div>
        </div>
        <div class="pv-card-right">
          <div class="pv-card-amount">{{ p.iznos.toLocaleString('sr-RS', { minimumFractionDigits: 2 }) }}</div>
          <span :class="['pv-status', statusClass(p.status)]">{{ statusLabel(p.status) }}</span>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="paymentStore.total > paymentStore.pageSize" class="pv-pagination">
      <button :disabled="paymentStore.page <= 1" @click="prevPage">‹</button>
      <span>{{ paymentStore.page }} / {{ totalPages }}</span>
      <button :disabled="paymentStore.page >= totalPages" @click="nextPage">›</button>
    </div>

    <!-- Detail Modal -->
    <div v-if="selectedPayment" class="pv-overlay" @click.self="selectedPayment = null">
      <div class="pv-modal">
        <div class="pv-modal-header">
          <h2>Detalji plaćanja</h2>
          <button class="pv-modal-close" @click="selectedPayment = null">✕</button>
        </div>
        <div class="pv-modal-body">
          <div class="pv-detail-status" :class="statusClass(selectedPayment.status)">
            {{ statusLabel(selectedPayment.status) }}
          </div>
          <div class="pv-detail-amount">
            {{ selectedPayment.iznos.toLocaleString('sr-RS', { minimumFractionDigits: 2 }) }} RSD
          </div>

          <div class="pv-detail-grid">
            <div class="pv-detail-item">
              <span class="pv-detail-label">Svrha</span>
              <span>{{ selectedPayment.svrha }}</span>
            </div>
            <div class="pv-detail-item">
              <span class="pv-detail-label">Račun primaoca</span>
              <span class="pv-mono">{{ selectedPayment.racunPrimaocaBroj }}</span>
            </div>
            <div class="pv-detail-item">
              <span class="pv-detail-label">Šifra plaćanja</span>
              <span>{{ selectedPayment.sifraPlacanja }}</span>
            </div>
            <div class="pv-detail-item">
              <span class="pv-detail-label">Poziv na broj</span>
              <span>{{ selectedPayment.pozivNaBroj || '—' }}</span>
            </div>
            <div class="pv-detail-item">
              <span class="pv-detail-label">Datum</span>
              <span>{{ new Date(selectedPayment.vremeTransakcije).toLocaleString('sr-RS') }}</span>
            </div>
            <div class="pv-detail-item">
              <span class="pv-detail-label">ID transakcije</span>
              <span class="pv-mono">#{{ selectedPayment.id }}</span>
            </div>
          </div>
        </div>
        <div class="pv-modal-footer">
          <button class="pv-btn pv-btn-sec" @click="selectedPayment = null">Zatvori</button>
          <button class="pv-btn pv-btn-primary" @click="printPotvrda(selectedPayment!)">Štampaj potvrdu</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pv-page { padding: 32px; max-width: 900px; margin: 0 auto; }
.pv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
.pv-title { font-size: 28px; font-weight: 700; color: #0f172a; }
.pv-subtitle { font-size: 14px; color: #64748b; margin-top: 4px; }

.pv-btn { padding: 10px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; border: none; cursor: pointer; transition: all 0.15s; }
.pv-btn-primary { background: #2563eb; color: #fff; }
.pv-btn-primary:hover { background: #1d4ed8; }
.pv-btn-sec { background: #f1f5f9; color: #475569; }
.pv-btn-sec:hover { background: #e2e8f0; }

/* Filters */
.pv-filters {
  display: flex; gap: 12px; margin-bottom: 20px; align-items: flex-end; flex-wrap: wrap;
}
.pv-filters select, .pv-filters input {
  padding: 9px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px;
}
.pv-date-group { display: flex; flex-direction: column; gap: 4px; }
.pv-date-group label { font-size: 11px; color: #64748b; font-weight: 600; }

/* List */
.pv-list { display: flex; flex-direction: column; gap: 8px; }
.pv-card {
  display: flex; justify-content: space-between; align-items: center;
  background: #fff; border-radius: 12px; padding: 18px 20px;
  border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  cursor: pointer; transition: all 0.15s;
}
.pv-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-color: #cbd5e1; }
.pv-card-left { display: flex; align-items: center; gap: 14px; min-width: 0; flex: 1; }
.pv-card-icon {
  width: 42px; height: 42px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; flex-shrink: 0;
}
.pv-card-icon.pst-success { background: #dcfce7; color: #16a34a; }
.pv-card-icon.pst-error { background: #fee2e2; color: #dc2626; }
.pv-card-icon.pst-pending { background: #fef9c3; color: #ca8a04; }
.pv-card-icon.pst-neutral { background: #f1f5f9; color: #64748b; }
.pv-card-info { min-width: 0; }
.pv-card-svrha { font-weight: 600; color: #1e293b; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pv-card-meta { font-size: 12px; color: #94a3b8; margin-top: 2px; }
.pv-card-right { text-align: right; flex-shrink: 0; margin-left: 16px; }
.pv-card-amount { font-weight: 700; color: #0f172a; font-size: 16px; }
.pv-status {
  display: inline-block; padding: 3px 10px; border-radius: 20px;
  font-size: 11px; font-weight: 600; margin-top: 4px;
}
.pst-success { background: #dcfce7; color: #166534; }
.pst-error { background: #fee2e2; color: #991b1b; }
.pst-pending { background: #fef9c3; color: #854d0e; }
.pst-neutral { background: #f1f5f9; color: #475569; }

/* Empty */
.pv-empty { text-align: center; padding: 40px; color: #94a3b8; }
.pv-error { padding: 12px 16px; background: #fef2f2; color: #dc2626; border-radius: 8px; }
.pv-empty-state {
  text-align: center; padding: 60px 20px;
  background: #fff; border-radius: 16px; border: 1px solid #e2e8f0;
}
.pv-empty-icon { font-size: 48px; color: #cbd5e1; margin-bottom: 12px; }
.pv-empty-state h3 { font-size: 18px; color: #1e293b; margin-bottom: 4px; }
.pv-empty-state p { color: #64748b; font-size: 14px; margin-bottom: 20px; }

/* Pagination */
.pv-pagination {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  margin-top: 20px; font-size: 13px; color: #64748b;
}
.pv-pagination button {
  padding: 6px 14px; border-radius: 6px; border: 1px solid #d1d5db;
  background: #fff; cursor: pointer; font-size: 14px;
}
.pv-pagination button:disabled { opacity: 0.4; cursor: not-allowed; }

/* Modal */
.pv-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 100; padding: 20px;
}
.pv-modal {
  background: #fff; border-radius: 16px; width: 100%; max-width: 500px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2); overflow: hidden;
}
.pv-modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 24px; border-bottom: 1px solid #f1f5f9;
}
.pv-modal-header h2 { font-size: 18px; font-weight: 700; color: #0f172a; }
.pv-modal-close { background: none; border: none; font-size: 20px; color: #94a3b8; cursor: pointer; padding: 4px 8px; border-radius: 6px; }
.pv-modal-close:hover { background: #f1f5f9; }
.pv-modal-body { padding: 24px; }
.pv-modal-footer { padding: 16px 24px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; gap: 8px; }

.pv-detail-status {
  display: inline-block; padding: 4px 12px; border-radius: 20px;
  font-size: 13px; font-weight: 600; margin-bottom: 8px;
}
.pv-detail-amount { font-size: 32px; font-weight: 700; color: #0f172a; margin-bottom: 24px; }
.pv-detail-grid { display: flex; flex-direction: column; gap: 2px; }
.pv-detail-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px;
}
.pv-detail-item:last-child { border-bottom: none; }
.pv-detail-label { color: #64748b; }
.pv-mono { font-family: 'SF Mono', monospace; font-size: 13px; }
</style>
