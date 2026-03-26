<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useClientAuthStore } from '../../stores/clientAuth'
import { useClientAccountStore } from '../../stores/clientAccount'
import { useLoanStore } from '../../stores/loan'
import {
  LOAN_TYPES,
  INTEREST_TYPES,
  EMPLOYMENT_STATUSES,
  PERIOD_OPTIONS,
  calculateInstallment,
  baseInterestRate,
  marginForVrsta,
} from '../../api/loan'

const router = useRouter()
const clientAuth = useClientAuthStore()
const accountStore = useClientAccountStore()
const loanStore = useLoanStore()

const clientId = computed(() => clientAuth.client?.id ?? '')

const form = ref({
  vrsta: '',
  iznos: '',
  period: '',
  tipKamate: 'fiksna',
  brojRacuna: '',
  svrhaKredita: '',
  iznosMesecnePlate: '',
  statusZaposlenja: '',
  periodZaposlenja: '',
  kontaktTelefon: '',
})

const submitting = ref(false)
const submitError = ref('')
const success = ref(false)

// Period options change based on loan type
const periodOptions = computed(() => {
  if (!form.value.vrsta) return []
  return PERIOD_OPTIONS[form.value.vrsta] ?? []
})

// Reset period when loan type changes if current period is not allowed
watch(() => form.value.vrsta, () => {
  const allowed = periodOptions.value
  if (allowed.length > 0 && !allowed.includes(Number(form.value.period))) {
    form.value.period = ''
  }
})

// Live installment preview
const previewRate = computed(() => {
  const iznos = Number(form.value.iznos)
  const period = Number(form.value.period)
  if (!form.value.vrsta || iznos <= 0 || period < 1) return null
  const base = baseInterestRate(iznos, form.value.tipKamate)
  const margin = marginForVrsta(form.value.vrsta)
  const annualRate = base + margin
  const monthly = calculateInstallment(iznos, annualRate, period)
  return { annualRate, monthly }
})

const rsdAccounts = computed(() =>
  accountStore.accounts.filter(a => a.currencyKod === 'RSD' && a.status !== 'zatvoren')
)

const formErrors = computed(() => {
  const errs: string[] = []
  if (!form.value.vrsta) errs.push('Vrsta kredita je obavezna.')
  const iznos = Number(form.value.iznos)
  if (!form.value.iznos || iznos <= 0) errs.push('Iznos mora biti veći od 0.')
  const period = Number(form.value.period)
  if (!form.value.period || period < 1) errs.push('Rok otplate je obavezan.')
  if (!form.value.tipKamate) errs.push('Tip kamate je obavezan.')
  if (!form.value.brojRacuna) errs.push('Račun za isplatu je obavezan.')
  if (!form.value.svrhaKredita.trim()) errs.push('Svrha kredita je obavezna.')
  const plata = Number(form.value.iznosMesecnePlate)
  if (!form.value.iznosMesecnePlate || plata <= 0) errs.push('Iznos mesečne plate mora biti veći od 0.')
  if (!form.value.statusZaposlenja) errs.push('Status zaposlenja je obavezan.')
  if (!form.value.periodZaposlenja.trim()) errs.push('Period zaposlenja je obavezan.')
  if (!form.value.kontaktTelefon.trim()) errs.push('Kontakt telefon je obavezan.')
  return errs
})

async function submit() {
  if (formErrors.value.length > 0) return
  submitError.value = ''
  submitting.value = true
  try {
    const account = accountStore.accounts.find(a => a.brojRacuna === form.value.brojRacuna)
    await loanStore.createLoan({
      vrsta:             form.value.vrsta,
      brojRacuna:        form.value.brojRacuna,
      iznos:             Number(form.value.iznos),
      period:            Number(form.value.period),
      tipKamate:         form.value.tipKamate,
      clientId:          Number(clientId.value),
      currencyId:        account ? Number(account.currencyId) : 1,
      svrhaKredita:      form.value.svrhaKredita,
      iznosMesecnePlate: Number(form.value.iznosMesecnePlate),
      statusZaposlenja:  form.value.statusZaposlenja,
      periodZaposlenja:  form.value.periodZaposlenja,
      kontaktTelefon:    form.value.kontaktTelefon,
    })
    success.value = true
  } catch (e: any) {
    submitError.value = e.response?.data?.error || 'Greška pri podnošenju zahteva.'
  } finally {
    submitting.value = false
  }
}

function fmtMoney(n: number) {
  return n.toLocaleString('sr-RS', { minimumFractionDigits: 2 })
}

onMounted(async () => {
  if (clientId.value) {
    await accountStore.fetchAccounts(String(clientId.value))
  }
})
</script>

