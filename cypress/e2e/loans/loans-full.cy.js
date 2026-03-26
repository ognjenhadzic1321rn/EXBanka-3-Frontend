import {
  adminLogin,
  fetchCurrencies,
  createClient,
  activateClient,
  loginClientUi,
  createAccount,
} from '../helpers/banking'

describe('Loan request with all fields and loan details verification', () => {
  it('submits a loan request with all specification fields and verifies 13 detail fields', () => {
    const testData = { client: null, account: null }

    adminLogin()
      .then((employeeToken) =>
        fetchCurrencies(employeeToken).then((currencies) => {
          const rsd = currencies.find((c) => c.kod === 'RSD')
          return { employeeToken, rsd }
        })
      )
      .then(({ employeeToken, rsd }) =>
        createClient(employeeToken, 'loan-full').then((client) => ({
          employeeToken,
          rsd,
          client,
        }))
      )
      .then(({ employeeToken, rsd, client }) => {
        testData.client = client
        activateClient(client.setupToken)
        return createAccount(employeeToken, client.id, rsd.id, `Kredit račun ${Date.now()}`, 10000).then(
          (account) => {
            testData.account = account
          }
        )
      })
      .then(() => {
        loginClientUi(testData.client.email)
        cy.visit('/client/loans/new')

        cy.contains('h1', 'Zahtev za kredit').should('be.visible')

        // 1. Vrsta kredita
        cy.contains('.nl-radio-btn', 'Gotovinski').click()

        // 2. Tip kamatne stope
        cy.contains('.nl-radio-btn', 'Fiksna').click()

        // 3. Iznos kredita
        cy.get('input[placeholder="npr. 500000"]').clear().type('500000')

        // 4. Svrha kredita
        cy.get('input[placeholder*="Kupovina"]').clear().type('Kupovina automobila')

        // 5. Iznos mesečne plate
        cy.get('input[placeholder="npr. 120000"]').clear().type('120000')

        // 6. Status zaposlenja
        cy.get('select').filter(':has(option[value="stalno"])').select('stalno')

        // 7. Period zaposlenja
        cy.get('input[placeholder*="godine"]').clear().type('5 godina')

        // 8. Rok otplate (dropdown per type — gotovinski: 12,24,36,48,60,72,84)
        cy.get('select').filter(':has(option[value="36"])').select('36')

        // 9. Kontakt telefon
        cy.get('input[placeholder*="064"]').clear().type('0641234567')

        // 10. Broj računa
        cy.get('select.nl-input').last().select(testData.account.brojRacuna)

        // Preview visible
        cy.contains('Procena mesečne rate').should('be.visible')

        // Submit
        cy.contains('button', 'Podnesi zahtev').click()
        cy.contains('Zahtev je podnet').should('be.visible')
        cy.contains('button', 'Pregled kredita').click()

        // Navigate to loan list
        cy.url().should('include', '/client/loans')
        cy.contains('h1', 'Moji krediti').should('be.visible')

        // Click on loan to see details
        cy.contains('Gotovinski kredit').should('be.visible').click()

        // Verify all 13 detail fields
        cy.contains('Broj kredita').should('be.visible')
        cy.contains('Vrsta kredita').should('be.visible')
        cy.contains('Ukupni iznos kredita').should('be.visible')
        cy.contains('Period otplate').should('be.visible')
        cy.contains('Nominalna kamatna stopa').should('be.visible')
        cy.contains('Efektivna kamatna stopa').should('be.visible')
        cy.contains('Datum ugovaranja').should('be.visible')
        cy.contains('Datum kada kredit treba').should('be.visible')
        cy.contains('Iznos sledeće rate').should('be.visible')
        cy.contains('Datum sledeće rate').should('be.visible')
        cy.contains('Preostalo dugovanje').should('be.visible')
        cy.contains('Valuta kredita').should('be.visible')
        cy.contains('Račun za naplatu').should('be.visible')

        // Installments table
        cy.contains('Raspored rata').should('be.visible')
      })
  })
})
