import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Chick hub',
  short_name: 'Chick hub',
  description: 'GitHub에서 귀여운 펫을 키우는 데브 다마고치 위젯',
  version: '0.1.0',
  permissions: ['tabs', 'storage', 'scripting'],
  action: {
    default_title: 'Chick hub',
    default_popup: 'index.html',
    default_icon: {
      16: 'icon-16.png',
      48: 'icon-48.png',
      128: 'icon-128.png',
    },
  },
  icons: {
    16: 'icon-16.png',
    48: 'icon-48.png',
    128: 'icon-128.png',
  },
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  host_permissions: ['*://github.com/*', '*://*.github.com/*', 'https://dev.taisu.site/*'],
  content_scripts: [
    {
      matches: ['*://github.com/*', '*://*.github.com/*'],
      js: ['src/content/githubWidget.ts'],
      run_at: 'document_start',
    },
  ],
})
