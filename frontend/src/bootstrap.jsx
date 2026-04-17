async function bootstrap() {
  if (!import.meta.env.DEV) {
    const runtimeConfigUrl = '/app-config.js'

    try {
      // Keep runtime config external so backend can override API paths in production.
      await import(/* @vite-ignore */ runtimeConfigUrl)
    } catch (error) {
      console.warn('运行时配置加载失败，使用默认 API 路径继续启动。', error)
    }
  }

  await import('./main.jsx')
}

bootstrap()
