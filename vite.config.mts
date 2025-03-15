import { defineConfig } from "vite";
import { resolve } from "path";
import { readFile } from "fs/promises";
import { getEntries } from "./bin/utils";
import type { UserConfig } from "vite";

const LIB_NAME = "@example/lib";
const BASE_DIR = resolve(__dirname);
const SRC_DIR = resolve(BASE_DIR, "src");
const externals = new Set<string>([
  "node:util",
  "node:path",
  "node:url",
  "node:fs",
  "node:fs/promises",
]);
const nonExternal = new Set<string>([]);

export default defineConfig(async () => {
  const entries = await getEntries(SRC_DIR, LIB_NAME);
  const rawPackageJson = await readFile(
    resolve(BASE_DIR, "package.json"),
    "utf-8",
  );
  const packageJson = JSON.parse(rawPackageJson.toString());
  if (packageJson.dependencies) {
    Object.keys(packageJson.dependencies).forEach((dep) => {
      externals.add(dep);
    });
  }
  const external = Array.from(externals).filter((ext) => !nonExternal.has(ext));
  return {
    plugins: [],
    build: {
      sourcemap: true,
      minify: true,
      lib: {
        entry: {
          ...entries,
        },
        name: LIB_NAME,
        formats: ["es", "cjs"],
        fileName: (format: string, entry: string) => {
          switch (format) {
            case "es":
              return `${entry}.mjs`;
            case "cjs":
              return `${entry}.cjs`;
            default:
              return `${entry}.${format}.js`;
          }
        },
      },
      rollupOptions: {
        external,
        output: {
          exports: "named",
        },
        treeshake: "safest",
      },
      emptyOutDir: false,
    },
    define: {},
  } as UserConfig;
});
