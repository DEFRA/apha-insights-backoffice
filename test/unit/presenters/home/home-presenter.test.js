import { homePresenter } from '#/presenters/home/home-presenter.js'
import { assessment } from '#test/helpers/backend-risk-fixtures.js'

const riskLevelHistory = () => [
  {
    id: '00000000-0000-4000-a000-000000000001',
    label: 'African swine fever',
    assessments: [
      assessment(),
      assessment({
        status: 'very low',
        previousStatus: 'very low',
        levelChange: 'no change',
        source: 'Preliminary outbreak assessment',
        dateReported: '2026-08-14T00:00:00.000Z'
      })
    ]
  },
  {
    id: '00000000-0000-4000-a000-000000000002',
    label: 'Avian influenza (H5N1)',
    assessments: [
      assessment({
        status: 'negligible',
        previousStatus: 'low',
        levelChange: 'improving',
        source: 'Risk assessment',
        dateReported: '2026-10-01T00:00:00.000Z'
      })
    ]
  }
]

const rowTexts = (tab) =>
  tab.table.rows.map((row) => row.map(({ text }) => text))

const presentTab = (assessmentOverrides) =>
  homePresenter({
    diseases: [
      {
        id: '00000000-0000-4000-a000-000000000001',
        label: 'African swine fever',
        assessments: [assessment(assessmentOverrides)]
      }
    ]
  }).riskLevelChanges.tabs[0]

describe('#homePresenter', () => {
  test('Should provide the home page title, heading, intro and links', () => {
    const result = homePresenter({ diseases: riskLevelHistory() })

    expect(result).toMatchObject({
      pageTitle: 'Home',
      heading: 'IDM Insights',
      intro: 'Record risk level changes and view the latest data.',
      links: [{ text: 'Update risk level', href: '/update-risk-level' }]
    })
  })

  test('Should provide a tab for each disease, labelled with the disease label, in the order given', () => {
    const { riskLevelChanges } = homePresenter({
      diseases: riskLevelHistory()
    })

    expect(riskLevelChanges.heading).toBe('Risk level changes')
    expect(
      riskLevelChanges.tabs.map(({ id, label }) => ({ id, label }))
    ).toEqual([
      {
        id: 'disease-00000000-0000-4000-a000-000000000001',
        label: 'African swine fever'
      },
      {
        id: 'disease-00000000-0000-4000-a000-000000000002',
        label: 'Avian influenza (H5N1)'
      }
    ])
  })

  test('Should provide the table head on each tab', () => {
    const { riskLevelChanges } = homePresenter({
      diseases: riskLevelHistory()
    })

    for (const tab of riskLevelChanges.tabs) {
      expect(tab.table.head).toEqual([
        { text: 'Risk level' },
        { text: 'Change' },
        { text: 'Comment' },
        { text: 'Submitted' },
        { text: 'Source' }
      ])
    }
  })

  test('Should provide one row per assessment, in the order given', () => {
    const { riskLevelChanges } = homePresenter({
      diseases: riskLevelHistory()
    })

    expect(riskLevelChanges.tabs.map(rowTexts)).toEqual([
      [
        [
          'Medium',
          'Deteriorating',
          '–',
          '6 November 2026',
          'Defra outbreak assessment'
        ],
        [
          'Very low',
          'No change',
          '–',
          '14 August 2026',
          'Preliminary outbreak assessment'
        ]
      ],
      [['Negligible', 'Improving', '–', '1 October 2026', 'Risk assessment']]
    ])
  })

  test.each([
    ['deteriorating', 'Deteriorating'],
    ['no change', 'No change'],
    ['improving', 'Improving'],
    ['undetermined', 'Undetermined']
  ])('Should show a %s change as %s', (levelChange, text) => {
    expect(rowTexts(presentTab({ levelChange }))[0][1]).toBe(text)
  })

  test('Should show a risk level that is not on the scale as it was given', () => {
    expect(rowTexts(presentTab({ status: 'severe' }))[0][0]).toBe('severe')
  })

  test('Should present every cell as text, never html', () => {
    const malicious = '<script>alert("x")</script>'
    const tab = presentTab({ source: malicious })

    expect(rowTexts(tab)[0][4]).toBe(malicious)
    for (const cell of tab.table.rows.flat()) {
      expect(cell).not.toHaveProperty('html')
    }
  })

  test('Should provide no tabs and a message when there are no diseases', () => {
    const { riskLevelChanges } = homePresenter({ diseases: [] })

    expect(riskLevelChanges).toEqual({
      heading: 'Risk level changes',
      tabs: [],
      emptyMessage: 'No risk levels have been recorded yet.'
    })
  })

  test('Should not provide the no diseases message when there are diseases', () => {
    const { riskLevelChanges } = homePresenter({
      diseases: riskLevelHistory()
    })

    expect(riskLevelChanges).not.toHaveProperty('emptyMessage')
  })

  test('Should not change the data it is given', () => {
    const diseases = riskLevelHistory()

    homePresenter({ diseases })

    expect(diseases).toEqual(riskLevelHistory())
  })
})
