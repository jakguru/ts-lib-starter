import { resolve, join } from "path";
import { input, confirm } from "@inquirer/prompts";
import { readFile, writeFile, readdir } from "fs/promises";
import { randomUUID } from "node:crypto";

const cwd = resolve(__dirname, "..");
const color = require("cli-color");

const processAbortController = new AbortController();

const cleanup = async () => {
  await new Promise((resolve) => {
    processAbortController.signal.addEventListener("abort", () => {
      console.log(color.red("Process aborted"));
      resolve(void 0);
    });
  });
};

const end = () => {
  processAbortController.abort();
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

const getCustomizedAttributes = async (name: string, description: string) => {
  const customName = await input({
    message: "Enter an updated name for the library, including the namespace",
    default: name,
    required: true,
    validate: (input) => {
      if (!input) return "Please enter a name";
      if (input === name) return true;
      const regexed =
        /^(?:@[a-z0-9~][a-z0-9-._~]*\/)?[a-z0-9~][a-z0-9-._~]*$/g.test(input);
      if (!regexed) return "Please enter an NPM-compliant name";
      return input.length < 214 ? true : "Name is too long";
    },
  });
  const customDescription = await input({
    message: "Enter an updated short description for the library",
    default: description,
    required: true,
    validate: (input) => {
      if (!input) return "Please enter a description";
      return true;
    },
  });
  return { customName, customDescription };
};

const getUpdatedContent = (source: string, from: string, to: string) => {
  const placeholder = randomUUID();
  let updated = source;
  let stillHasFrom = updated.includes(from);
  while (stillHasFrom) {
    updated = updated.replace(from, placeholder);
    stillHasFrom = updated.includes(from);
  }
  let stillHasPlaceholder = updated.includes(placeholder);
  while (stillHasPlaceholder) {
    updated = updated.replace(placeholder, to);
    stillHasPlaceholder = updated.includes(placeholder);
  }
  return updated;
};

const packagePath = join(cwd, "package.json");
readFile(packagePath, "utf-8")
  .then(async (raw) => {
    const pkg = JSON.parse(raw);
    const { name, description } = pkg;
    console.log(
      color.yellow(
        "Please wait while the index of files which will need to be customized is built...",
      ),
    );
    const index: Set<string> = new Set();
    const rootFiles = await readdir(cwd, {
      withFileTypes: true,
    });
    const rootsToIgnore = ["dist", "node_modules", "bin"];
    const ignoredPaths = [
      "/docs/.vitepress/dist",
      "/docs/.vitepress/cache",
      "/docs/api",
    ];
    for (const dirent of rootFiles) {
      if (rootsToIgnore.includes(dirent.name)) {
        continue;
      }
      if (dirent.isDirectory()) {
        // get all of the files in the directory and check them for the existance of either the name or the description.
        const dirFiles = await readdir(join(cwd, dirent.name), {
          withFileTypes: true,
          recursive: true,
        });
        for (const dirFile of dirFiles) {
          if (!dirFile.isFile()) {
            continue;
          }
          const dirFilePath = join(dirFile.parentPath, dirFile.name);
          const dirFileRelPath = dirFilePath.replace(cwd, "");
          if (ignoredPaths.some((path) => dirFileRelPath.includes(path))) {
            continue;
          }
          const contents = await readFile(dirFilePath, "utf-8");
          if (contents.includes(name) || contents.includes(description)) {
            index.add(dirFilePath);
          }
        }
      } else if (!dirent.isFile()) {
        continue;
      } else {
        const contents = await readFile(join(cwd, dirent.name), "utf-8");
        if (contents.includes(name) || contents.includes(description)) {
          index.add(join(dirent.parentPath, dirent.name));
        }
      }
    }
    console.log(color.green("Index built"));
    let approved = false;
    let customName: string | undefined;
    let customDescription: string | undefined;
    while (!approved) {
      const atts = await getCustomizedAttributes(name, description);
      console.log(
        color.yellow(
          "------------------------------------------------------------------",
        ),
      );
      console.log(
        color.yellow("Name:"),
        color.cyan(name),
        color.yellow("->"),
        color.cyan(atts.customName),
      );
      console.log(
        color.yellow("Description:"),
        color.cyan(description),
        color.yellow("->"),
        color.cyan(atts.customDescription),
      );
      console.log(
        color.yellow(
          "------------------------------------------------------------------",
        ),
      );
      approved = await confirm({
        message: "Do you want to apply these changes?",
        default: false,
      });
      if (approved) {
        customName = atts.customName;
        customDescription = atts.customDescription;
      }
    }
    const toCustomize = Array.from(index).filter(
      (f) => !f.endsWith("package.json"),
    );
    const updatedPackageJson = { ...pkg };
    updatedPackageJson.name = customName;
    updatedPackageJson.description = customDescription;
    console.log(color.yellow("Updating"), color.cyan("package.json"));
    await writeFile(
      packagePath,
      JSON.stringify(updatedPackageJson, null, 2),
      "utf-8",
    );
    console.log(color.green("Updated"), color.cyan("package.json"));
    for (const file of toCustomize) {
      console.log(color.yellow("Updating"), color.cyan(file));
      const original = await readFile(file, "utf-8");
      let updated = original;
      updated = getUpdatedContent(updated, name, customName!);
      updated = getUpdatedContent(updated, description, customDescription!);
      await writeFile(file, updated, "utf-8");
      console.log(color.green("Updated"), color.cyan(file));
    }
    console.log(
      color.yellow(
        "------------------------------------------------------------------",
      ),
    );
    console.log(color.green("All files have been updated"));
    console.log(
      color.yellow(
        "------------------------------------------------------------------",
      ),
    );
    end();
  })
  .catch((err) => {
    console.warn(color.red(err.message));
    end();
  });
