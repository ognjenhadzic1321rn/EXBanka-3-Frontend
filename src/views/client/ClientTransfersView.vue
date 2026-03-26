<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useClientAccountStore } from '../../stores/clientAccount'
import { useTransferStore } from '../../stores/transfer'
import { useClientAuthStore } from '../../stores/clientAuth'
import { transferApi, type TransferPreview } from '../../api/transfer'

const route = useRoute()
const clientAuthStore = useClientAuthStore()
const accountStore = useClientAccountStore()
const transferStore = useTransferStore()

const step = ref<'form' | 'confirm' | 'verify' | 'success'>('form')
const verifyCode = ref('')
const verifyError = ref('')
const formError = ref('')
const verifySecondsLeft = ref(300)
const codeExpired = ref(false)
const failedAttempts = ref(0)
const maxAttempts = 3
const preparingConfirm = ref(false)
let verifyTimerInterval: ReturnType<typeof setInterval> | null = null

const verifyCountdown = computed(() => {
  const m = Math.floor(verifySecondsLeft.value / 60)
  const s = verifySecondsLeft.value % 60
  return `${m}:${String(s).padStart(2, '0')}`
})

const form = ref({
  fromAccountId: (route.query.fromAccountId as string) || '',
  toAccountId: '',
  iznos: '',
  svrha: '',
})

const lastCreated = ref<any>(null)
const preview = ref<TransferPreview | null>(null)

const clientId = computed(() => String(clientAuthStore.client?.id ?? ''))

const fromAccount = computed(() =>
  accountStore.accounts.find(a => String(a.id) === form.value.fromAccountId) ?? null
)
const toAccount = computed(() =>
  accountStore.accounts.find(a => String(a.id) === form.value.toAccountId) ?? null
)

const isCrossCurrency = computed(() =>
  !!fromAccount.value && !!toAccount.value &&
  fromAccount.value.currencyKod !== toAccount.value.currencyKod
)

function accountOptionLabel(accountId: string) {
  const account = accountStore.accounts.find(a => String(a.id) === accountId)
  if (!account) return accountId
  return `${account.naziv || 'Racun'} - ${account.brojRacuna} (${account.currencyKod})`
}

async function goToConfirm() {
  formError.value = ''
  preview.value = null

  if (!form.value.fromAccountId || !form.value.toAccountId || !form.value.iznos || !form.value.svrha.trim()) {
    formError.value = 'Popunite sva obavezna polja.'
    return
  }
  if (form.value.fromAccountId === form.value.toAccountId) {
    formError.value = 'Racuni moraju biti razliciti.'
    return
  }
  if (Number(form.value.iznos) <= 0) {
    formError.value = 'Unesite validan iznos.'
    return
  }

  preparingConfirm.value = true
  try {
    const res = await transferApi.preview({
      racunPosiljaocaId: Number(form.value.fromAccountId),
      racunPrimaocaId: Number(form.value.toAccountId),
      iznos: Number(form.value.iznos),
      svrha: form.value.svrha,
    })
    preview.value = res.data.preview
    step.value = 'confirm'
  } catch (e: any) {
    formError.value = e.response?.data?.message || 'Greska pri pripremi transfera.'
  } finally {
    preparingConfirm.value = false
  }
}

async function handleSubmit() {
  try {
    transferStore.clearError()
    const result = await transferStore.createTransfer({
      racunPosiljaocaId: Number(form.value.fromAccountId),
      racunPrimaocaId: Number(form.value.toAccountId),
      iznos: Number(form.value.iznos),
      svrha: form.value.svrha,
    })
    lastCreated.value = result
    verifyCode.value = ''
    verifyError.value = ''
    setStep('verify')
  } catch {
    setStep('form')
  }
}