<template>
  <div class="nl-page">
    <div class="nl-back" @click="router.push('/client/loans')">← Nazad na kredite</div>

    <div class="nl-card">
      <h1 class="nl-title">Zahtev za kredit</h1>
      <p class="nl-subtitle">Popunite formu da biste podneli zahtev</p>

      <!-- Success state -->
      <div v-if="success" class="nl-success">
        <div class="nl-success-icon">✓</div>
        <h2>Zahtev je podnet!</h2>
        <p>Vaš zahtev za kredit je primljen. Bićete obavešteni kada bude obrađen.</p>
        <button class="nl-btn nl-btn-primary" @click="router.push('/client/loans')">
          Pregled kredita
        </button>
      </div>

      <form v-else @submit.prevent="submit" class="nl-form">
        <!-- Vrsta kredita -->
        <div class="nl-field">
          <label class="nl-label">Vrsta kredita <span class="nl-req">*</span></label>
          <div class="nl-radio-group">
            <label
              v-for="t in LOAN_TYPES"
              :key="t.value"
              :class="['nl-radio-btn', { selected: form.vrsta === t.value }]"
            >
              <input type="radio" v-model="form.vrsta" :value="t.value" />
              {{ t.label }}
            </label>
          </div>
        </div>

        <!-- Tip kamate -->
        <div class="nl-field">
          <label class="nl-label">Tip kamatne stope <span class="nl-req">*</span></label>
          <div class="nl-radio-group">
            <label
              v-for="t in INTEREST_TYPES"
              :key="t.value"
              :class="['nl-radio-btn', { selected: form.tipKamate === t.value }]"
            >
              <input type="radio" v-model="form.tipKamate" :value="t.value" />
              {{ t.label }}
            </label>
          </div>
        </div>

        <!-- Iznos kredita -->
        <div class="nl-field">
          <label class="nl-label">Iznos kredita (RSD) <span class="nl-req">*</span></label>
          <input
            v-model="form.iznos"
            type="number"
            min="1"
            step="any"
            placeholder="npr. 500000"
            class="nl-input"
          />
        </div>

        <!-- Svrha kredita -->
        <div class="nl-field">
          <label class="nl-label">Svrha kredita <span class="nl-req">*</span></label>
          <input
            v-model="form.svrhaKredita"
            type="text"
            placeholder="npr. Kupovina stana"
            class="nl-input"
          />
        </div>

        <!-- Iznos mesečne plate -->
        <div class="nl-field">
          <label class="nl-label">Iznos mesečne plate (RSD) <span class="nl-req">*</span></label>
          <input
            v-model="form.iznosMesecnePlate"
            type="number"
            min="1"
            step="any"
            placeholder="npr. 120000"
            class="nl-input"
          />
        </div>

        <!-- Status zaposlenja -->
        <div class="nl-field">
          <label class="nl-label">Status zaposlenja <span class="nl-req">*</span></label>
          <select v-model="form.statusZaposlenja" class="nl-input">
            <option value="" disabled>Izaberite status</option>
            <option v-for="s in EMPLOYMENT_STATUSES" :key="s.value" :value="s.value">
              {{ s.label }}
            </option>
          </select>
        </div>

        <!-- Period zaposlenja kod trenutnog poslodavca -->
        <div class="nl-field">
          <label class="nl-label">Period zaposlenja kod trenutnog poslodavca <span class="nl-req">*</span></label>
          <input
            v-model="form.periodZaposlenja"
            type="text"
            placeholder="npr. 3 godine i 6 meseci"
            class="nl-input"
          />
        </div>

        <!-- Rok otplate -->
        <div class="nl-field">
          <label class="nl-label">Rok otplate (meseci) <span class="nl-req">*</span></label>
          <select v-model="form.period" class="nl-input" :disabled="!form.vrsta">
            <option value="" disabled>
              {{ form.vrsta ? 'Izaberite rok otplate' : 'Prvo izaberite vrstu kredita' }}
            </option>
            <option v-for="p in periodOptions" :key="p" :value="p">
              {{ p }} meseci ({{ (p / 12).toFixed(1) }} god.)
            </option>
          </select>
          <p v-if="!form.vrsta" class="nl-hint">Izaberite vrstu kredita da biste videli dostupne rokove otplate.</p>
        </div>

        <!-- Kontakt telefon -->
        <div class="nl-field">
          <label class="nl-label">Kontakt telefon <span class="nl-req">*</span></label>
          <input
            v-model="form.kontaktTelefon"
            type="tel"
            placeholder="npr. 0641234567"
            class="nl-input"
          />
        </div>

        <!-- Račun za isplatu -->
        <div class="nl-field">
          <label class="nl-label">Broj računa za isplatu <span class="nl-req">*</span></label>
          <select v-model="form.brojRacuna" class="nl-input">
            <option value="" disabled>Izaberite račun</option>
            <option
              v-for="acc in rsdAccounts"
              :key="acc.id"
              :value="acc.brojRacuna"
            >
              {{ acc.naziv || acc.brojRacuna }} — {{ acc.brojRacuna }} ({{ fmtMoney(acc.raspolozivoStanje) }} RSD)
            </option>
          </select>
          <p v-if="rsdAccounts.length === 0" class="nl-hint">
            Nemate RSD račun. Krediti se isplaćuju samo na dinarske račune.
          </p>
        </div>

        <!-- Live preview -->
        <div v-if="previewRate" class="nl-preview">
          <div class="nl-preview-title">Procena mesečne rate</div>
          <div class="nl-preview-rate">{{ fmtMoney(previewRate.monthly) }} RSD / mes</div>
          <div class="nl-preview-detail">
            Godišnja kamatna stopa: {{ previewRate.annualRate.toFixed(2) }}%
            · Ukupno: {{ fmtMoney(previewRate.monthly * Number(form.period)) }} RSD
          </div>
          <p class="nl-preview-note">
            Ovo je procena. Konačna rata biće određena u trenutku odobravanja.
          </p>
        </div>

        <!-- Errors -->
        <div v-if="submitError" class="nl-error">{{ submitError }}</div>

        <div class="nl-actions">
          <button type="button" class="nl-btn nl-btn-sec" @click="router.push('/client/loans')">
            Otkaži
          </button>
          <button
            type="submit"
            class="nl-btn nl-btn-primary"
            :disabled="formErrors.length > 0 || submitting"
          >
            {{ submitting ? 'Podnosim...' : 'Podnesi zahtev' }}
          </button>
        </div>

        <div v-if="formErrors.length > 0 && (form.vrsta || form.iznos || form.period || form.svrhaKredita || form.iznosMesecnePlate)" class="nl-validation-list">
          <div v-for="e in formErrors" :key="e" class="nl-validation-item">{{ e }}</div>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.nl-page { padding: 32px; max-width: 640px; margin: 0 auto; }
