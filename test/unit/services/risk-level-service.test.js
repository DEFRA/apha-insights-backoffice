import {
  getCurrentRiskLevels,
  submitRiskLevelChange
} from '#/services/risk-level-service.js'
import { validRiskLevelChange } from '#test/helpers/risk-level-fixtures.js'

describe('#riskLevelService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
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

  test('submitRiskLevelChange resolves without sending the data anywhere', async () => {
    await expect(
      submitRiskLevelChange(validRiskLevelChange())
    ).resolves.toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
  })
})
