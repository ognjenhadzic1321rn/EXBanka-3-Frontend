import {
  adminLogin,
  fetchCurrencies,
  createClient,
  activateClient,
  loginClientUi,
  createAccount,
  createCard,
} from '../helpers/banking'

describe('Client cards', () => {
  it('lists cards and lets the client block an active card', () => {
    const testData = {
      client: null,
      account: null,
      card: null,
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
        createClient(employeeToken, 'cards').then((client) => ({
          employeeToken,
          rsd,
          client,
        }))
      )
      .then(({ employeeToken, rsd, client }) => {
        testData.client = client
        activateClient(client.setupToken)

        return createAccount(employeeToken, client.id, rsd.id, `Kartica račun ${Date.now()}`, 3000).then((account) => {
          testData.account = account
          return createCard(employeeToken, {
            accountId: Number(account.id),
            clientId: Number(client.id),
            vrstaKartice: 'visa',
            nazivKartice: 'Cypress Visa',
            clientEmail: client.email,
            clientName: `${client.ime} ${client.prezime}`,
          }).then((card) => {
            testData.card = card
          })
        })
      })
      .then(() => {
        loginClientUi(testData.client.email)

        cy.visit('/client/cards')
        cy.contains('h1', 'Moje kartice').should('be.visible')
        expect(testData.card, 'created card fixture').to.have.property('broj_kartice')

        const masked = `${testData.card.broj_kartice.slice(0, 4)} **** **** ${testData.card.broj_kartice.slice(12)}`
        cy.contains(masked).should('be.visible')
        cy.contains('button', 'Blokiraj').click()
        cy.contains('Potvrda blokiranja').should('be.visible')
        cy.contains('button', 'Potvrdi blokiranje').click()

        cy.contains('Blokirana').should('be.visible')
      })
  })
})
