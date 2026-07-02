import { defineConfig, loadEnv } from "vite";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:8080";

  return {
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
        input: { //so app recognizes multiple html entry points
          login: path.resolve(__dirname, "login.html"),
          app: path.resolve(__dirname, "app.html"),
          register: path.resolve(__dirname, "register.html"),
          changePassword: path.resolve(__dirname, "change-password.html"),
        },
      },
    },

    server: {
      open: "/login.html",
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
