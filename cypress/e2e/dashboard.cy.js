import {
  adminLogin,
  fetchCurrencies,
  createClient,
  activateClient,
  loginClientUi,
  createAccount,
} from './helpers/banking'

describe('Client dashboard', () => {
  it('shows account overview, per-account transactions, exchange rates, and quick payment', () => {
    const testData = { client: null, account1: null, account2: null }

    adminLogin()
      .then((employeeToken) =>
        fetchCurrencies(employeeToken).then((currencies) => {
          const rsd = currencies.find((c) => c.kod === 'RSD')
          expect(rsd, 'RSD currency').to.exist
          return { employeeToken, rsd }
        })
      )
      .then(({ employeeToken, rsd }) =>
        createClient(employeeToken, 'dashboard').then((client) => ({
          employeeToken,
          rsd,
          client,
        }))
      )
      .then(({ employeeToken, rsd, client }) => {
        testData.client = client
        activateClient(client.setupToken)
        return createAccount(employeeToken, client.id, rsd.id, `Glavni ${Date.now()}`, 5000).then(
          (acc1) => {
            testData.account1 = acc1
            return createAccount(employeeToken, client.id, rsd.id, `Drugi ${Date.now()}`, 1000).then(
              (acc2) => {
                testData.account2 = acc2
              }
            )
          }
        )
      })
      .then(() => {
        loginClientUi(testData.client.email)

        // Dashboard loads
        cy.url().should('include', '/client/dashboard')
        cy.contains('Dobrodošli').should('be.visible')

        // Stats visible
        cy.contains('Ukupno stanje').should('be.visible')
        cy.contains('Broj računa').should('be.visible')

        // Accounts visible
        cy.contains('Moji računi').should('be.visible')
        cy.contains(testData.account1.brojRacuna).should('be.visible')

        // Per-account transaction selector exists
        cy.get('.account-selector').should('be.visible')
        cy.get('.account-selector').select(String(testData.account1.id))
        cy.contains('Poslednje transakcije').should('be.visible')

        // Exchange rates section
        cy.contains('Kursna lista').should('be.visible')

        // Quick payment section
        cy.contains('Brzo plaćanje').should('be.visible')
        cy.get('.quick-payment select').should('be.visible')
        cy.get('.quick-payment input[placeholder*="Broj"]').should('be.visible')
      })
  })
})