async function handleVerify() {
  if (!lastCreated.value || verifyCode.value.length !== 6) return
  try {
    verifyError.value = ''
    await transferStore.verifyTransfer(String(lastCreated.value.id), verifyCode.value)
    await accountStore.fetchAccounts(clientId.value)
    await transferStore.fetchByClient(clientId.value)
    step.value = 'success'
  } catch (error: any) {
    const data = error?.response?.data
    const remainingAttempts = Number(data?.attempts_remaining)
    const status = typeof data?.status === 'string' ? data.status : ''
    const code = typeof data?.code === 'string' ? data.code : ''

    if (!Number.isNaN(remainingAttempts)) {
      failedAttempts.value = Math.max(0, maxAttempts - remainingAttempts)
    } else if (code === 'invalid_verification_code') {
      failedAttempts.value = Math.min(failedAttempts.value + 1, maxAttempts)
    }

    verifyError.value =
      (typeof data === 'string' ? data : data?.message) ||
      transferStore.error ||
      'Verifikacija transfera nije uspela.'

    if (code === 'verification_code_expired' || code === 'verification_attempts_exceeded' || status === 'stornirano') {
      codeExpired.value = true
      if (verifyTimerInterval) {
        clearInterval(verifyTimerInterval)
        verifyTimerInterval = null
      }
    }

    await transferStore.fetchByClient(clientId.value)
  }
}

function startVerifyTimer() {
  verifySecondsLeft.value = 300
  codeExpired.value = false
  failedAttempts.value = 0
  if (verifyTimerInterval) clearInterval(verifyTimerInterval)
  verifyTimerInterval = setInterval(() => {
    if (verifySecondsLeft.value > 0) {
      verifySecondsLeft.value--
    } else {
      codeExpired.value = true
      clearInterval(verifyTimerInterval!)
      verifyTimerInterval = null
    }
  }, 1000)
}

function setStep(newStep: 'form' | 'confirm' | 'verify' | 'success') {
  step.value = newStep
  if (newStep === 'verify') {
    startVerifyTimer()
  } else if (verifyTimerInterval) {
    clearInterval(verifyTimerInterval)
    verifyTimerInterval = null
  }
}

function startNew() {
  form.value = { fromAccountId: '', toAccountId: '', iznos: '', svrha: '' }
  preview.value = null
  verifyCode.value = ''
  verifyError.value = ''
  formError.value = ''
  if (verifyTimerInterval) {
    clearInterval(verifyTimerInterval)
    verifyTimerInterval = null
  }
  verifySecondsLeft.value = 300
  codeExpired.value = false
  failedAttempts.value = 0
  step.value = 'form'
}

const historyFilter = ref({ status: '', dateFrom: '', dateTo: '' })

async function applyHistoryFilter() {
  transferStore.page = 1
  await transferStore.fetchByClient(clientId.value, {
    status: historyFilter.value.status || undefined,
    dateFrom: historyFilter.value.dateFrom || undefined,
    dateTo: historyFilter.value.dateTo || undefined,
  })
}

async function prevPage() {
  if (transferStore.page > 1) {
    transferStore.page--
    await transferStore.fetchByClient(clientId.value, {
      status: historyFilter.value.status || undefined,
    })
  }
}

async function nextPage() {
  if (transferStore.page * transferStore.pageSize < transferStore.total) {
    transferStore.page++
    await transferStore.fetchByClient(clientId.value, {
      status: historyFilter.value.status || undefined,
    })
  }
}

const totalPages = computed(() => Math.ceil(transferStore.total / transferStore.pageSize) || 1)

// Sort transfers chronologically, newest first (spec requirement)
const sortedTransfers = computed(() =>
  [...transferStore.transfers].sort((a, b) =>
    new Date(b.vremeTransakcije).getTime() - new Date(a.vremeTransakcije).getTime()
  )
)

function statusLabel(s: string) {
  switch (s) {
    case 'uspesno': return 'Uspesno'
    case 'neuspesno': return 'Neuspesno'
    case 'u_obradi': return 'U obradi'
    case 'stornirano': return 'Stornirano'
    default: return s
  }
}

function statusClass(s: string) {
  switch (s) {
    case 'uspesno': return 'st-success'
    case 'neuspesno': return 'st-error'
    case 'u_obradi': return 'st-pending'
    case 'stornirano': return 'st-neutral'
    default: return 'st-neutral'
  }
}

function accLabel(id: string) {
  return accountOptionLabel(id)
}

function formatMoney(amount: number) {
  return Number(amount).toLocaleString('sr-RS', { minimumFractionDigits: 2 })
}

onMounted(async () => {
  if (clientId.value) {
    await accountStore.fetchAccounts(clientId.value)
    await transferStore.fetchByClient(clientId.value)
  }
})

