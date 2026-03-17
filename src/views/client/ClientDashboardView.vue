<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useClientAuthStore } from '../../stores/clientAuth'
import { useClientAccountStore } from '../../stores/clientAccount'
import { useTransferStore } from '../../stores/transfer'
import { usePaymentStore } from '../../stores/payment'
import { useRecipientStore } from '../../stores/recipient'
import { exchangeApi, type ExchangeRate } from '../../api/exchange'
import { paymentApi } from '../../api/payment'
import type { PaymentItem } from '../../api/payment'

const clientAuthStore = useClientAuthStore()
const accountStore = useClientAccountStore()
const transferStore = useTransferStore()
const paymentStore = usePaymentStore()
const recipientStore = useRecipientStore()

const clientId = computed(() => String(clientAuthStore.client?.id ?? ''))

// Section 3: Exchange rates
const rates = ref<ExchangeRate[]>([])
const loadingRates = ref(false)

// Section 4: Quick payment inline flow
const qpStep = ref<'form' | 'verify' | 'success'>('form')
const qpForm = ref({ fromAccountId: '', recipientId: '', iznos: '', svrha: '' })
const qpPayment = ref<PaymentItem | null>(null)
const qpCode = ref('')
const qpError = ref('')
const qpLoading = ref(false)

// Section 2: Recent activity — last 5 combined transfers + payments
const recentActivity = computed(() => {
  const items = [
    ...transferStore.transfers.map(t => ({
      type: 'transfer' as const,
      id: t.id,
      date: t.vremeTransakcije,
      amount: t.iznos,
      currency: t.valutaIznosa,
      description: t.svrha || 'Transfer',
      status: t.status,
    })),
    ...paymentStore.payments.map(p => ({
      type: 'payment' as const,
      id: p.id,
      date: p.vremeTransakcije,
      amount: p.iznos,
      currency: '',
      description: p.svrha || 'Plaćanje',
      status: p.status,
    })),
  ]
  return items
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
})

// Section 5: Top recipients (up to 5)
const topRecipients = computed(() => recipientStore.recipients.slice(0, 5))

// Section 6: Notifications derived from recent activity
const notifications = computed(() =>
  recentActivity.value.slice(0, 3).map(a => ({
    id: `${a.type}-${a.id}`,
    text: `${a.type === 'transfer' ? 'Transfer' : 'Plaćanje'}: ${a.description} — ${a.amount.toLocaleString('sr-RS')} ${a.currency}`,
    status: a.status,
    date: a.date,
  }))
)

function statusBadgeClass(status: string) {
  switch (status) {
    case 'uspesno':    return 'badge-success'
    case 'neuspesno':  return 'badge-error'
    case 'u_obradi':   return 'badge-warning'
    case 'stornirano': return 'badge-neutral'
    default:           return 'badge-neutral'
  }
}

async function loadRates() {
  loadingRates.value = true
  try {
    const res = await exchangeApi.getRates()
    rates.value = (res.data.rates ?? []).slice(0, 5)
  } catch {
    rates.value = []
  } finally {
    loadingRates.value = false
  }
}

async function qpSubmit() {
  qpError.value = ''
  if (!qpForm.value.fromAccountId) { qpError.value = 'Izaberite račun.'; return }
  if (!qpForm.value.recipientId)   { qpError.value = 'Izaberite primaoca.'; return }
  if (!qpForm.value.iznos || Number(qpForm.value.iznos) <= 0) { qpError.value = 'Unesite iznos.'; return }
  qpLoading.value = true
  try {
    const recipient = recipientStore.recipients.find(r => r.id === qpForm.value.recipientId)
    const res = await paymentApi.create({
      racunPosiljaocaId: Number(qpForm.value.fromAccountId),
      racunPrimaocaBroj: recipient!.brojRacuna,
      iznos: Number(qpForm.value.iznos),
      sifraPlacanja: '289',
      pozivNaBroj: '',
      svrha: qpForm.value.svrha || 'Brzo plaćanje',
      recipientId: Number(qpForm.value.recipientId),
    })
    qpPayment.value = res.data.payment
    qpStep.value = 'verify'
  } catch (e: any) {
    qpError.value = e.response?.data?.message || 'Greška pri plaćanju.'
  } finally {
    qpLoading.value = false
  }
}

async function qpVerify() {
  if (!qpCode.value || qpCode.value.length !== 6) {
    qpError.value = 'Unesite 6-cifreni kod.'
    return
  }
  qpLoading.value = true
  qpError.value = ''
  try {
    await paymentApi.verify(qpPayment.value!.id, qpCode.value)
    qpStep.value = 'success'
    await paymentStore.fetchByClient(clientId.value)
  } catch (e: any) {
    qpError.value = e.response?.data?.message || 'Neispravan kod.'
  } finally {
    qpLoading.value = false
  }
}

function qpReset() {
  qpForm.value = { fromAccountId: '', recipientId: '', iznos: '', svrha: '' }
  qpCode.value = ''
  qpError.value = ''
  qpPayment.value = null
  qpStep.value = 'form'
}

onMounted(async () => {
  if (!clientId.value) return
  await Promise.all([
    accountStore.fetchAccounts(clientId.value),
    transferStore.fetchByClient(clientId.value),
    paymentStore.fetchByClient(clientId.value),
    recipientStore.fetchRecipients(clientId.value),
    loadRates(),
  ])
})
</script>

