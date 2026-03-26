import {
  adminLogin,
  fetchCurrencies,
  createClient,
  activateClient,
  loginClientUi,
  createAccount,
} from '../helpers/banking'

describe('Account rename validation and limit changes', () => {
  it('rejects duplicate account name and allows limit change', () => {
    const testData = { client: null, account1: null, account2: null }
    const name1 = `Račun A ${Date.now()}`
    const name2 = `Račun B ${Date.now()}`

    adminLogin()
      .then((employeeToken) =>
        fetchCurrencies(employeeToken).then((currencies) => {
          const rsd = currencies.find((c) => c.kod === 'RSD')
          return { employeeToken, rsd }
        })
      )
      .then(({ employeeToken, rsd }) =>
        createClient(employeeToken, 'rename-val').then((client) => ({
          employeeToken,
          rsd,
          client,
        }))
      )
      .then(({ employeeToken, rsd, client }) => {
        testData.client = client
        activateClient(client.setupToken)
        return createAccount(employeeToken, client.id, rsd.id, name1, 3000).then((acc1) => {
          testData.account1 = acc1
          return createAccount(employeeToken, client.id, rsd.id, name2, 1000).then((acc2) => {
            testData.account2 = acc2
          })
        })
      })
      .then(() => {
        loginClientUi(testData.client.email)
        cy.visit('/client/accounts')

        // Open details for account1
        cy.contains('code', testData.account1.brojRacuna)
          .closest('.card')
          .within(() => {
            cy.contains('button', 'Detalji').click()
          })

        // Try renaming to same name
        cy.contains('button', 'Promena naziva računa').click()
        cy.get('.modal input').clear().type(name1)
        cy.contains('.modal button', 'Sačuvaj').click()
        cy.contains('isti kao trenutni').should('be.visible')

        // Try renaming to other account's name
        cy.get('.modal input').clear().type(name2)
        cy.contains('.modal button', 'Sačuvaj').click()
        cy.contains('Već imate račun').should('be.visible')

        // Valid rename
        const newName = `Preimenovan ${Date.now()}`
        cy.get('.modal input').clear().type(newName)
        cy.contains('.modal button', 'Sačuvaj').click()
        cy.contains(newName).should('be.visible')

        // Change limits
        cy.contains('button', 'Promena limita').click()
        cy.get('.modal input').first().clear().type('200000')
        cy.get('.modal input').last().clear().type('2000000')
        cy.contains('.modal button', 'Sačuvaj').click()
      })
  })
})
