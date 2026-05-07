import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    /** Popup + PDF pipeline exceed 500 kB minified; raising avoids noisy warnings on every build. */
    chunkSizeWarningLimit: 2200,
    rollupOptions: {
      input: {
        popup: "index.html",
        background: "src/extension/background/background.ts",
        floatingWidget: "src/extension/content/floatingWidget.ts",
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "background") {
            return "assets/background.js";
          }

          if (chunkInfo.name === "floatingWidget") {
            return "assets/floatingWidget.js";
          }

          return "assets/[name]-[hash].js";
        },
      },
    },
  },
});
