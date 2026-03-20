import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      phaser: new URL('./tests/__mocks__/phaser.js', import.meta.url).pathname,
    },
  },
})
