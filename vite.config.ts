import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import monkey from 'vite-plugin-monkey';
import { readFileSync } from 'node:fs';

const isUserscript = process.env.TREEHOLE_ART === '1';
const enableCopy = process.env.ENABLE_COPY === '1';
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
const releaseUrl = enableCopy
    ? process.env.CDN_COPY_PUBLIC_URL || 'https://cdn.arthals.ink/release/Treehole-Art-copy.user.js'
    : process.env.CDN_PUBLIC_URL || 'https://cdn.arthals.ink/release/Treehole-Art.user.js';

export default defineConfig({
    define: {
        __ENABLE_COPY__: JSON.stringify(enableCopy),
    },
    build: {
        emptyOutDir: !(isUserscript && enableCopy),
        minify: 'oxc',
    },
    plugins: [
        react(),
        ...(isUserscript
            ? [
                  monkey({
                      entry: 'src/main.tsx',
                      userscript: {
                          name: enableCopy ? 'Treehole-Art Copy' : 'Treehole-Art',
                          namespace: 'https://treehole.pku.edu.cn/',
                          version,
                          description: '为北大树洞打造的现代化第三方界面',
                          icon: 'https://cdn.arthals.ink/Arthals-mcskin.png',
                          author: 'Arthals',
                          supportURL: 'https://github.com/zhuozhiyongde/Treehole-Art/issues',
                          updateURL: releaseUrl,
                          downloadURL: releaseUrl,
                          match: ['https://treehole.pku.edu.cn/web/*', 'https://treehole.pku.edu.cn/ch/*'],
                          'run-at': 'document-start',
                          grant: 'none',
                          noframes: true,
                          source: 'https://github.com/zhuozhiyongde/Treehole-Art',
                      },
                      build: {
                          fileName: enableCopy ? 'Treehole-Art-copy.user.js' : 'Treehole-Art.user.js',
                      },
                  }),
              ]
            : []),
    ],
    server: {
        host: '127.0.0.1',
        port: 5173,
    },
});
