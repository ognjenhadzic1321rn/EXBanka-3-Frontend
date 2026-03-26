import {
  adminLogin,
  fetchCurrencies,
  createClient,
  activateClient,
  loginClientUi,
  createAccount,
} from '../helpers/banking'

describe('Client loans', () => {
  it('submits a loan request and shows it in the client loans overview', () => {
    const testData = {
      client: null,
      account: null,
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
        createClient(employeeToken, 'loans').then((client) => ({
          employeeToken,
          rsd,
          client,
        }))
      )
      .then(({ employeeToken, rsd, client }) => {
        testData.client = client
        activateClient(client.setupToken)
        return createAccount(employeeToken, client.id, rsd.id, `Kredit račun ${Date.now()}`, 10000).then((account) => {
          testData.account = account
        })
      })
      .then(() => {
        loginClientUi(testData.client.email)

        cy.visit('/client/loans/new')
        cy.contains('h1', 'Zahtev za kredit').should('be.visible')
        cy.contains('.nl-radio-btn', 'Gotovinski').click()
        cy.get('input[placeholder="npr. 500000"]').clear().type('120001')
        cy.get('input[placeholder="npr. 60"]').clear().type('12')
        cy.get('select.nl-input').select(testData.account.brojRacuna)
        cy.contains('button', 'Podnesi zahtev').click()

        cy.contains('button', 'Pregled kredita').should('be.visible').click()

        cy.url().should('include', '/client/loans')
        cy.contains('h1', 'Moji krediti').should('be.visible')
        cy.contains('Gotovinski kredit').should('be.visible').click()
        cy.contains('Raspored rata').should('be.visible')
      })
  })
})
