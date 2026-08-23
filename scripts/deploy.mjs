import { access, copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const vault = process.argv[2] || process.env.OBSIDIAN_VAULT;

if (!vault) {
  console.error("Usage: npm run deploy -- <vault-path>");
  process.exitCode = 1;
} else {
  const root = process.cwd();
  const manifestPath = path.join(root, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const pluginId = manifest.id;

  if (!pluginId) {
    throw new Error("manifest.json must define a plugin id");
  }

  const target = path.join(
    path.resolve(vault),
    ".obsidian",
    "plugins",
    pluginId
  );
  const files = ["main.js", "manifest.json", "styles.css"];

  await Promise.all(files.map((file) => access(path.join(root, file))));
  await mkdir(target, { recursive: true });
  await Promise.all(
    files.map((file) =>
      copyFile(path.join(root, file), path.join(target, file))
    )
  );

  console.log(`Installed ${manifest.name || pluginId} in ${target}`);
}
