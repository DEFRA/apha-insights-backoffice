import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { config } from '#/config/config.js'

const settingSchema = (group, name) =>
  config.getSchema()._cvtProperties[group]._cvtProperties[name]

describe('#config', () => {
  describe('backendApi.url', () => {
    const loadConfig = async (env) => {
      vi.resetModules()
      Object.entries(env).forEach(([name, value]) => vi.stubEnv(name, value))
      return import('#/config/config.js')
    }

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    test('Should have no default, so every environment sets it', () => {
      expect(settingSchema('backendApi', 'url')).toMatchObject({
        format: 'url',
        nullable: true,
        default: null,
        env: 'BACKEND_API_URL'
      })
    })

    test('Should fail at startup when the backend is switched on without a URL', async () => {
      await expect(
        loadConfig({ BACKEND_API_ENABLED: 'true', BACKEND_API_URL: undefined })
      ).rejects.toThrow(
        'BACKEND_API_URL must be set when BACKEND_API_ENABLED is true'
      )
    })

    test('Should start without a URL when the backend is switched off', async () => {
      const { config: loaded } = await loadConfig({
        BACKEND_API_ENABLED: 'false',
        BACKEND_API_URL: undefined
      })

      expect(loaded.get('backendApi.url')).toBeNull()
    })

    test('Should start when the backend is switched on with a URL', async () => {
      const { config: loaded } = await loadConfig({
        BACKEND_API_ENABLED: 'true',
        BACKEND_API_URL: 'http://backend.test:3001'
      })

      expect(loaded.get('backendApi.url')).toBe('http://backend.test:3001')
    })
  })

  describe('backendApi.historyMonths', () => {
    test('Should default to 6 months, read from RISK_HISTORY_MONTHS', () => {
      expect(settingSchema('backendApi', 'historyMonths')).toEqual({
        doc: expect.stringMatching(/\S/),
        format: 'nat',
        default: 6,
        env: 'RISK_HISTORY_MONTHS'
      })
      expect(config.get('backendApi.historyMonths')).toBe(6)
    })

    test('Should be listed in .env.example with a comment', async () => {
      const envExample = await readFile(
        path.join(config.get('root'), '.env.example'),
        'utf8'
      )

      expect(envExample).toMatch(/^# .+\nRISK_HISTORY_MONTHS=6$/m)
    })
  })
})
