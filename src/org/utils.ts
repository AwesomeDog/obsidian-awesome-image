import {fileTypeFromBuffer} from "file-type";
import isSvg from "is-svg";
import {App, requestUrl} from "obsidian";
import {FORBIDDEN_SYMBOLS_FILENAME_PATTERN, IMAGE_EXTS_LOWER} from "./constants";
import filenamify from "filenamify";

export async function replaceAsync(
  value: string,
  pattern: RegExp,
  replacer: (match: string, ...args: string[]) => Promise<string>,
): Promise<string> {
  const replacements: Promise<string>[] = [];
  value.replace(pattern, (match, ...args) => {
    replacements.push(replacer(match, ...args));
    return match;
  });
  const resolved = await Promise.all(replacements);
  return value.replace(pattern, () => resolved.shift() as string);
}

export function isUrl(link: string): boolean {
    if (link.startsWith("data:image")) return false;
    try {
        new URL(link);
        return true;
    } catch {
        return false;
    }
}

export function isLocalImage(filePath: string): boolean {
    return !isUrl(filePath) && IMAGE_EXTS_LOWER.some((ext) =>
        filePath.toLowerCase().endsWith(`.${ext}`));
}

export async function downloadImage(url: string): Promise<ArrayBuffer> {
    return (await requestUrl({url, throw: true})).arrayBuffer;
}

export async function fileExtByContent(content: ArrayBuffer): Promise<string | undefined> {
    const extension = (await fileTypeFromBuffer(content))?.ext;
    return extension === "xml" && isSvg(new TextDecoder().decode(content)) ? "svg" : extension;
}

export function cleanFileName(name: string): string {
    return filenamify(name).replace(FORBIDDEN_SYMBOLS_FILENAME_PATTERN, "_");
}

export function pathJoin(dir: string, subpath: string): string {
    const joined = [dir, subpath].filter(Boolean).join("/").replace(/\\/g, "/");
    const absolute = joined.startsWith("/");
    const parts: string[] = [];
    for (const part of joined.split("/")) {
        if (!part || part === ".") continue;
        if (part === ".." && parts.length && parts.at(-1) !== "..") parts.pop();
        else if (part !== ".." || !absolute) parts.push(part);
    }
    return (absolute ? "/" : "") + parts.join("/") || ".";
}

export function pathDirname(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized) return /[\\/]/.test(filePath) ? "/" : ".";
  const separator = normalized.lastIndexOf("/");
  return separator < 0 ? "." : normalized.slice(0, separator) || "/";
}

export function resolveMediaRootDirectory(mediaRootDirectory: string, notePath: string): string {
  return mediaRootDirectory.replaceAll("{{NOTE_FOLDER}}", () => pathDirname(notePath));
}

export function pathBasename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/").replace(/\/+$/, "");
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

export async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
    try {
        await app.vault.createFolder(folderPath);
    } catch (error) {
        if (!String((error as {message?: unknown})?.message ?? error).includes("Folder already exists")) throw error;
    }
}

export async function genSha256(data: ArrayBuffer): Promise<string> {
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getLinkFullPath(app: App, link: string): string | null {
    for (const noteLinks of Object.values(app.metadataCache.resolvedLinks)) {
        const match = Object.keys(noteLinks).find((candidate) =>
            pathBasename(candidate) === pathBasename(link) && candidate.includes(link));
        if (match) return match;
    }
    return null;
}

export function arraybufferEqual(buf1: ArrayBuffer | null, buf2: ArrayBuffer | null): boolean {
    if (!buf1 || !buf2) return buf1 === buf2;
    if (buf1.byteLength !== buf2.byteLength) return false;
    const dv1 = new Int8Array(buf1);
    const dv2 = new Int8Array(buf2);
    return dv1.every((value, index) => value === dv2[index]);
}
