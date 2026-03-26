<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCardStore } from '../../stores/card'
import { useClientAuthStore } from '../../stores/clientAuth'
import { useClientAccountStore } from '../../stores/clientAccount'
import { CARD_TYPE_LABELS, maskCardNumber, cardApi, type Card } from '../../api/card'

const clientAuth = useClientAuthStore()
const cardStore = useCardStore()
const accountStore = useClientAccountStore()

const clientId = computed(() => Number(clientAuth.client?.id ?? 0))
const clientEmail = computed(() => clientAuth.client?.email ?? '')
const clientName = computed(() => {
  const c = clientAuth.client
  return c ? `${c.ime} ${c.prezime}` : ''
})

// Block card
const confirmCard = ref<Card | null>(null)
const blocking = ref(false)
const blockError = ref('')

// Request card modal
const showRequestModal = ref(false)
const requestStep = ref<'form' | 'verify' | 'success'>('form')
const requestForm = ref({
  accountId: '',
  vrstaKartice: 'visa',
  nazivKartice: '',
  // Poslovni OvlascenoLice fields
  forOvlasceno: false,
  ovlascenoIme: '',
  ovlascenoPrezime: '',
  ovlascenoEmail: '',
  ovlascenoBrojTelefona: '',
})
const requestLoading = ref(false)
const requestError = ref('')
const requestId = ref(0)
const verifyCode = ref('')
const verifyLoading = ref(false)
const verifyError = ref('')
const verifySecondsLeft = ref(300)
let verifyTimer: ReturnType<typeof setInterval> | null = null

const activeAccounts = computed(() =>
  accountStore.accounts.filter(a => a.status === 'aktivan')
)

const selectedAccount = computed(() =>
  accountStore.accounts.find(a => String(a.id) === requestForm.value.accountId)
)

const isPoslovni = computed(() => selectedAccount.value?.vrsta === 'poslovni')

function statusClass(s: string) {
  switch (s) {
    case 'aktivna':     return 'badge-active'
    case 'blokirana':   return 'badge-blocked'
    case 'deaktivirana': return 'badge-disabled'
    default: return 'badge-disabled'
  }
}

function statusLabel(s: string) {
  return { aktivna: 'Aktivna', blokirana: 'Blokirana', deaktivirana: 'Deaktivirana' }[s] ?? s
}

function vrstaLabel(v: string) {
  return CARD_TYPE_LABELS[v] ?? v
}

function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('sr-RS')
}

function askBlock(card: Card) {
  confirmCard.value = card
  blockError.value = ''
}

function cancelBlock() {
  confirmCard.value = null
  blockError.value = ''
}

async function confirmBlock() {
  if (!confirmCard.value) return
  blocking.value = true
  blockError.value = ''
  try {
    await cardStore.blockCard(confirmCard.value.id, clientId.value)
    confirmCard.value = null
  } catch (e: any) {
    blockError.value = e.response?.data?.error || 'Greška pri blokiranju kartice.'
  } finally {
    blocking.value = false
  }
}

// Request card flow
function openRequestModal() {
  showRequestModal.value = true
  requestStep.value = 'form'
  requestError.value = ''
  verifyError.value = ''
  verifyCode.value = ''
  requestForm.value = {
    accountId: '',
    vrstaKartice: 'visa',
    nazivKartice: '',
    forOvlasceno: false,
    ovlascenoIme: '',
    ovlascenoPrezime: '',
    ovlascenoEmail: '',
    ovlascenoBrojTelefona: '',
  }
}

function closeRequestModal() {
  showRequestModal.value = false
  if (verifyTimer) { clearInterval(verifyTimer); verifyTimer = null }
}

