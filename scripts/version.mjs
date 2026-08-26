import {execFileSync} from "node:child_process";
import {readFile, writeFile} from "node:fs/promises";

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const writeJson = (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`);

const [packageJson, manifest, versions] = await Promise.all([
  readJson("package.json"),
  readJson("manifest.json"),
  readJson("versions.json"),
]);
const version = process.env.npm_package_version ?? packageJson.version;

manifest.version = version;
versions[version] = manifest.minAppVersion;
await Promise.all([
  writeJson("manifest.json", manifest),
  writeJson("versions.json", versions),
]);
execFileSync("git", ["add", "manifest.json", "versions.json"]);
