<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAccountStore } from '../stores/account'
import { CURRENCIES } from '../api/account'
import ClientSelectDialog from '../components/ClientSelectDialog.vue'
import api from '../api/client'

const router = useRouter()
const store = useAccountStore()

const showClientDialog = ref(false)
const selectedClientId = ref<string | null>(null)
const selectedClientLabel = ref('')

// Sifre delatnosti from backend
const sifreDelatnosti = ref<{ id: number; sifra: string; naziv: string }[]>([])

async function loadSifreDelatnosti() {
  try {
    const res = await api.get('/sifre-delatnosti')
    sifreDelatnosti.value = res.data.sifre ?? []
  } catch { /* ignore */ }
}

const form = ref({
  currencyId: 1,
  tip: 'tekuci',
  vrsta: 'licni',
  podvrsta: 'standardni',
  naziv: '',
  pocetnoStanje: '',
})

// Firma form (samo za poslovni)
const firmaForm = ref({
  naziv: '',
  maticniBroj: '',
  pib: '',
  sifraDelatnostiId: 0,
  adresa: '',
})

const firmaError = ref('')
const firmaCreating = ref(false)

// Podvrste za tekući račun
const licnePodvrste = [
  { value: 'standardni', label: 'Standardni' },
  { value: 'stedni', label: 'Štedni' },
  { value: 'penzionerski', label: 'Penzionerski' },
  { value: 'za_mlade', label: 'Za mlade' },
  { value: 'za_studente', label: 'Za studente' },
  { value: 'za_nezaposlene', label: 'Za nezaposlene' },
]

const poslovnePodvrste = [
  { value: 'doo', label: 'DOO' },
  { value: 'ad', label: 'AD' },
  { value: 'fondacija', label: 'Fondacija' },
]

const currentPodvrste = computed(() => {
  if (form.value.tip !== 'tekuci') return []
  return form.value.vrsta === 'poslovni' ? poslovnePodvrste : licnePodvrste
})

const availableCurrencies = computed(() => {
  if (form.value.tip === 'devizni') {
    return CURRENCIES.filter(c => c.kod !== 'RSD')
  }
  return CURRENCIES.filter(c => c.kod === 'RSD')
})

watch(() => form.value.tip, (newTip) => {
  if (newTip === 'tekuci') {
    form.value.currencyId = 1
  } else {
    form.value.currencyId = 2
  }
  form.value.podvrsta = 'standardni'
})

watch(() => form.value.vrsta, () => {
  if (form.value.vrsta === 'licni') {
    form.value.podvrsta = 'standardni'
  } else {
    form.value.podvrsta = 'doo'
  }
})

function onClientSelected(clientId: string, label?: string) {
  selectedClientId.value = clientId
  selectedClientLabel.value = label ?? `Klijent #${clientId}`
  showClientDialog.value = false
}

async function handleSubmit() {
  if (!selectedClientId.value) {
    store.error = 'Izaberite klijenta.'
    return
  }

  let firmaId: number | undefined = undefined

  // Ako je poslovni, kreiramo firmu prvo
  if (form.value.vrsta === 'poslovni') {
    if (!firmaForm.value.naziv || !firmaForm.value.maticniBroj || !firmaForm.value.pib) {
      store.error = 'Naziv, matični broj i PIB firme su obavezni.'
      return
    }
    firmaCreating.value = true
    firmaError.value = ''
    try {
      const res = await api.post('/firme', {
        naziv: firmaForm.value.naziv,
        maticniBroj: firmaForm.value.maticniBroj,
        pib: firmaForm.value.pib,
        sifraDelatnostiId: firmaForm.value.sifraDelatnostiId || undefined,
        adresa: firmaForm.value.adresa,
        vlasnikId: Number(selectedClientId.value),
      })
      firmaId = res.data.firma.id
    } catch (e: any) {
      store.error = e.response?.data?.error || 'Greška pri kreiranju firme.'
      firmaCreating.value = false
      return
    }
    firmaCreating.value = false
  }

  const autoNaziv = form.value.naziv || (form.value.tip === 'tekuci'
    ? currentPodvrste.value.find(p => p.value === form.value.podvrsta)?.label + ' račun'
    : 'Devizni račun')

  try {
    await store.createAccount({
      clientId:   Number(selectedClientId.value),
      currencyId: form.value.currencyId,
      tip:        form.value.tip,
      vrsta:      form.value.vrsta,
      firmaId:    firmaId,
      naziv:      autoNaziv || undefined,
      pocetnoStanje: form.value.pocetnoStanje ? Number(form.value.pocetnoStanje) : 0,
    })
    router.push('/accounts')
  } catch {
    // error is set by store
  }
}

onMounted(() => loadSifreDelatnosti())
</script>