async function submitRequest() {
  requestError.value = ''
  if (!requestForm.value.accountId || !requestForm.value.vrstaKartice) {
    requestError.value = 'Izaberite račun i vrstu kartice.'
    return
  }
  if (isPoslovni.value && requestForm.value.forOvlasceno) {
    if (!requestForm.value.ovlascenoIme.trim() || !requestForm.value.ovlascenoPrezime.trim() || !requestForm.value.ovlascenoEmail.trim()) {
      requestError.value = 'Popunite podatke ovlašćenog lica.'
      return
    }
  }

  requestLoading.value = true
  try {
    const payload: any = {
      accountId: Number(requestForm.value.accountId),
      vrstaKartice: requestForm.value.vrstaKartice,
      nazivKartice: requestForm.value.nazivKartice,
      clientEmail: clientEmail.value,
      clientName: clientName.value,
    }
    if (isPoslovni.value && requestForm.value.forOvlasceno) {
      payload.ovlascenoIme = requestForm.value.ovlascenoIme
      payload.ovlascenoPrezime = requestForm.value.ovlascenoPrezime
      payload.ovlascenoEmail = requestForm.value.ovlascenoEmail
      payload.ovlascenoBrojTelefona = requestForm.value.ovlascenoBrojTelefona
    }
    const res = await cardApi.requestCard(payload)
    requestId.value = res.data.id
    requestStep.value = 'verify'
    verifySecondsLeft.value = 300
    verifyTimer = setInterval(() => {
      verifySecondsLeft.value--
      if (verifySecondsLeft.value <= 0 && verifyTimer) {
        clearInterval(verifyTimer)
        verifyTimer = null
      }
    }, 1000)
  } catch (e: any) {
    requestError.value = e.response?.data?.error || 'Greška pri slanju zahteva.'
  } finally {
    requestLoading.value = false
  }
}

async function submitVerify() {
  verifyError.value = ''
  if (!verifyCode.value.trim()) {
    verifyError.value = 'Unesite verifikacioni kod.'
    return
  }
  verifyLoading.value = true
  try {
    await cardApi.verifyCardRequest(requestId.value, verifyCode.value.trim())
    requestStep.value = 'success'
    if (verifyTimer) { clearInterval(verifyTimer); verifyTimer = null }
    // Refresh cards
    await cardStore.fetchByClient(clientId.value)
  } catch (e: any) {
    verifyError.value = e.response?.data?.error || 'Greška pri verifikaciji.'
  } finally {
    verifyLoading.value = false
  }
}

