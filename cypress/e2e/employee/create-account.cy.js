import { loginEmployeeUi } from '../helpers/employee'

describe('Employee: Create account', () => {
  it('creates a tekući lični standardni account with card checkbox and initial balance', () => {
    loginEmployeeUi()

    cy.visit('/accounts/new')
    cy.contains('Kreiranje računa').should('be.visible')

    // Tekući
    cy.contains('Tekući račun').click()
    // Lični
    cy.contains('Lični').click()

    // Select client
    cy.contains('button', 'Izaberi klijenta').click()
    // Create New tab
    cy.contains('button', 'Create New').click()
    cy.get('.modal input[placeholder="Ana"]').type('CypressAcc')
    cy.get('.modal input[placeholder="Jović"]').type(`Test${Date.now()}`)
    cy.get('.modal input[type="email"]').last().type(`cypress.newacc.${Date.now()}@example.com`)
    cy.contains('button', 'Create & Select').click()

    // Wait for dialog to close
    cy.get('.modal-overlay').should('not.exist')

    // Currency: RSD (auto for tekući)
    cy.get('input[value*="RSD"]').should('be.visible')

    // Initial balance
    cy.get('input[type="number"]').clear().type('5000')

    // Card checkbox
    cy.get('#card-checkbox').check()
    cy.get('select').filter(':has(option[value="visa"])').select('visa')

    // Submit
    cy.contains('button', 'Kreiraj račun').click()
    cy.url().should('include', '/accounts', { timeout: 15000 })
  })

  it('creates a devizni poslovni account with firma data', () => {
    loginEmployeeUi()

    cy.visit('/accounts/new')

    // Devizni
    cy.contains('Devizni račun').click()
    // Poslovni
    cy.contains('Poslovni').click()

    // Select client
    cy.contains('button', 'Izaberi klijenta').click()
    cy.contains('button', 'Create New').click()
    cy.get('.modal input[placeholder="Ana"]').type('CypressDeviz')
    cy.get('.modal input[placeholder="Jović"]').type(`Poslovni${Date.now()}`)
    cy.get('.modal input[type="email"]').last().type(`cypress.deviz.${Date.now()}@example.com`)
    cy.contains('button', 'Create & Select').click()
    cy.get('.modal-overlay').should('not.exist')

    // Firma section
    cy.contains('Podaci o firmi').should('be.visible')
    cy.get('input[placeholder*="Firma"]').type('Test Firma DOO')
    cy.get('input[placeholder="12345678"]').type(`${Math.floor(10000000 + Math.random() * 90000000)}`)
    cy.get('input[placeholder="123456789"]').type(`${Math.floor(100000000 + Math.random() * 900000000)}`)
    cy.get('input[placeholder*="Trg"]').type('Nemanjina 4, Beograd')

    // Initial balance
    cy.get('input[type="number"]').clear().type('1000')

    cy.contains('button', 'Kreiraj račun').click()
    cy.url().should('include', '/accounts', { timeout: 15000 })
  })
})
