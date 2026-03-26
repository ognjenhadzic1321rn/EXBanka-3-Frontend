import {
  adminLogin,
  fetchCurrencies,
  createClient,
  activateClient,
  createAccount,
  API_BASE,
} from '../helpers/banking'
import { loginEmployeeUi } from '../helpers/employee'

describe('Employee: Loan management', () => {
  it('views loan requests with detail modal, approves, and verifies loans list', () => {
    const testData = { client: null, account: null }

    adminLogin()
      .then((employeeToken) =>
        fetchCurrencies(employeeToken).then((currencies) => {
          const rsd = currencies.find((c) => c.kod === 'RSD')
          return { employeeToken, rsd }
        })
      )
      .then(({ employeeToken, rsd }) =>
        createClient(employeeToken, 'loan-mgmt').then((client) => ({
          employeeToken,
          rsd,
          client,
        }))
      )
      .then(({ employeeToken, rsd, client }) => {
        testData.client = client
        activateClient(client.setupToken)
        return createAccount(employeeToken, client.id, rsd.id, `Kredit mgmt ${Date.now()}`, 20000).then(
          (account) => {
            testData.account = account
            // Create loan request via client API
            return cy
              .request('POST', `${API_BASE}/auth/client/login`, {
                email: client.email,
                password: Cypress.env('clientPassword'),
              })
              .its('body.accessToken')
              .then((clientToken) =>
                cy.request({
                  method: 'POST',
                  url: `${API_BASE}/loans/request`,
                  headers: { Authorization: `Bearer ${clientToken}` },
                  body: {
                    vrsta: 'gotovinski',
                    broj_racuna: account.brojRacuna,
                    iznos: 200000,
                    period: 24,
                    tip_kamate: 'fiksna',
                    client_id: Number(client.id),
                    currency_id: rsd.id,
                    euribor_rate: 0,
                    svrha_kredita: 'Kupovina opreme',
                    iznos_mesecne_plate: 150000,
                    status_zaposlenja: 'stalno',
                    period_zaposlenja: '4 godine',
                    kontakt_telefon: '0641234567',
                  },
                })
              )
          }
        )
      })
      .then(() => {
        loginEmployeeUi()

        // Loan requests page — filter by account number to find our specific request
        cy.visit('/loans/requests')
        cy.contains('Zahtevi za kredit').should('be.visible')
        cy.get('input[placeholder*="Broj računa"]').type(testData.account.brojRacuna)
        cy.contains('button', 'Pretraži').click()
        cy.contains('Gotovinski').should('be.visible')

        // Open detail modal
        cy.contains('td', 'Gotovinski').click()

        // Verify all client fields in modal
        cy.get('.lr-modal').should('be.visible')
        cy.contains('Svrha kredita').should('be.visible')
        cy.contains('Kupovina opreme').should('be.visible')
        cy.contains('Iznos mesečne plate').should('be.visible')
        cy.contains('Status zaposlenja').should('be.visible')
        cy.contains('Period zaposlenja').should('be.visible')
        cy.contains('Kontakt telefon').should('be.visible')
        cy.contains('0641234567').should('be.visible')

        // Approve
        cy.contains('.lr-modal button', 'Odobri').click()
        cy.contains('odobren').should('be.visible')

        // All loans page
        cy.visit('/loans')
        cy.contains('Svi krediti').should('be.visible')

        // Verify table headers per spec
        cy.contains('th', 'Vrsta').should('be.visible')
        cy.contains('th', 'Tip kamate').should('be.visible')
        cy.contains('th', 'Preostalo dugovanje').should('be.visible')
        cy.contains('th', 'Valuta').should('be.visible')
        cy.contains('th', 'Status').should('be.visible')
      })
  })
})