.nl-back { font-size: 14px; color: #2563eb; cursor: pointer; margin-bottom: 20px; display: inline-block; }
.nl-back:hover { text-decoration: underline; }

.nl-card {
  background: #fff; border-radius: 16px; padding: 36px 40px;
  border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.nl-title { font-size: 26px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
.nl-subtitle { font-size: 14px; color: #64748b; margin-bottom: 28px; }

.nl-form { display: flex; flex-direction: column; gap: 24px; }
.nl-field { display: flex; flex-direction: column; gap: 8px; }
.nl-label { font-size: 14px; font-weight: 600; color: #374151; }
.nl-req { color: #ef4444; }
.nl-hint { font-size: 12px; color: #94a3b8; margin-top: 4px; }

.nl-input {
  padding: 11px 14px; border: 1px solid #d1d5db; border-radius: 8px;
  font-size: 14px; color: #0f172a; outline: none; transition: border 0.15s;
}
.nl-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
.nl-input:disabled { background: #f1f5f9; cursor: not-allowed; }

.nl-radio-group { display: flex; gap: 10px; flex-wrap: wrap; }
.nl-radio-btn {
  padding: 8px 16px; border-radius: 8px; border: 1px solid #d1d5db;
  font-size: 13px; cursor: pointer; transition: all 0.15s; user-select: none;
}
.nl-radio-btn input { display: none; }
.nl-radio-btn:hover { border-color: #2563eb; }
.nl-radio-btn.selected { background: #eff6ff; border-color: #2563eb; color: #1d4ed8; font-weight: 600; }

/* Preview box */
.nl-preview {
  background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px;
  padding: 20px 24px; text-align: center;
}
.nl-preview-title { font-size: 12px; font-weight: 600; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
.nl-preview-rate { font-size: 32px; font-weight: 700; color: #1e40af; margin-bottom: 6px; }
.nl-preview-detail { font-size: 13px; color: #3b82f6; }
.nl-preview-note { font-size: 11px; color: #93c5fd; margin-top: 8px; }

.nl-error {
  background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;
  border-radius: 8px; padding: 12px 16px; font-size: 14px;
}

.nl-validation-list { display: flex; flex-direction: column; gap: 4px; }
.nl-validation-item { font-size: 13px; color: #b45309; padding: 4px 0; }
.nl-validation-item::before { content: '· '; }

.nl-actions { display: flex; gap: 12px; justify-content: flex-end; }
.nl-btn { padding: 11px 24px; border-radius: 10px; font-size: 14px; font-weight: 600; border: none; cursor: pointer; transition: all 0.15s; }
.nl-btn-primary { background: #2563eb; color: #fff; }
.nl-btn-primary:hover:not(:disabled) { background: #1d4ed8; }
.nl-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.nl-btn-sec { background: #f1f5f9; color: #475569; }
.nl-btn-sec:hover { background: #e2e8f0; }

/* Success */
.nl-success { text-align: center; padding: 20px 0; }
.nl-success-icon {
  width: 64px; height: 64px; border-radius: 50%; background: #dcfce7;
  color: #16a34a; font-size: 28px; display: flex; align-items: center; justify-content: center;
  margin: 0 auto 16px;
}
.nl-success h2 { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
.nl-success p { color: #64748b; font-size: 14px; margin-bottom: 24px; }
</style>
