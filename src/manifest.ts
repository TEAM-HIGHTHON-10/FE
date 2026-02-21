import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'GitTama',
  short_name: 'GitTama',
  description: 'GitHub에서 귀여운 펫을 키우는 데브 다마고치 위젯',
  version: '0.1.0',
  permissions: ['tabs', 'storage'],
  action: {
    default_title: 'GitTama',
    default_popup: 'index.html',
    default_icon: {
      16: 'icon.svg',
      48: 'icon.svg',
      128: 'icon.svg',
    },
  },
  icons: {
    16: 'icon.svg',
    48: 'icon.svg',
    128: 'icon.svg',
  },
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  host_permissions: ['*://github.com/*', '*://*.github.com/*'],
  content_scripts: [
    {
      matches: ['*://github.com/*', '*://*.github.com/*'],
      js: ['src/content/githubWidget.ts'],
      run_at: 'document_start',
    },
  ],
})
