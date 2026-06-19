import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "~util": path.resolve(__dirname, "src/util"),
    },
  },
});
