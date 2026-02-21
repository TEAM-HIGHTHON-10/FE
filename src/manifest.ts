import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Highton',
  description: 'Browser extension starter for a virtual pet service.',
  version: '0.1.0',
  action: {
    default_title: 'Highton',
    default_popup: 'index.html',
  },
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
})
