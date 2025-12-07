import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  css: {
    preprocessorOptions: {
      sass: {
        additionalData: `
          @use '${path.resolve(__dirname, "sass/base")}' as *;
          @use '${path.resolve(__dirname, "sass/components")}' as *;
          @use '${path.resolve(__dirname, "sass/layout")}' as *;
        `,
      },
    },
  },
});
