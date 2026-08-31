import type {App} from "obsidian";
import {isLocalImage, isUrl, pathBasename} from "./utils";

type JsonObject = Record<string, unknown>;

/**
 * Extract vault file paths from the Canvas node types that can contain image
 * files. Canvas file paths are stored relative to the vault root.
 */
export function extractCanvasReferences(data: unknown): string[] {
  if (!isJsonObject(data) || !Array.isArray(data.nodes)) return [];

  const references = new Set<string>();
  for (const node of data.nodes) {
    if (!isJsonObject(node)) continue;
    if (node.type === "file" && typeof node.file === "string") references.add(node.file);
    if (node.type === "group" && typeof node.background === "string") references.add(node.background);
  }
  return [...references];
}

/**
 * Resolve a Canvas vault path without treating it as relative to the Canvas
 * directory. A bare filename is accepted only when it identifies one image.
 */
export function resolveCanvasImagePaths(app: App, reference: string): string[] {
  const rawReference = cleanReference(reference);
  if (!rawReference) return [];

  const candidates = [rawReference];
  const decodedReference = decodePath(rawReference);
  if (decodedReference !== rawReference) candidates.push(decodedReference);

  for (const candidate of candidates) {
    if (isUrl(candidate)) continue;
    try {
      const target = app.vault.getAbstractFileByPath(normalizeVaultPath(candidate));
      if (target && isLocalImage(target.path)) return [target.path];
    } catch {
      // Fall back to scanning vault files below when path lookup is unavailable.
    }
  }

  const files = app.vault.getFiles();
  for (const candidate of candidates) {
    if (isUrl(candidate)) continue;
    const normalizedCandidate = normalizeVaultPath(candidate);
    for (const file of files) {
      if (isLocalImage(file.path) && normalizeVaultPath(file.path) === normalizedCandidate) {
        return [file.path];
      }
    }
  }

  const bareCandidates = candidates.filter((candidate) =>
    !candidate.includes("/") && isLocalImage(candidate));
  if (!bareCandidates.length) return [];

  const basenames = new Set(bareCandidates.map(pathBasename));
  const basenameMatches = files.filter((file) =>
    isLocalImage(file.path) && basenames.has(pathBasename(file.path)));
  return basenameMatches.length === 1 ? [basenameMatches[0].path] : [];
}

function cleanReference(reference: string): string {
  return reference.trim().replace(/\\/g, "/");
}

function decodePath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function normalizeVaultPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
