import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  css: {
    preprocessorOptions: {
      sass: {
        additionalData: `
          @use '${path.resolve(__dirname, "sass/base")}' as *;
        `,
      },
    },
  },

  build: {
    rollupOptions: {
      input: {
        login: path.resolve(__dirname, "login.html"),
        app: path.resolve(__dirname, "app.html"),
        changePassword: path.resolve(__dirname, "change-password.html"),
      },
    },
  },

  server: {
  open: "/login.html",
},

});

