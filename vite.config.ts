import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import monkey from "vite-plugin-monkey";

const isUserscript = process.env.TREEHOLE_ART === "1";

export default defineConfig({
  plugins: [
    react(),
    ...(isUserscript
      ? [
          monkey({
            entry: "src/main.tsx",
            userscript: {
              name: "Treehole-Art",
              namespace: "https://treehole.pku.edu.cn/",
              version: "0.1.0",
              description: "为北大树洞打造的现代化第三方界面",
              icon: "http://cdn.arthals.ink/Arthals-mcskin.png",
              match: [
                "https://treehole.pku.edu.cn/web/*",
                "https://treehole.pku.edu.cn/ch/*",
              ],
              "run-at": "document-start",
              grant: "none",
              noframes: true,
            },
            build: {
              fileName: "Treehole-Art.user.js",
            },
          }),
        ]
      : []),
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});
