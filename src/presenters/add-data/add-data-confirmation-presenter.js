const PAGE_TITLE = 'Submission received'

/**
 * Formats data ready for presenting in the `/add-data/confirmation` page
 * @module addDataConfirmationPresenter
 */
export const addDataConfirmationPresenter = () => ({
  pageTitle: PAGE_TITLE,
  heading: PAGE_TITLE,
  links: [
    { text: 'Home', href: '/' },
    { text: 'Add another', href: '/add-data' }
  ]
})
