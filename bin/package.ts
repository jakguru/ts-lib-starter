import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { getEntries } from "./utils";

const BASE_DIR = resolve(__dirname, "..");
const SRC_DIR = resolve(BASE_DIR, "src");
const packageJsonPath = resolve(BASE_DIR, "package.json");
const destPackageJsonPath = resolve(BASE_DIR, "dist/package.json");

readFile(packageJsonPath, "utf-8").then(async (packageJson) => {
  const parsedPackageJson = JSON.parse(packageJson);
  parsedPackageJson.type = "module";
  if (!parsedPackageJson.dependencies) {
    parsedPackageJson.dependencies = {};
  }
  delete parsedPackageJson.devDependencies;
  delete parsedPackageJson.scripts;
  const entries = await getEntries(SRC_DIR, parsedPackageJson.name);
  if (!("index" in entries)) {
    throw new Error("You cannot package a library without an index entry");
  }
  const exportKeys = Object.keys(entries);
  parsedPackageJson.module = "./index.mjs";
  parsedPackageJson.main = "./index.cjs";
  const exports: Record<
    string,
    { import: string; require: string; types: string }
  > = {
    ".": {
      import: "./index.mjs",
      require: "./index.cjs",
      types: "./index.d.ts",
    },
  };
  exportKeys.forEach((key) => {
    if (key === "index") return;
    const exportKey = `./${key}`;
    exports[exportKey] = {
      import: `./${key}.mjs`,
      require: `./${key}.cjs`,
      types: `./${key}.d.ts`,
    };
  });
  parsedPackageJson.exports = exports;
  delete parsedPackageJson.files;
  await writeFile(
    destPackageJsonPath,
    JSON.stringify(parsedPackageJson, null, 2),
  );
});
