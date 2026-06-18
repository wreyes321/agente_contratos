// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  build: {
    outDir: "build",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("react-dom") || id.includes("react-router-dom") || id.includes("/react/")) {
            return "react-vendor"
          }
          if (id.includes("@radix-ui")) {
            return "ui-vendor"
          }
          if (id.includes("react-oidc-context") || id.includes("aws-amplify")) {
            return "auth-vendor"
          }
        },
      },
    },
  },

  server: {
    port: 3000,
    open: true,
  },
})