function fmtTimer(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

onMounted(async () => {
  if (clientId.value) {
    await Promise.all([
      cardStore.fetchByClient(clientId.value),
      accountStore.fetchAccounts(String(clientId.value)),
    ])
  }
})
</script>

<template>
  <div class="cv-page">
    <div class="cv-header">
      <div>
        <h1 class="cv-title">Moje kartice</h1>
        <p class="cv-subtitle">Pregled svih vaših platnih kartica</p>
      </div>
      <button class="cv-btn cv-btn-request" @click="openRequestModal">+ Zatraži novu karticu</button>
    </div>

    <div v-if="cardStore.loading" class="cv-empty">Učitavam...</div>
    <div v-else-if="cardStore.error" class="cv-error">{{ cardStore.error }}</div>

    <div v-else-if="cardStore.cards.length === 0" class="cv-empty-state">
      <div class="cv-empty-icon">💳</div>
      <h3>Nemate kartica</h3>
      <p>Zatražite novu karticu ili se obratite banci.</p>
      <button class="cv-btn cv-btn-request" @click="openRequestModal">+ Zatraži novu karticu</button>
    </div>

    <div v-else class="cv-list">
      <div v-for="card in cardStore.cards" :key="card.id" class="cv-card">
        <div class="cv-card-chip">
          <div class="cv-chip-icon">
            <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
              <rect x="0" y="6" width="32" height="12" rx="2" fill="#d4af37" opacity="0.6"/>
              <rect x="8" y="0" width="16" height="24" rx="2" fill="#d4af37" opacity="0.4"/>
              <rect x="12" y="8" width="8" height="8" rx="1" fill="#b8860b" opacity="0.7"/>
            </svg>
          </div>
        </div>

        <div class="cv-card-body">
          <div class="cv-card-number">{{ maskCardNumber(card.broj_kartice) }}</div>
          <div class="cv-card-meta">
            <span class="cv-card-name">{{ card.naziv_kartice || vrstaLabel(card.vrsta_kartice) }}</span>
            <span class="cv-card-sep">·</span>
            <span class="cv-card-type">{{ vrstaLabel(card.vrsta_kartice) }}</span>
            <span class="cv-card-sep">·</span>
            <span class="cv-card-expiry">Važi do {{ fmtDate(card.datum_isteka) }}</span>
          </div>
          <div class="cv-card-footer">
            <span :class="['cv-badge', statusClass(card.status)]">{{ statusLabel(card.status) }}</span>
            <span class="cv-account-ref">Račun #{{ card.account_id }}</span>
          </div>
        </div>

        <div class="cv-card-actions">
          <button
            v-if="card.status === 'aktivna'"
            class="cv-btn cv-btn-block"
            @click="askBlock(card)"
          >
            Blokiraj
          </button>
          <span v-else-if="card.status === 'blokirana'" class="cv-action-note">
            Kontaktirajte banku za deblokadu
          </span>
        </div>
      </div>
    </div>

    <!-- Block confirmation modal -->
    <div v-if="confirmCard" class="cv-overlay" @click.self="cancelBlock">
      <div class="cv-modal">
        <h2 class="cv-modal-title">Potvrda blokiranja</h2>
        <p class="cv-modal-text">
          Da li ste sigurni da želite da blokirate karticu<br />
          <strong>{{ maskCardNumber(confirmCard.broj_kartice) }}</strong>?
        </p>
        <p class="cv-modal-warning">
          Karticu može deblokirati samo zaposleni banke.
        </p>
        <div v-if="blockError" class="cv-error" style="margin-bottom: 12px">{{ blockError }}</div>
        <div class="cv-modal-actions">
          <button class="cv-btn cv-btn-sec" @click="cancelBlock" :disabled="blocking">Odustani</button>
          <button class="cv-btn cv-btn-block" @click="confirmBlock" :disabled="blocking">
            {{ blocking ? 'Blokiranje...' : 'Potvrdi blokiranje' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Request card modal -->
    <div v-if="showRequestModal" class="cv-overlay" @click.self="closeRequestModal">
      <div class="cv-modal cv-modal-wide">
        <!-- Step: Form -->
        <template v-if="requestStep === 'form'">
          <h2 class="cv-modal-title">Zahtev za novu karticu</h2>
          <div class="cv-form">
            <div class="cv-field">
              <label>Račun <span class="cv-req">*</span></label>
              <select v-model="requestForm.accountId">
                <option value="" disabled>Izaberite račun</option>
                <option v-for="acc in activeAccounts" :key="acc.id" :value="String(acc.id)">
                  {{ acc.naziv || acc.brojRacuna }} — {{ acc.brojRacuna }} ({{ acc.currencyKod }})
                </option>
              </select>
            </div>
            <div class="cv-field">
              <label>Vrsta kartice <span class="cv-req">*</span></label>
              <select v-model="requestForm.vrstaKartice">
                <option value="visa">Visa</option>
                <option value="mastercard">MasterCard</option>
                <option value="dinacard">DinaCard</option>
                <option value="amex">American Express</option>
              </select>
            </div>
            <div class="cv-field">
              <label>Naziv kartice</label>
              <input v-model="requestForm.nazivKartice" placeholder="npr. Lična Visa" />
            </div>

            <!-- Poslovni: OvlascenoLice option -->
            <template v-if="isPoslovni">
              <div class="cv-field">
                <label class="cv-checkbox-label">
                  <input type="checkbox" v-model="requestForm.forOvlasceno" />
                  Kartica za ovlašćeno lice (ne za sebe)
                </label>
              </div>
              <template v-if="requestForm.forOvlasceno">
                <div class="cv-field">
                  <label>Ime ovlašćenog lica <span class="cv-req">*</span></label>
                  <input v-model="requestForm.ovlascenoIme" placeholder="Ime" />
                </div>
                <div class="cv-field">
                  <label>Prezime <span class="cv-req">*</span></label>
                  <input v-model="requestForm.ovlascenoPrezime" placeholder="Prezime" />
                </div>
                <div class="cv-field">
                  <label>Email <span class="cv-req">*</span></label>
                  <input v-model="requestForm.ovlascenoEmail" type="email" placeholder="email@example.com" />
                </div>
                <div class="cv-field">
                  <label>Broj telefona</label>
                  <input v-model="requestForm.ovlascenoBrojTelefona" placeholder="0641234567" />
                </div>
              </template>
            </template>

            <div v-if="requestError" class="cv-error" style="margin-top:8px">{{ requestError }}</div>
          </div>
          <div class="cv-modal-actions">
            <button class="cv-btn cv-btn-sec" @click="closeRequestModal">Otkaži</button>
            <button class="cv-btn cv-btn-request" @click="submitRequest" :disabled="requestLoading">
              {{ requestLoading ? 'Šaljem...' : 'Pošalji zahtev' }}
            </button>
          </div>
        </template>

        <!-- Step: Verify -->
        <template v-else-if="requestStep === 'verify'">
          <h2 class="cv-modal-title">Verifikacija</h2>
          <p class="cv-modal-text">
            Poslali smo verifikacioni kod na <strong>{{ clientEmail }}</strong>.<br />
            Unesite kod da biste potvrdili zahtev.
          </p>
          <div class="cv-verify-timer" :class="{ 'cv-timer-warning': verifySecondsLeft < 60 }">
            {{ fmtTimer(verifySecondsLeft) }}
          </div>
          <div class="cv-field" style="margin-top:16px">
            <input
              v-model="verifyCode"
              maxlength="6"
              placeholder="000000"
              class="cv-code-input"
              @keyup.enter="submitVerify"
            />
          </div>
          <div v-if="verifyError" class="cv-error" style="margin-top:8px">{{ verifyError }}</div>
          <div class="cv-modal-actions">
            <button class="cv-btn cv-btn-sec" @click="closeRequestModal">Otkaži</button>
            <button class="cv-btn cv-btn-request" @click="submitVerify" :disabled="verifyLoading || verifySecondsLeft <= 0">
              {{ verifyLoading ? 'Proveravam...' : 'Potvrdi kod' }}
            </button>
          </div>
        </template>

        <!-- Step: Success -->
        <template v-else-if="requestStep === 'success'">
          <div class="cv-success">
            <div class="cv-success-icon">✓</div>
            <h2>Kartica kreirana!</h2>
            <p>Nova kartica je uspešno izdata i aktivna je.</p>
            <button class="cv-btn cv-btn-request" @click="closeRequestModal">Zatvori</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cv-page { padding: 32px; max-width: 860px; margin: 0 auto; }
.cv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
.cv-title { font-size: 28px; font-weight: 700; color: #0f172a; }
.cv-subtitle { font-size: 14px; color: #64748b; margin-top: 4px; }

.cv-list { display: flex; flex-direction: column; gap: 14px; }

.cv-card {
  display: flex; align-items: center; gap: 20px;
  background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
  border-radius: 16px; padding: 24px 28px;
  box-shadow: 0 4px 20px rgba(37,99,235,0.25);
  color: #fff;
}

.cv-card-chip { flex-shrink: 0; }
.cv-card-body { flex: 1; min-width: 0; }
.cv-card-number {
  font-family: 'SF Mono', 'Courier New', monospace;
  font-size: 20px; font-weight: 600; letter-spacing: 2px;
  margin-bottom: 10px; color: #e2e8f0;
}
.cv-card-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; color: #93c5fd; margin-bottom: 12px; }
.cv-card-sep { color: #60a5fa; opacity: 0.5; }
.cv-card-name { font-weight: 600; color: #dbeafe; }
.cv-card-footer { display: flex; align-items: center; gap: 12px; }
.cv-account-ref { font-size: 12px; color: #93c5fd; opacity: 0.7; }

.cv-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
.badge-active   { background: rgba(220,252,231,0.2); color: #86efac; border: 1px solid rgba(134,239,172,0.3); }
.badge-blocked  { background: rgba(254,226,226,0.2); color: #fca5a5; border: 1px solid rgba(252,165,165,0.3); }
.badge-disabled { background: rgba(241,245,249,0.2); color: #94a3b8; border: 1px solid rgba(148,163,184,0.3); }

.cv-card-actions { flex-shrink: 0; }
.cv-btn {
  padding: 9px 18px; border-radius: 9px; font-size: 13px;
  font-weight: 600; border: none; cursor: pointer; transition: all 0.15s;
}
.cv-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.cv-btn-block { background: #ef4444; color: #fff; }
.cv-btn-block:hover:not(:disabled) { background: #dc2626; }
.cv-btn-sec { background: #f1f5f9; color: #475569; }
.cv-btn-sec:hover:not(:disabled) { background: #e2e8f0; }
.cv-btn-request { background: #2563eb; color: #fff; }
.cv-btn-request:hover:not(:disabled) { background: #1d4ed8; }
.cv-action-note { font-size: 12px; color: #93c5fd; opacity: 0.7; white-space: nowrap; }

.cv-empty { text-align: center; padding: 40px; color: #94a3b8; }
.cv-error { padding: 12px 16px; background: #fef2f2; color: #dc2626; border-radius: 8px; }
.cv-empty-state { text-align: center; padding: 60px 20px; background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; }
.cv-empty-icon { font-size: 48px; margin-bottom: 12px; }
.cv-empty-state h3 { font-size: 18px; color: #1e293b; margin-bottom: 4px; }
.cv-empty-state p { color: #64748b; font-size: 14px; margin-bottom: 20px; }

/* Modal */
.cv-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 100; padding: 20px;
}
.cv-modal {
  background: #fff; border-radius: 16px; padding: 32px;
  width: 100%; max-width: 420px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
}
.cv-modal-wide { max-width: 500px; }
.cv-modal-title { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
.cv-modal-text { font-size: 15px; color: #334155; margin-bottom: 10px; line-height: 1.6; }
.cv-modal-warning {
  font-size: 13px; color: #92400e; background: #fef3c7;
  padding: 10px 14px; border-radius: 8px; margin-bottom: 20px;
}
.cv-modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }

/* Form */
.cv-form { display: flex; flex-direction: column; gap: 16px; }
.cv-field { display: flex; flex-direction: column; gap: 6px; }
.cv-field label { font-size: 13px; font-weight: 600; color: #374151; }
.cv-req { color: #ef4444; }
.cv-field select, .cv-field input {
  padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px;
  font-size: 14px; color: #0f172a; outline: none;
}
.cv-field select:focus, .cv-field input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
.cv-checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 500; }
.cv-checkbox-label input { width: 16px; height: 16px; }

/* Verify */
.cv-verify-timer {
  text-align: center; font-size: 36px; font-weight: 700; color: #2563eb;
  font-family: 'SF Mono', monospace; margin: 12px 0;
}
.cv-timer-warning { color: #ef4444; }
.cv-code-input {
  text-align: center; font-size: 28px; font-weight: 700; letter-spacing: 8px;
  padding: 14px; border: 2px solid #d1d5db; border-radius: 12px; width: 100%;
  outline: none; font-family: 'SF Mono', monospace;
}
.cv-code-input:focus { border-color: #2563eb; }

/* Success */
.cv-success { text-align: center; padding: 20px 0; }
.cv-success-icon {
  width: 64px; height: 64px; border-radius: 50%; background: #dcfce7;
  color: #16a34a; font-size: 28px; display: flex; align-items: center; justify-content: center;
  margin: 0 auto 16px;
}
.cv-success h2 { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
.cv-success p { color: #64748b; font-size: 14px; margin-bottom: 24px; }
</style>
