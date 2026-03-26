import {
  adminLogin,
  fetchCurrencies,
  createClient,
  activateClient,
  loginClientUi,
  createAccount,
} from '../helpers/banking'

describe('Client accounts', () => {
  it('shows accounts, opens details, and renames an account', () => {
    const testData = {
      client: null,
      richerAccount: null,
      smallerAccount: null,
      renamedTo: `Preimenovan račun ${Date.now()}`,
    }

    adminLogin()
      .then((employeeToken) =>
        fetchCurrencies(employeeToken).then((currencies) => {
          const rsd = currencies.find((item) => item.kod === 'RSD')
          expect(rsd, 'RSD currency').to.exist
          return { employeeToken, rsd }
        })
      )
      .then(({ employeeToken, rsd }) =>
        createClient(employeeToken, 'accounts').then((client) => ({
          employeeToken,
          rsd,
          client,
        }))
      )
      .then(({ employeeToken, rsd, client }) => {
        testData.client = client
        activateClient(client.setupToken)

        return createAccount(employeeToken, client.id, rsd.id, `Primarni ${Date.now()}`, 1000).then((smallerAccount) => {
          testData.smallerAccount = smallerAccount
          return createAccount(employeeToken, client.id, rsd.id, `Veći ${Date.now()}`, 5000).then((richerAccount) => {
            testData.richerAccount = richerAccount
          })
        })
      })
      .then(() => {
        loginClientUi(testData.client.email)

        cy.visit('/client/accounts')
        cy.contains('h1', 'Računi').should('be.visible')
        cy.contains(testData.smallerAccount.brojRacuna).should('be.visible')
        cy.contains(testData.richerAccount.brojRacuna).should('be.visible')

        cy.get('.card code')
          .eq(0)
          .invoke('text')
          .should('contain', testData.richerAccount.brojRacuna)

        cy.contains('code', testData.richerAccount.brojRacuna)
          .closest('.card')
          .within(() => {
            cy.contains('button', 'Detalji').click()
          })

        cy.contains(testData.richerAccount.brojRacuna).should('be.visible')
        cy.contains('button', 'Promena naziva računa').click()
        cy.get('.modal input').clear().type(testData.renamedTo)
        cy.contains('.modal button', 'Sačuvaj').click()

        cy.contains(testData.renamedTo).should('be.visible')
      })
  })
})
