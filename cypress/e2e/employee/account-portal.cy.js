import {
  adminLogin,
  fetchCurrencies,
  createClient,
  activateClient,
  createAccount,
  createCard,
} from '../helpers/banking'
import { loginEmployeeUi } from '../helpers/employee'

describe('Employee: Account portal with cards', () => {
  it('lists accounts, opens card panel showing owner info, and manages card status', () => {
    const testData = { client: null, account: null, card: null }

    adminLogin()
      .then((employeeToken) =>
        fetchCurrencies(employeeToken).then((currencies) => {
          const rsd = currencies.find((c) => c.kod === 'RSD')
          return { employeeToken, rsd }
        })
      )
      .then(({ employeeToken, rsd }) =>
        createClient(employeeToken, 'portal').then((client) => ({
          employeeToken,
          rsd,
          client,
        }))
      )
      .then(({ employeeToken, rsd, client }) => {
        testData.client = client
        activateClient(client.setupToken)
        return createAccount(employeeToken, client.id, rsd.id, `Portal ${Date.now()}`, 5000).then(
          (account) => {
            testData.account = account
            return createCard(employeeToken, {
              accountId: Number(account.id),
              clientId: Number(client.id),
              vrstaKartice: 'visa',
              nazivKartice: 'Portal Visa',
              clientEmail: client.email,
              clientName: `${client.ime} ${client.prezime}`,
            }).then((card) => {
              testData.card = card
            })
          }
        )
      })
      .then(() => {
        loginEmployeeUi()

        cy.visit('/accounts')
        cy.contains('h1', 'Upravljanje računima').should('be.visible')

        // Filter
        cy.get('input[placeholder*="broju računa"]').type(testData.account.brojRacuna)
        cy.contains('button', 'Pretraži').click()
        cy.contains('code', testData.account.brojRacuna).should('be.visible')

        // Open cards panel
        cy.contains('code', testData.account.brojRacuna).closest('tr').click()
        cy.contains('Kartice računa').should('be.visible')

        // Card info
        cy.get('.card-row-number').should('be.visible')
        cy.get('.card-owner-name').should('be.visible')
        cy.get('.card-owner-email').should('be.visible')
        cy.contains('Aktivna').should('be.visible')

        // Block
        cy.contains('button', 'Blokiraj').click()
        cy.contains('Blokirana').should('be.visible')

        // Unblock
        cy.contains('button', 'Deblokiraj').click()
        cy.contains('Aktivna').should('be.visible')

        // Deactivate
        cy.contains('button', 'Deaktiviraj').click()
        cy.contains('Deaktivirana').should('be.visible')
      })
  })
})
