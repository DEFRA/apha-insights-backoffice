import { SELECT_DISEASES_HREF } from '#/constants/update-risk-level-paths.js'

const PAGE_TITLE = 'Submission received'

/**
 * Formats data ready for presenting in the `/update-risk-level/confirmation` page
 * @module updateRiskLevelConfirmationPresenter
 */
export const updateRiskLevelConfirmationPresenter = () => ({
  pageTitle: PAGE_TITLE,
  heading: PAGE_TITLE,
  links: [
    { text: 'Home', href: '/' },
    { text: 'Add another', href: SELECT_DISEASES_HREF }
  ]
})