onUnmounted(() => {
  if (verifyTimerInterval) clearInterval(verifyTimerInterval)
})
</script>

<template>
  <div class="tf-page">
    <h1 class="tf-title">Transferi</h1>

    <div class="tf-grid">
      <div class="tf-card tf-card-primary">
        <h2 class="tf-card-title">Novi transfer</h2>

        <div v-if="step === 'form'">
          <div class="tf-field">
            <label>Sa racuna</label>
            <select v-model="form.fromAccountId">
              <option value="">-- Izaberite racun --</option>
              <option v-for="acc in accountStore.accounts" :key="acc.id" :value="String(acc.id)">
                {{ (acc.naziv || 'Racun') }} - {{ acc.brojRacuna }} ({{ acc.currencyKod }}) — {{ formatMoney(acc.raspolozivoStanje) }}
              </option>
            </select>
          </div>

          <div class="tf-field">
            <label>Na racun</label>
            <select v-model="form.toAccountId">
              <option value="">-- Izaberite racun --</option>
              <option
                v-for="acc in accountStore.accounts"
                :key="acc.id"
                :value="String(acc.id)"
                :disabled="String(acc.id) === form.fromAccountId"
              >
                {{ (acc.naziv || 'Racun') }} - {{ acc.brojRacuna }} ({{ acc.currencyKod }})
              </option>
            </select>
          </div>

          <div class="tf-field">
            <label>Iznos</label>
            <input v-model="form.iznos" type="number" min="0.01" step="0.01" placeholder="0.00" />
          </div>

          <div class="tf-field">
            <label>Svrha</label>
            <input v-model="form.svrha" placeholder="Svrha transakcije" @keyup.enter="goToConfirm" />
          </div>

          <div v-if="formError || transferStore.error" class="tf-error">{{ formError || transferStore.error }}</div>

          <button
            class="tf-btn"
            :disabled="preparingConfirm || !form.fromAccountId || !form.toAccountId || !form.iznos || !form.svrha || form.fromAccountId === form.toAccountId"
            @click="goToConfirm"
          >
            {{ preparingConfirm ? 'Pripremam...' : 'Nastavi' }}
          </button>
        </div>

        <div v-else-if="step === 'confirm'">
          <div class="tf-confirm">
            <div class="tf-confirm-row">
              <span class="tf-confirm-label">Sa racuna</span>
              <span>{{ accountOptionLabel(form.fromAccountId) }}</span>
            </div>
            <div class="tf-confirm-row">
              <span class="tf-confirm-label">Na racun</span>
              <span>{{ accountOptionLabel(form.toAccountId) }}</span>
            </div>
            <div class="tf-confirm-row">
              <span class="tf-confirm-label">Iznos</span>
              <span class="tf-confirm-amount">{{ formatMoney(Number(form.iznos)) }} {{ preview?.valutaIznosa || fromAccount?.currencyKod }}</span>
            </div>
            <div class="tf-confirm-row">
              <span class="tf-confirm-label">Valuta</span>
              <span>{{ preview?.valutaIznosa || fromAccount?.currencyKod }}</span>
            </div>
            <div class="tf-confirm-row">
              <span class="tf-confirm-label">Kurs</span>
              <span>{{ preview?.kurs?.toFixed(4) || '1.0000' }}</span>
            </div>
            <div class="tf-confirm-row">
              <span class="tf-confirm-label">Provizija</span>
              <span>{{ formatMoney(preview?.provizija ?? 0) }} {{ preview?.valutaIznosa || fromAccount?.currencyKod }}</span>
            </div>
            <div v-if="isCrossCurrency && preview" class="tf-confirm-row">
              <span class="tf-confirm-label">Konvertovano</span>
              <span>{{ formatMoney(preview.konvertovaniIznos) }} {{ toAccount?.currencyKod }}</span>
            </div>
            <div class="tf-confirm-row">
              <span class="tf-confirm-label">Svrha</span>
              <span>{{ form.svrha }}</span>
            </div>
          </div>
          <div class="tf-actions">
            <button class="tf-btn tf-btn-sec" @click="setStep('form')">Nazad</button>
            <button class="tf-btn" :disabled="transferStore.loading" @click="handleSubmit">
              {{ transferStore.loading ? 'Saljem...' : 'Potvrdi transfer' }}
            </button>
          </div>
        </div>

        <div v-else-if="step === 'verify'" class="tf-verify">
          <div class="tf-verify-icon">✉</div>
          <p class="tf-verify-text">Unesite verifikacioni kod koji ste primili emailom.</p>
          <div class="tf-countdown" :class="{ 'tf-countdown-expired': codeExpired }">
            <span v-if="!codeExpired">Kod istice za: <strong>{{ verifyCountdown }}</strong></span>
            <span v-else>Kod je istekao.</span>
          </div>
          <div class="tf-attempts">
            Preostalo pokusaja: <strong>{{ maxAttempts - failedAttempts }}</strong>
          </div>
          <div class="tf-field">
            <label>Verifikacioni kod</label>
            <input
              v-model="verifyCode"
              type="text"
              maxlength="6"
              placeholder="6-cifreni kod"
              :disabled="codeExpired"
              @keyup.enter="handleVerify"
            />
          </div>
          <div v-if="verifyError" class="tf-error">{{ verifyError }}</div>
          <div class="tf-actions">
            <button class="tf-btn tf-btn-sec" @click="setStep('form')">Otkazi</button>
            <button class="tf-btn" :disabled="verifyCode.length !== 6 || codeExpired" @click="handleVerify">
              Verifikuj transfer
            </button>
          </div>
        </div>

        <div v-else class="tf-success">
          <div class="tf-success-icon">✓</div>
          <p class="tf-success-text">Transfer uspesno realizovan!</p>
          <button class="tf-btn" @click="startNew">Novi transfer</button>
        </div>
      </div>

      <div class="tf-card">
        <h2 class="tf-card-title" style="color:#0f172a">Istorija transfera</h2>

        <div class="tf-filters">
          <select v-model="historyFilter.status" @change="applyHistoryFilter">
            <option value="">Svi statusi</option>
            <option value="uspesno">Uspesno</option>
            <option value="neuspesno">Neuspesno</option>
            <option value="u_obradi">U obradi</option>
            <option value="stornirano">Stornirano</option>
          </select>
        </div>

        <div v-if="transferStore.loading" class="tf-empty">Ucitavam...</div>
        <div v-else-if="sortedTransfers.length === 0" class="tf-empty">Nema transfera.</div>
        <div v-else class="tf-history">
          <div v-for="t in sortedTransfers" :key="t.id" class="tf-history-item">
            <div class="tf-history-left">
              <div class="tf-history-desc">{{ t.svrha || 'Transfer' }}</div>
              <div class="tf-history-meta">
                {{ new Date(t.vremeTransakcije).toLocaleDateString('sr-RS') }} ·
                {{ accLabel(t.racunPosiljaocaId) }} → {{ accLabel(t.racunPrimaocaId) }}
              </div>
              <div v-if="t.provizija > 0 || t.kurs !== 1" class="tf-history-extra">
                Kurs: {{ t.kurs.toFixed(4) }} · Provizija: {{ formatMoney(t.provizija) }} {{ t.valutaIznosa }}
              </div>
            </div>
            <div class="tf-history-right">
              <div class="tf-history-amount">{{ formatMoney(t.iznos) }} {{ t.valutaIznosa }}</div>
              <span :class="['tf-status', statusClass(t.status)]">{{ statusLabel(t.status) }}</span>
            </div>
          </div>
        </div>

        <div v-if="transferStore.total > transferStore.pageSize" class="tf-pagination">
          <button :disabled="transferStore.page <= 1" @click="prevPage">‹</button>
          <span>{{ transferStore.page }} / {{ totalPages }}</span>
          <button :disabled="transferStore.page >= totalPages" @click="nextPage">›</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tf-page { padding: 32px; max-width: 1100px; margin: 0 auto; }