<template>
  <div class="page-container">
    <h1 class="page-title">Dobrodošli, {{ clientAuthStore.client?.ime }}!</h1>

    <!-- Section 1: Računi -->
    <section class="dashboard-section">
      <h2 class="section-title">Moji računi</h2>
      <div v-if="accountStore.loading" class="loading-msg">Učitavam račune...</div>
      <div v-else-if="accountStore.accounts.length === 0" class="empty-msg">Nemate račune.</div>
      <div v-else class="accounts-grid">
        <div
          v-for="acc in accountStore.accounts"
          :key="acc.id"
          class="account-summary-card"
        >
          <div class="account-name">{{ acc.naziv || acc.brojRacuna }}</div>
          <div class="account-currency">{{ acc.currencyKod }}</div>
          <div class="account-balance">{{ acc.stanje.toLocaleString('sr-RS') }}</div>
          <div class="account-available">Raspoloživo: {{ acc.raspolozivoStanje.toLocaleString('sr-RS') }}</div>
        </div>
      </div>
    </section>

    <div class="dashboard-two-col">

      <!-- Section 2: Poslednje transakcije -->
      <section class="dashboard-section">
        <h2 class="section-title">Poslednje transakcije</h2>
        <div v-if="recentActivity.length === 0" class="empty-msg">Nema transakcija.</div>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>Opis</th>
              <th>Iznos</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in recentActivity" :key="item.id + item.type" class="activity-row">
              <td>{{ item.description }}</td>
              <td>{{ item.amount.toLocaleString('sr-RS') }} {{ item.currency }}</td>
              <td><span :class="['badge', statusBadgeClass(item.status)]">{{ item.status }}</span></td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Section 3: Kursna lista -->
      <section class="dashboard-section">
        <h2 class="section-title">Kursna lista</h2>
        <div v-if="loadingRates" class="loading-msg">Učitavam...</div>
        <div v-else-if="rates.length === 0" class="empty-msg">Kursevi nisu dostupni.</div>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>Valuta</th>
              <th>Kurs (RSD)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rates" :key="`${r.from}-${r.to}`" class="rate-row">
              <td>{{ r.from }}/{{ r.to }}</td>
              <td>{{ r.rate.toFixed(4) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

    </div>

    <div class="dashboard-two-col">

      <!-- Section 4: Brzo plaćanje -->
      <section class="dashboard-section">
        <h2 class="section-title">Brzo plaćanje</h2>

        <!-- Form step -->
        <div v-if="qpStep === 'form'">
          <div class="form-group">
            <label>Sa računa</label>
            <select v-model="qpForm.fromAccountId" class="form-input">
              <option value="">-- Račun --</option>
              <option v-for="acc in accountStore.accounts" :key="acc.id" :value="String(acc.id)">
                {{ acc.naziv || acc.brojRacuna }} ({{ acc.currencyKod }})
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Primalac</label>
            <select v-model="qpForm.recipientId" class="form-input">
              <option value="">-- Primalac --</option>
              <option v-for="r in recipientStore.recipients" :key="r.id" :value="r.id">
                {{ r.naziv }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Iznos</label>
            <input v-model="qpForm.iznos" type="number" min="0.01" step="0.01" class="form-input" placeholder="0.00" />
          </div>
          <div class="form-group">
            <label>Svrha</label>
            <input v-model="qpForm.svrha" type="text" class="form-input" placeholder="Brzo plaćanje" />
          </div>
          <div v-if="qpError" class="error-message">{{ qpError }}</div>
          <button class="btn btn-primary" :disabled="qpLoading" @click="qpSubmit">
            {{ qpLoading ? 'Šaljem...' : 'Plati' }}
          </button>
        </div>

        <!-- Verify step -->
        <div v-else-if="qpStep === 'verify'">
          <p class="text-muted">Unesite 6-cifreni verifikacioni kod.</p>
          <div class="form-group">
            <input
              v-model="qpCode"
              type="text"
              maxlength="6"
              class="form-input"
              placeholder="------"
            />
          </div>
          <div v-if="qpError" class="error-message">{{ qpError }}</div>
          <div class="action-row">
            <button class="btn btn-secondary" @click="qpStep = 'form'">Nazad</button>
            <button
              class="btn btn-primary"
              :disabled="qpCode.length !== 6 || qpLoading"
              @click="qpVerify"
            >
              Potvrdi
            </button>
          </div>
        </div>

        <!-- Success step -->
        <div v-else class="success-box">
          <div class="success-icon">✓</div>
          <p>Plaćanje uspešno!</p>
          <button class="btn btn-primary" @click="qpReset">Novo plaćanje</button>
        </div>
      </section>

      <!-- Section 5: Primaoci -->
      <section class="dashboard-section">
        <h2 class="section-title">Primaoci</h2>
        <div v-if="topRecipients.length === 0" class="empty-msg">Nema sačuvanih primalaca.</div>
        <ul v-else class="recipients-list">
          <li
            v-for="r in topRecipients"
            :key="r.id"
            class="recipient-item"
          >
            <span class="recipient-name">{{ r.naziv }}</span>
            <span class="recipient-account">{{ r.brojRacuna }}</span>
          </li>
        </ul>
      </section>

    </div>

    <!-- Section 6: Obaveštenja -->
    <section class="dashboard-section">
      <h2 class="section-title">Obaveštenja</h2>
      <div v-if="notifications.length === 0" class="empty-msg">Nema obaveštenja.</div>
      <ul v-else class="notifications-list">
        <li
          v-for="n in notifications"
          :key="n.id"
          class="notification-item"
        >
          <span :class="['badge', statusBadgeClass(n.status)]">{{ n.status }}</span>
          <span class="notification-text">{{ n.text }}</span>
          <span class="notification-date">{{ new Date(n.date).toLocaleDateString('sr-RS') }}</span>
        </li>
      </ul>
    </section>

  </div>
</template>
