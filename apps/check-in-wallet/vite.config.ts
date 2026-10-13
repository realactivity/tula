import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the same build works on GitHub Pages subpaths
  // and on a custom domain.
  base: "./",
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        demo: resolve(__dirname, "demo.html"),
      },
    },
  },
});
