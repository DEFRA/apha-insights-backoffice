import { riskDirectionText, riskLevelText } from '#/constants/risk-levels.js'
import {
  directionFieldName,
  userCommentFieldName
} from '#/schemas/risk-level-change-schema.js'

const PAGE_TITLE = 'Check your answers'
const FORM_HREF = '/update-risk-level'

const changeAction = (field, visuallyHiddenText) => ({
  items: [{ href: `${FORM_HREF}#${field}`, text: 'Change', visuallyHiddenText }]
})

const diseaseCard = ({
  id,
  disease,
  currentRiskLevel,
  direction,
  newRiskLevel,
  userComment
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
      actions: changeAction(directionFieldName(id), disease)
    },
    {
      key: { text: 'Comment' },
      value: { text: userComment },
      actions: changeAction(userCommentFieldName(id), `comment for ${disease}`)
    }
  ]
})

/**
 * Formats data ready for presenting in the `/update-risk-level/check-answers` page
 * @module checkAnswersPresenter
 * @param {{changes: object[]}} riskLevelChange - the validated answers
 */
export const checkAnswersPresenter = ({ changes }) => ({
  pageTitle: PAGE_TITLE,
  heading: PAGE_TITLE,
  diseases: changes.map(diseaseCard)
})
