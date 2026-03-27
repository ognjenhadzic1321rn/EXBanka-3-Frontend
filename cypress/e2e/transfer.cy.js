import {
  adminLogin,
  fetchCurrencies,
  createClient,
  activateClient,
  loginClientUi,
  createAccount,
} from './helpers/banking'

describe('Same-client transfers', () => {
  it('creates a transfer between two accounts of the same client (auto-confirmed)', () => {
    const testData = {
      client: null,
      fromAccountName: `CY Transfer From ${Date.now()}`,
      toAccountName: `CY Transfer To ${Date.now()}`,
      fromAccount: null,
      toAccount: null,
      purpose: `cypress-transfer-${Date.now()}`,
    }

    adminLogin()
      .then((employeeToken) =>
        fetchCurrencies(employeeToken).then((currencies) => {
          const rsd = currencies.find((c) => c.kod === 'RSD')
          expect(rsd, 'RSD currency').to.exist
          return { employeeToken, rsd }
        })
      )
      .then(({ employeeToken, rsd }) =>
        createClient(employeeToken, 'same-client').then((client) => ({
          employeeToken,
          rsd,
          client,
        }))
      )
      .then(({ employeeToken, rsd, client }) => {
        testData.client = client
        activateClient(client.setupToken)
        return createAccount(employeeToken, client.id, rsd.id, testData.fromAccountName, 5000).then(
          (fromAccount) => {
            testData.fromAccount = fromAccount
            return createAccount(employeeToken, client.id, rsd.id, testData.toAccountName, 100).then(
              (toAccount) => {
                testData.toAccount = toAccount
              }
            )
          }
        )
      })
      .then(() => {
        loginClientUi(testData.client.email)

        cy.visit('/client/transfers')
        cy.contains('h1', 'Transferi').should('be.visible')

        cy.get('.tf-card-primary .tf-field select')
          .eq(0)
          .should('be.visible')
          .select(String(testData.fromAccount.id))

        cy.get('.tf-card-primary .tf-field select')
          .eq(1)
          .should('be.visible')
          .select(String(testData.toAccount.id))

        cy.get('input[type="number"]').clear().type('200')
        cy.get('input[placeholder="Svrha transakcije"]').clear().type(testData.purpose)

        cy.contains('button', 'Nastavi').click()
        cy.contains('span', 'Provizija').should('be.visible')
        cy.contains('button', 'Potvrdi transfer').click()

        // Transfer is auto-confirmed (same-client, no mobile OTP needed)
        cy.contains('Transfer uspesno realizovan!').should('be.visible')
        cy.contains(testData.purpose).should('be.visible')
        cy.contains('button', 'Novi transfer').should('be.visible')
      })
  })
})
