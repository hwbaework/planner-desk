import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  // 5173은 다른 프로젝트, 5180은 on-track이 쓰고 있어서 고정 포트 사용
  server: { port: 5181 },
});
