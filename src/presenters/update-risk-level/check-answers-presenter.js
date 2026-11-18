import { riskDirectionText, riskLevelText } from '#/constants/risk-levels.js'

const PAGE_TITLE = 'Check your answers'
const CHANGE_HREF = '/update-risk-level'

const changeAction = (visuallyHiddenText) => ({
  items: [{ href: CHANGE_HREF, text: 'Change', visuallyHiddenText }]
})

const diseaseCard = ({
  disease,
  currentRiskLevel,
  direction,
  newRiskLevel
}) => ({
  title: disease,
  rows: [
    {
      key: { text: 'Current risk level' },
      value: { text: riskLevelText(currentRiskLevel) }
    },
    {
      key: { text: 'Direction of change' },
      value: { text: riskDirectionText(direction) }
    },
    {
      key: { text: 'New risk level' },
      value: { text: riskLevelText(newRiskLevel) },
      actions: changeAction(disease)
    }
  ]
})

/**
 * Formats data ready for presenting in the `/update-risk-level/check-answers` page
 * @module checkAnswersPresenter
 * @param {{changes: object[], expertComment: string}} riskLevelChange - the validated answers
 */
export const checkAnswersPresenter = ({ changes, expertComment }) => ({
  pageTitle: PAGE_TITLE,
  heading: PAGE_TITLE,
  diseases: changes.map(diseaseCard),
  comment: {
    rows: [
      {
        key: { text: 'Expert comment' },
        value: { text: expertComment },
        actions: changeAction('expert comment')
      }
    ]
  }
})
