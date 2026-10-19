import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// Frontend NexusAI — TanStack Start + React + Tailwind.
// Roda em http://localhost:3000 (bate com o CORS_ORIGIN do backend).
// Build gera .output/ via Nitro (preset node-server por padrão;
// defina NITRO_PRESET para outro alvo de deploy).
export default defineConfig({
  plugins: [
    tailwindcss(),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Usa src/server.ts como entry do servidor (wrapper de erro SSR).
      server: { entry: "server" },
    }),
    viteReact(),
    nitro(),
  ],
});
