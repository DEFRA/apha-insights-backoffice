import path from 'node:path'
import { readFileSync } from 'node:fs'

import { config } from '#/config/config.js'
import { buildNavigation } from '#/plugins/template-renderer/build-navigation.js'
import { createLogger } from '#/utils/logger.js'

const logger = createLogger()
const assetPath = config.get('assetPath')
const manifestPath = path.join(
  config.get('root'),
  '.public/.vite/manifest.json'
)

const googleTagManagerKey = config.get('googleAnalytics.googleTagManagerKey')
if (!googleTagManagerKey && config.get('isProduction')) {
  logger.warn('Analytics googleTagManagerKey not set')
}

let viteManifest

export function context(request) {
  if (config.get('isProduction') && !viteManifest) {
    try {
      viteManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    } catch (error) {
      logger.error(`Vite ${path.basename(manifestPath)} not found`)
    }
  }

  return {
    assetPath: `${assetPath}/assets`,
    serviceName: config.get('serviceDisplayName'),
    serviceUrl: '/',
    serviceInDevelopmentBanner: {
      enabled: config.get('serviceInDevelopmentBanner.enabled'),
      tag: config.get('serviceInDevelopmentBanner.tag'),
      text: config.get('serviceInDevelopmentBanner.text')
    },
    cookieName: config.get('cookieConsent.name'),
    googleTagManagerKey,
    breadcrumbs: [],
    navigation: buildNavigation(request),
    getAssetPath(asset) {
      if (!config.get('isProduction')) {
        return `${assetPath}/${asset}`
      }

      const viteAssetPath = viteManifest?.[asset]?.file
      return `${assetPath}/${viteAssetPath ?? asset}`
    }
  }
}
