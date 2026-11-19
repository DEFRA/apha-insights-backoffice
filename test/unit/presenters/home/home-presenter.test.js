import { homePresenter } from '#/presenters/home/home-presenter.js'
import {
  currentRiskLevels,
  validRiskLevelChange
} from '#test/helpers/risk-level-fixtures.js'

const SUBMITTED_AT = '2026-11-18T14:30:00.000Z'

const latestRiskLevelChange = () => ({
  submittedAt: SUBMITTED_AT,
  ...validRiskLevelChange()
})

const rowTexts = (tab) =>
  tab.table.rows.map((row) => row.map(({ text }) => text))

describe('#homePresenter', () => {
  test('Should provide the home page title, heading, intro and links', () => {
    const result = homePresenter({
      diseases: currentRiskLevels(),
      latest: null
    })

    expect(result).toMatchObject({
      pageTitle: 'Home',
      heading: 'IDM Insights',
      intro: 'Record risk level changes and view the latest data.',
      links: [{ text: 'Update risk level', href: '/update-risk-level' }]
    })
  })

  test('Should provide a tab for each disease with only its default row when nothing has been submitted', () => {
    const { riskLevelChanges } = homePresenter({
      diseases: currentRiskLevels(),
      latest: null
    })

    expect(riskLevelChanges.heading).toBe('Risk level changes')
    expect(
      riskLevelChanges.tabs.map(({ id, label }) => ({ id, label }))
    ).toEqual([
      { id: 'asf', label: 'African swine fever' },
      { id: 'hpai', label: 'Highly pathogenic avian influenza' },
      { id: 'bluetongue', label: 'Bluetongue' }
    ])
    expect(riskLevelChanges.tabs.map(rowTexts)).toEqual([
      [['Default', 'Medium', '–', '–', '–']],
      [['Default', 'High', '–', '–', '–']],
      [['Default', 'Low', '–', '–', '–']]
    ])
  })

  test('Should provide the table head on each tab', () => {
    const { riskLevelChanges } = homePresenter({
      diseases: currentRiskLevels(),
      latest: null
    })

    for (const tab of riskLevelChanges.tabs) {
      expect(tab.table.head).toEqual([
        { text: 'Status' },
        { text: 'Risk level' },
        { text: 'Change' },
        { text: 'Comment' },
        { text: 'Submitted' }
      ])
    }
  })

  test.each([
    ['undefined', undefined],
    ['an empty object', {}],
    [
      'changes that are not a list',
      { submittedAt: SUBMITTED_AT, changes: 'asf' }
    ],
    [
      'changes that are not objects',
      { submittedAt: SUBMITTED_AT, changes: [null, 'asf'] }
    ],
    [
      'an invalid submitted date',
      { ...latestRiskLevelChange(), submittedAt: 'not a date' }
    ]
  ])(
    'Should show only the default rows when the latest change is %s',
    (_, latest) => {
      const { riskLevelChanges } = homePresenter({
        diseases: currentRiskLevels(),
        latest
      })

      expect(riskLevelChanges.tabs.map((tab) => tab.table.rows.length)).toEqual(
        [1, 1, 1]
      )
    }
  )

  test('Should add a latest update row with the new level, direction, comment and submitted date', () => {
    const { riskLevelChanges } = homePresenter({
      diseases: currentRiskLevels(),
      latest: latestRiskLevelChange()
    })

    expect(rowTexts(riskLevelChanges.tabs[0])).toEqual([
      ['Default', 'Medium', '–', '–', '–'],
      [
        'Latest update',
        'High',
        'Increase',
        'New outbreaks reported in domestic pigs.',
        '18 November 2026 at 2:30pm'
      ]
    ])
    expect(rowTexts(riskLevelChanges.tabs[2])[1]).toEqual([
      'Latest update',
      'Very low',
      'Decrease',
      'Vector season has ended.',
      '18 November 2026 at 2:30pm'
    ])
  })

  test('Should show only the default row for a disease missing from the latest change', () => {
    const [asf] = validRiskLevelChange().changes
    const { riskLevelChanges } = homePresenter({
      diseases: currentRiskLevels(),
      latest: { submittedAt: SUBMITTED_AT, changes: [asf] }
    })

    expect(riskLevelChanges.tabs.map((tab) => tab.table.rows.length)).toEqual([
      2, 1, 1
    ])
  })

  test('Should present the comment as text, never html', () => {
    const comment = '<script>alert("x")</script>'
    const [asf] = validRiskLevelChange().changes
    const { riskLevelChanges } = homePresenter({
      diseases: currentRiskLevels(),
      latest: {
        submittedAt: SUBMITTED_AT,
        changes: [{ ...asf, userComment: comment }]
      }
    })
    const cells = riskLevelChanges.tabs.flatMap((tab) => tab.table.rows.flat())

    expect(riskLevelChanges.tabs[0].table.rows[1][3]).toEqual({ text: comment })
    for (const cell of cells) {
      expect(cell).not.toHaveProperty('html')
    }
  })
})
