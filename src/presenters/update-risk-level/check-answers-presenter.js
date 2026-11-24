import { riskDirectionText, riskLevelText } from '#/constants/risk-levels.js'
import {
  CHANGE_PATH,
  SELECT_DISEASES_HREF
} from '#/constants/update-risk-level-paths.js'
import {
  directionFieldName,
  userCommentFieldName
} from '#/schemas/risk-level-change-schema.js'

const PAGE_TITLE = 'Check your answers'

const changeAction = (field, visuallyHiddenText) => ({
  items: [
    { href: `${CHANGE_PATH}#${field}`, text: 'Change', visuallyHiddenText }
  ]
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
      actions: changeAction(
        directionFieldName(id),
        `direction of change for ${disease}`
      )
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
  selection: {
    key: { text: 'Diseases to update' },
    value: { text: changes.map(({ disease }) => disease).join(', ') },
    actions: {
      items: [
        {
          href: SELECT_DISEASES_HREF,
          text: 'Change',
          visuallyHiddenText: 'diseases to update'
        }
      ]
    }
  },
  diseases: changes.map(diseaseCard)
})
