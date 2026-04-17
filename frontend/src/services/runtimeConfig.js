const CONFIG_GLOBAL_KEY = '__AI_STUDIO_CONFIG__'
const DEFAULT_RUNTIME_CONFIG = {
  generateApiBase: '/api/generate',
  referApiBase: '/api/refer',
  watermarkApiBase: '/api/watermark',
}

function readRuntimeConfig() {
  const runtimeConfig = globalThis[CONFIG_GLOBAL_KEY]
  if (!runtimeConfig || typeof runtimeConfig !== 'object') {
    return DEFAULT_RUNTIME_CONFIG
  }
  return { ...DEFAULT_RUNTIME_CONFIG, ...runtimeConfig }
}

function requireConfigValue(key) {
  const runtimeConfig = readRuntimeConfig()
  const value = runtimeConfig[key]

  if (!value || typeof value !== 'string') {
    const defaultValue = DEFAULT_RUNTIME_CONFIG[key]
    if (defaultValue) return defaultValue
    throw new Error(`运行时配置缺少 ${key}`)
  }

  return value
}

export const getGenerateApiBase = () => requireConfigValue('generateApiBase')
export const getReferApiBase = () => requireConfigValue('referApiBase')
export const getWatermarkApiBase = () => requireConfigValue('watermarkApiBase')
