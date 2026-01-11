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

  build: {
    rollupOptions: {
      input: {
        login: path.resolve(__dirname, "login.html"),
        app: path.resolve(__dirname, "app.html"),
      },
    },
  },

  server: {
  open: "/login.html",
},

});

