import { join } from "path";
import { readFile, readdir } from "fs/promises";

export const getEntries = async (SRC_DIR: string, LIB_NAME: string) => {
  const regex = /@module\s+(@?[\w\/.-]+)/gm;
  const entries: Record<string, string> = {};
  const filesInSrc = await readdir(SRC_DIR, {
    withFileTypes: true,
    recursive: true,
  });
  await Promise.all(
    filesInSrc.map(async (file) => {
      if (!file.isFile()) {
        return;
      }
      if (!file.name.endsWith(".ts")) {
        return;
      }
      const absPath = join(file.parentPath, file.name);
      const content = await readFile(absPath, "utf-8");
      let m;
      while ((m = regex.exec(content)) !== null) {
        if (m.index === regex.lastIndex) {
          regex.lastIndex++;
        }
        m.forEach((match, gi) => {
          if (gi === 1) {
            const libMod = match.replace(LIB_NAME, "");
            let key = libMod.length === 0 ? "index" : libMod;
            while (key.startsWith("/")) {
              key = key.slice(1);
            }
            if (entries[key]) {
              throw new Error(`Duplicate entry: ${key}`);
            }
            entries[key] = absPath;
          }
        });
      }
    }),
  );
  return entries;
};
