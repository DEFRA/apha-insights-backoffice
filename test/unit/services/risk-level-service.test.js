import {
  getCurrentRiskLevels,
  getLatestRiskLevelChange,
  resetLatestRiskLevelChange,
  submitRiskLevelChange
} from '#/services/risk-level-service.js'
import { validRiskLevelChange } from '#test/helpers/risk-level-fixtures.js'

describe('#riskLevelService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    resetLatestRiskLevelChange()
    vi.unstubAllGlobals()
  })

  test('getCurrentRiskLevels resolves with three diseases, each with a current risk level', async () => {
    const diseases = await getCurrentRiskLevels()

    expect(diseases).toHaveLength(3)
    for (const disease of diseases) {
      expect(disease).toEqual({
        id: expect.any(String),
        name: expect.any(String),
        currentRiskLevel: expect.any(String)
      })
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  test('getLatestRiskLevelChange resolves with null before anything is submitted', async () => {
    await expect(getLatestRiskLevelChange()).resolves.toBeNull()
  })

  test('submitRiskLevelChange resolves without sending the data over the network', async () => {
    await expect(
      submitRiskLevelChange(validRiskLevelChange())
    ).resolves.toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
  })

  test('getLatestRiskLevelChange resolves with the submitted changes and when they were submitted', async () => {
    await submitRiskLevelChange(validRiskLevelChange())

    const latest = await getLatestRiskLevelChange()

    expect(latest).toEqual({
      submittedAt: expect.any(String),
      changes: validRiskLevelChange().changes
    })
    expect(new Date(latest.submittedAt).toISOString()).toBe(latest.submittedAt)
    expect(fetch).not.toHaveBeenCalled()
  })

  test('a second submission replaces the first', async () => {
    await submitRiskLevelChange(validRiskLevelChange())
    const [asf] = validRiskLevelChange().changes
    await submitRiskLevelChange({
      changes: [{ ...asf, userComment: 'Second submission' }]
    })

    const { changes } = await getLatestRiskLevelChange()

    expect(changes).toEqual([{ ...asf, userComment: 'Second submission' }])
  })

  test('resetLatestRiskLevelChange clears the latest submission', async () => {
    await submitRiskLevelChange(validRiskLevelChange())

    resetLatestRiskLevelChange()

    await expect(getLatestRiskLevelChange()).resolves.toBeNull()
  })
})