.tf-title { font-size: 28px; font-weight: 700; color: #0f172a; margin-bottom: 24px; }
.tf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.tf-card {
  background: #fff; border-radius: 12px; padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;
}
.tf-card-primary {
  background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
  color: #fff; border: none;
}
.tf-card-primary label { color: rgba(255,255,255,0.7); }
.tf-card-primary select, .tf-card-primary input {
  background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff;
}
.tf-card-primary select option { color: #1e293b; }
.tf-card-title { font-size: 16px; font-weight: 700; margin-bottom: 20px; }
.tf-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; }
.tf-field label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
.tf-field select, .tf-field input { padding: 10px 12px; border-radius: 8px; font-size: 14px; }
.tf-btn {
  width: 100%; padding: 12px; background: rgba(255,255,255,0.2); color: #fff;
  border: 1px solid rgba(255,255,255,0.3); border-radius: 8px;
  font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.15s;
}
.tf-btn:hover:not(:disabled) { background: rgba(255,255,255,0.3); }
.tf-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.tf-btn-sec { background: transparent; border-color: rgba(255,255,255,0.2); }
.tf-error { padding: 8px 12px; background: rgba(239,68,68,0.15); color: #fca5a5; border-radius: 6px; margin-bottom: 12px; font-size: 13px; }
.tf-actions { display: flex; gap: 12px; margin-top: 16px; }
.tf-actions .tf-btn { flex: 1; }
.tf-confirm { display: flex; flex-direction: column; gap: 2px; }
.tf-confirm-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 14px;
}
.tf-confirm-row:last-child { border-bottom: none; }
.tf-confirm-label { color: rgba(255,255,255,0.5); font-size: 13px; }
.tf-confirm-amount { font-size: 18px; font-weight: 700; }
.tf-verify { text-align: center; padding: 8px 0; }
.tf-verify-icon { font-size: 40px; margin-bottom: 10px; }
.tf-verify-text { font-size: 14px; color: rgba(255,255,255,0.7); margin-bottom: 12px; }
.tf-countdown {
  font-size: 13px; color: rgba(255,255,255,0.6);
  margin-bottom: 16px; padding: 6px 12px;
  background: rgba(255,255,255,0.08); border-radius: 6px; display: inline-block;
}
.tf-countdown strong { color: #93c5fd; font-size: 15px; }
.tf-countdown-expired { background: rgba(239,68,68,0.2); color: #fca5a5; }
.tf-attempts { font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 16px; }
.tf-attempts strong { color: rgba(255,255,255,0.9); }
.tf-success { text-align: center; padding: 32px 0; }
.tf-success-icon { font-size: 48px; color: #4ade80; margin-bottom: 12px; }
.tf-success-text { font-size: 18px; margin-bottom: 20px; }
.tf-filters { margin-bottom: 16px; }
.tf-filters select { padding: 8px 12px; border-radius: 6px; border: 1px solid #d1d5db; font-size: 13px; }
.tf-history { display: flex; flex-direction: column; }
.tf-history-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 0; border-bottom: 1px solid #f1f5f9;
}
.tf-history-item:last-child { border-bottom: none; }
.tf-history-left { min-width: 0; flex: 1; }
.tf-history-desc { font-weight: 500; color: #1e293b; font-size: 14px; }
.tf-history-meta { font-size: 12px; color: #94a3b8; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tf-history-extra { font-size: 11px; color: #64748b; margin-top: 4px; }
.tf-history-right { text-align: right; flex-shrink: 0; margin-left: 16px; }
.tf-history-amount { font-weight: 600; color: #0f172a; font-size: 14px; }
.tf-status {
  display: inline-block; padding: 2px 8px; border-radius: 20px;
  font-size: 11px; font-weight: 600; margin-top: 4px;
}
.st-success { background: #dcfce7; color: #166534; }
.st-error { background: #fee2e2; color: #991b1b; }
.st-pending { background: #fef9c3; color: #854d0e; }
.st-neutral { background: #f1f5f9; color: #475569; }
.tf-empty { text-align: center; color: #94a3b8; padding: 24px; font-size: 14px; }
.tf-pagination {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  margin-top: 16px; font-size: 13px; color: #64748b;
}
.tf-pagination button {
  padding: 4px 12px; border-radius: 4px; border: 1px solid #d1d5db;
  background: #fff; cursor: pointer;
}
.tf-pagination button:disabled { opacity: 0.4; cursor: not-allowed; }

@media (max-width: 900px) { .tf-grid { grid-template-columns: 1fr; } }
</style>