<template>
  <div class="page-content">
    <div class="page-header">
      <h1>Kreiranje računa</h1>
    </div>

    <div class="card" style="max-width:640px">
      <!-- Tip računa -->
      <div class="form-group" style="margin-bottom:20px">
        <label>Tip računa *</label>
        <div style="display:flex;gap:24px;margin-top:6px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="radio" v-model="form.tip" value="tekuci" />
            Tekući račun
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="radio" v-model="form.tip" value="devizni" />
            Devizni račun
          </label>
        </div>
      </div>

      <!-- Vrsta -->
      <div class="form-group" style="margin-bottom:20px">
        <label>Vrsta *</label>
        <div style="display:flex;gap:24px;margin-top:6px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="radio" v-model="form.vrsta" value="licni" />
            Lični
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="radio" v-model="form.vrsta" value="poslovni" />
            Poslovni
          </label>
        </div>
      </div>

      <!-- Podvrsta (samo za tekući) -->
      <div v-if="form.tip === 'tekuci' && currentPodvrste.length > 0" class="form-group" style="margin-bottom:20px">
        <label>Podvrsta računa *</label>
        <select v-model="form.podvrsta">
          <option v-for="p in currentPodvrste" :key="p.value" :value="p.value">
            {{ p.label }}
          </option>
        </select>
      </div>

      <!-- Izbor klijenta (vlasnik) -->
      <div class="form-group" style="margin-bottom:20px">
        <label>Vlasnik (klijent) *</label>
        <div style="display:flex;align-items:center;gap:12px">
          <span v-if="selectedClientId" style="flex:1;padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;background:#f9fafb">
            {{ selectedClientLabel }}
          </span>
          <span v-else style="flex:1;padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;color:#9ca3af">
            Klijent nije izabran
          </span>
          <button class="btn-secondary" type="button" @click="showClientDialog = true">
            {{ selectedClientId ? 'Promeni' : 'Izaberi klijenta' }}
          </button>
        </div>
      </div>

      <!-- FIRMA (samo za poslovni) -->
      <div v-if="form.vrsta === 'poslovni'" style="border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:20px;background:#f8fafc">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;color:#1e293b">Podaci o firmi</h3>

        <div class="form-group" style="margin-bottom:14px">
          <label>Naziv firme *</label>
          <input v-model="firmaForm.naziv" placeholder="npr. Firma DOO" />
        </div>

        <div class="form-row" style="margin-bottom:14px">
          <div class="form-group">
            <label>Matični broj *</label>
            <input v-model="firmaForm.maticniBroj" placeholder="12345678" maxlength="8" />
          </div>
          <div class="form-group">
            <label>PIB *</label>
            <input v-model="firmaForm.pib" placeholder="123456789" maxlength="9" />
          </div>
        </div>

        <div class="form-group" style="margin-bottom:14px">
          <label>Šifra delatnosti</label>
          <select v-model="firmaForm.sifraDelatnostiId">
            <option :value="0">-- Izaberite šifru delatnosti --</option>
            <option v-for="s in sifreDelatnosti" :key="s.id" :value="s.id">
              {{ s.sifra }} — {{ s.naziv }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>Adresa</label>
          <input v-model="firmaForm.adresa" placeholder="Trg Republike V/5, Beograd, Srbija" />
        </div>

        <p style="font-size:12px;color:#64748b;margin-top:10px">
          Vlasnik firme će biti isti klijent koji je izabran kao vlasnik računa.
        </p>
      </div>

      <!-- Valuta -->
      <div v-if="form.tip === 'devizni'" class="form-group" style="margin-bottom:20px">
        <label>Valuta *</label>
        <select v-model="form.currencyId">
          <option v-for="c in availableCurrencies" :key="c.id" :value="c.id">
            {{ c.kod }} — {{ c.naziv }}
          </option>
        </select>
      </div>
      <div v-else class="form-group" style="margin-bottom:20px">
        <label>Valuta</label>
        <input value="RSD — Srpski dinar" disabled style="background:#f9fafb;color:#6b7280" />
      </div>

      <!-- Početno stanje -->
      <div class="form-group" style="margin-bottom:20px">
        <label>Početno stanje (opciono)</label>
        <input v-model="form.pocetnoStanje" type="number" min="0" step="0.01" placeholder="0.00" />
        <span style="font-size:12px;color:#64748b;margin-top:4px">Iznos koji klijent uplaćuje prilikom otvaranja računa</span>
      </div>

      <!-- Naziv računa -->
      <div class="form-group" style="margin-bottom:20px">
        <label>Naziv računa (opciono)</label>
        <input v-model="form.naziv" placeholder="npr. Moj štedni račun" />
      </div>

      <!-- Kartica — Sprint 3 -->
      <div class="form-group" style="margin-bottom:24px;flex-direction:row;align-items:center;gap:10px">
        <input type="checkbox" id="card-checkbox" disabled style="width:16px;height:16px" />
        <label for="card-checkbox" style="margin:0;color:#9ca3af">
          Izdaj debitnu karticu (dostupno u Sprint 3)
        </label>
      </div>

      <p v-if="store.error" class="global-error" style="margin-bottom:16px">{{ store.error }}</p>

      <div style="display:flex;gap:12px">
        <button class="btn-secondary" type="button" @click="router.push('/accounts')">Otkaži</button>
        <button class="btn-primary" type="button" :disabled="store.loading || firmaCreating" @click="handleSubmit">
          {{ store.loading || firmaCreating ? 'Kreiram...' : 'Kreiraj račun' }}
        </button>
      </div>
    </div>
  </div>

  <ClientSelectDialog
    v-if="showClientDialog"
    @close="showClientDialog = false"
    @selected="onClientSelected"
  />
</template>
