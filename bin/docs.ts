// import { execa } from "execa";
import { resolve } from "path";
import { readFile } from "fs/promises";
import { makeApiDocs } from "./utils/";
import type { Subprocess } from "execa";

const cwd = resolve(__dirname, "..");
const nodemon = require("nodemon");
const color = require("cli-color");

const packageJsonPath = resolve(cwd, "package.json");

const nodemonConfig = {
  watch: ["src/**/*", "package.json", "vite.config.mts", "tsconfig.json"],
  ext: "ts,json,env,scss,vue,md,yml",
  ignore: ["node_modules"],
  exec: "npx jiti bin/noop.ts",
  delay: "2500",
};

let subprocess: Subprocess | undefined;
let abortController: AbortController | undefined;

const cleanup = async () => {
  if (subprocess) {
    await subprocess.kill();
  }
  if (abortController) {
    abortController.abort();
  }
};

process
  .on("unhandledRejection", (reason, p) => {
    console.error(reason, "Unhandled Rejection at Promise", p);
  })
  .on("uncaughtException", (err) => {
    console.error(err.stack);
    cleanup().finally(() => process.exit(1));
  })
  .on("SIGINT", () => {
    cleanup().finally(() => process.exit(255));
  })
  .on("SIGTERM", () => {
    cleanup().finally(() => process.exit(255));
  });

nodemon(nodemonConfig);
let timeout: NodeJS.Timeout | undefined;

readFile(packageJsonPath, "utf-8")
  .then(async (packageJson) => {
    const parsedPackageJson = JSON.parse(packageJson);
    nodemon
      .on("start", function () {
        console.log(color.green("Documentation Process has started"));
        makeApiDocs(cwd, parsedPackageJson.name);
        // if (abortController) {
        //   abortController.abort();
        // }
        // if (subprocess) {
        //   subprocess.kill();
        // }
        // abortController = new AbortController();
        // subprocess = execa("npm", ["run", "docs:dev"], {
        //   cwd,
        //   cancelSignal: abortController.signal,
        //   stdio: "inherit",
        //   reject: false,
        // });
      })
      .on("quit", function () {
        console.log(color.red("Documentation Process has quit"));
        process.exit();
      })
      .on("restart", function (files: string[]) {
        console.log("App restarted due to: ", files);
        clearTimeout(timeout);
        timeout = setTimeout(
          () => makeApiDocs(cwd, parsedPackageJson.name),
          1000,
        );
      });
  })
  .catch((err) => console.warn(color.red(err.message)));
