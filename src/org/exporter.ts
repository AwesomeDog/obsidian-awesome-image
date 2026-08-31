import {Modal, Notice, Setting, TFile, TFolder, type App, type TAbstractFile, type TextComponent} from "obsidian";
import type ImageToolkitPlugin from "../main";
import {TIMEOUT_LIKE_INFINITY} from "./constants";
import {isLocalImage, pathBasename, pathDirname, pathJoin} from "./utils";

const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))/g;
const WIKILINK_IMAGE_PATTERN = /!\[\[([^\]]+)\]\]/g;

interface ImageExportFailure {
  notePath: string;
  link: string;
  reason: string;
}

interface ImageExportResult {
  notesCopied: number;
  notesSkipped: number;
  imagesCopied: number;
  imagesSkipped: number;
  failures: ImageExportFailure[];
}

interface ReferencedImages {
  files: TFile[];
  failures: ImageExportFailure[];
}

type CopyStatus = "copied" | "skipped";

/**
 * Add an export action to the file explorer's context menu target.
 * The source vault is only read; all output is written below the requested root.
 */
export async function exportSelection(plugin: ImageToolkitPlugin, target: TAbstractFile): Promise<void> {
  if (!isSupportedTarget(target)) return;

  const input = await requestExportRoot(plugin.app);
  if (input === null) return;

  let exportRoot: string;
  try {
    exportRoot = validateExportRoot(plugin.app, input, target);
  } catch (error) {
    new Notice(`Export cancelled: ${errorMessage(error)}`);
    return;
  }

  const targetFolderPath = target instanceof TFolder ? normalizeVaultPath(target.path) : "";
  const scanExclusions = target instanceof TFolder && !targetFolderPath
    ? [...plugin.settings.excludedFolders, exportRoot]
    : plugin.settings.excludedFolders;
  const notes = collectMarkdownFiles(target, scanExclusions);
  if (!notes.length) {
    new Notice("No Markdown notes were found in the selected item.");
    return;
  }

  let referenced: ReferencedImages;
  try {
    referenced = await collectReferencedImageFiles(plugin.app, notes, plugin.settings.excludedFolders);
  } catch (error) {
    console.error("[Awesome Image] Failed to inspect image references", error);
    new Notice(`Export failed: ${errorMessage(error)}`);
    return;
  }

  const scope = target instanceof TFolder ? `folder "${targetFolderPath || "vault root"}"` : `note "${target.path}"`;
  const unresolvedText = referenced.failures.length
    ? ` ${referenced.failures.length} local image reference(s) could not be resolved and will be skipped.`
    : "";
  if (!window.confirm(
    `Copy ${notes.length} note(s) and ${referenced.files.length} referenced image(s) from ${scope} ` +
    `to "${exportRoot}"? Original files and links will not be modified.${unresolvedText}`,
  )) return;

  const progress = new Notice(
    `Exporting ${notes.length} note(s) and ${referenced.files.length} image(s)...`,
    TIMEOUT_LIKE_INFINITY,
  );
  let result: ImageExportResult;
  plugin.exportRootInProgress = exportRoot;
  try {
    result = await copyExportFiles(plugin.app, exportRoot, notes, referenced);
  } catch (error) {
    progress.hide();
    console.error("[Awesome Image] Export failed", error);
    new Notice(`Export failed: ${errorMessage(error)}`);
    return;
  } finally {
    plugin.exportRootInProgress = null;
  }
  progress.hide();

  const skipped = result.notesSkipped + result.imagesSkipped;
  const summary = [
    `Exported ${result.notesCopied} note(s) and ${result.imagesCopied} image(s) to "${exportRoot}".`,
    skipped ? `${skipped} existing file(s) skipped.` : "",
    result.failures.length ? `${result.failures.length} item(s) could not be exported.` : "",
  ].filter(Boolean).join(" ");
  new Notice(summary);
  if (result.failures.length) {
    console.warn("[Awesome Image] Export details", result.failures);
  }
}

function requestExportRoot(app: App): Promise<string | null> {
  return new Promise((resolve) => new ExportRootModal(app, resolve).open());
}

class ExportRootModal extends Modal {
  private settled = false;

  constructor(app: App, private readonly resolveValue: (value: string | null) => void) {
    super(app);
  }

  override onOpen(): void {
    const {contentEl} = this;
    contentEl.empty();
    this.setTitle("Export notes with referenced images");
    contentEl.createEl("p", {text: "Enter a vault-relative destination folder."});

    let input: TextComponent | null = null;
    new Setting(contentEl)
      .setName("Destination folder")
      .addText((text) => {
        input = text;
        text.setPlaceholder("Exports").setValue("Exports");
        text.inputEl.addEventListener("keydown", (event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          this.finish(input?.getValue() ?? "");
        });
      });

    new Setting(contentEl)
      .addButton((button) => button
        .setButtonText("Export")
        .setCta()
        .onClick(() => this.finish(input?.getValue() ?? "")))
      .addButton((button) => button
        .setButtonText("Cancel")
        .onClick(() => this.finish(null)));

    window.setTimeout(() => {
      input?.inputEl.focus();
      input?.inputEl.select();
    }, 0);
  }

  override onClose(): void {
    this.finish(null);
    this.contentEl.empty();
  }

  private finish(value: string | null): void {
    if (this.settled) return;
    this.settled = true;
    this.resolveValue(value);
    this.close();
  }
}

/** Return Markdown files below a file or folder, in stable path order. */
function collectMarkdownFiles(target: TAbstractFile, excludedFolders: string[] = []): TFile[] {
  const files: TFile[] = [];
  const visit = (entry: TAbstractFile): void => {
    if (isExcludedPath(entry.path, excludedFolders)) return;
    if (entry instanceof TFile) {
      if (entry.extension.toLowerCase() === "md") files.push(entry);
      return;
    }
    if (entry instanceof TFolder) entry.children.forEach(visit);
  };

  visit(target);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function collectReferencedImageFiles(
  app: App,
  notes: TFile[],
  excludedFolders: string[] = [],
): Promise<ReferencedImages> {
  const filesByPath = new Map<string, TFile>();
  const failures: ImageExportFailure[] = [];
  const failureKeys = new Set<string>();

  for (const note of notes) {
    const references = await getImageReferences(app, note);
    for (const rawLink of references) {
      const link = normalizeReference(rawLink);
      if (!link || !isLocalImage(link)) continue;

      const image = resolveImage(app, link, note.path);
      if (!image || isExcludedPath(image.path, excludedFolders)) {
        const key = `${note.path}\u0000${link}`;
        if (!failureKeys.has(key)) {
          failureKeys.add(key);
          failures.push({
            notePath: note.path,
            link,
            reason: image ? "The image is inside an ignored folder." : "The local image could not be resolved.",
          });
        }
        continue;
      }
      filesByPath.set(image.path, image);
    }
  }

  return {
    files: [...filesByPath.values()].sort((left, right) => left.path.localeCompare(right.path)),
    failures,
  };
}

async function getImageReferences(app: App, note: TFile): Promise<string[]> {
  const references = new Set<string>();
  const add = (link: string | undefined): void => {
    if (!link) return;
    const key = link.trim();
    if (key) references.add(key);
  };

  const embeds = app.metadataCache.getFileCache(note)?.embeds ?? [];
  embeds.forEach((embed) => add(embed.link));
  // Merge a text fallback because the cache may lag for a newly-created or
  // just-imported note. This only reads the note and never rewrites it.
  const content = await app.vault.cachedRead(note);
  for (const match of content.matchAll(MARKDOWN_IMAGE_PATTERN)) {
    add(match[1] ?? match[2]);
  }
  for (const match of content.matchAll(WIKILINK_IMAGE_PATTERN)) {
    add(match[1]);
  }
  return [...references];
}

function resolveImage(app: App, link: string, notePath: string): TFile | null {
  if (!link || !isLocalImage(link)) return null;

  const candidates = [
    link,
    pathJoin(pathDirname(notePath), link),
  ];
  for (const candidate of candidates) {
    if (!isSafeVaultPath(candidate)) continue;
    try {
      const linked = app.metadataCache.getFirstLinkpathDest(candidate, notePath);
      if (linked && isLocalImage(linked.path)) return linked;
    } catch {
      // Continue with exact path lookup for older or incomplete metadata caches.
    }
    try {
      const exact = app.vault.getAbstractFileByPath(normalizeVaultPath(candidate));
      if (exact instanceof TFile && isLocalImage(exact.path)) return exact;
    } catch {
      // A malformed link should be reported as unresolved below.
    }
  }

  // Obsidian normally resolves a bare basename through metadata. This fallback
  // is deliberately limited to a unique match so an ambiguous link is never
  // copied from the wrong folder.
  const basename = pathBasename(link);
  const matches = app.vault.getFiles().filter((file) =>
    isLocalImage(file.path) && pathBasename(file.path) === basename);
  return matches.length === 1 ? matches[0] : null;
}

async function copyExportFiles(
  app: App,
  exportRoot: string,
  notes: TFile[],
  referenced: ReferencedImages,
): Promise<ImageExportResult> {
  const result: ImageExportResult = {
    notesCopied: 0,
    notesSkipped: 0,
    imagesCopied: 0,
    imagesSkipped: 0,
    failures: [...referenced.failures],
  };

  await ensureFolderTree(app, exportRoot);
  for (const note of notes) {
    try {
      const status = await copyFileToExport(app, note, exportRoot);
      if (status === "copied") result.notesCopied++;
      else result.notesSkipped++;
    } catch (error) {
      result.failures.push({notePath: note.path, link: note.path, reason: errorMessage(error)});
    }
  }
  for (const image of referenced.files) {
    try {
      const status = await copyFileToExport(app, image, exportRoot);
      if (status === "copied") result.imagesCopied++;
      else result.imagesSkipped++;
    } catch (error) {
      result.failures.push({notePath: image.path, link: image.path, reason: errorMessage(error)});
    }
  }
  return result;
}

async function copyFileToExport(app: App, source: TFile, exportRoot: string): Promise<CopyStatus> {
  const destination = pathJoin(exportRoot, source.path);
  const existing = app.vault.getAbstractFileByPath(destination);
  if (existing) {
    if (!(existing instanceof TFile)) throw new Error(`Destination is a folder: ${destination}`);
    return "skipped";
  }

  await ensureFolderTree(app, pathDirname(destination));
  if (source.extension.toLowerCase() === "md") {
    await app.vault.create(destination, await app.vault.read(source));
  } else {
    await app.vault.createBinary(destination, await app.vault.readBinary(source));
  }
  return "copied";
}

async function ensureFolderTree(app: App, folderPath: string): Promise<void> {
  const normalized = normalizeVaultPath(folderPath);
  if (!normalized || normalized === ".") return;

  let current = "";
  for (const part of normalized.split("/")) {
    current = current ? `${current}/${part}` : part;
    const existing = app.vault.getAbstractFileByPath(current);
    if (existing) {
      if (!(existing instanceof TFolder)) throw new Error(`Destination is a file: ${current}`);
      continue;
    }
    await app.vault.createFolder(current);
  }
}

function validateExportRoot(app: App, input: string, target: TAbstractFile): string {
  const raw = input.trim().replace(/\\/g, "/");
  if (!raw || raw.startsWith("/") || /^[A-Za-z]:($|\/)/.test(raw)) {
    throw new Error("enter a non-empty vault-relative folder path");
  }
  const normalized = raw.replace(/\/+$/, "");
  const parts = normalized.split("/");
  if (!normalized || parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error("the export path cannot contain . or .. segments");
  }
  if (isExcludedPath(normalized, [app.vault.configDir])) {
    throw new Error("the export path cannot be inside Obsidian's configuration folder");
  }
  const targetFolderPath = target instanceof TFolder ? normalizeVaultPath(target.path) : "";
  if (targetFolderPath && isExcludedPath(normalized, [targetFolderPath])) {
    throw new Error("the export path cannot be the selected folder or one of its children");
  }
  const existing = app.vault.getAbstractFileByPath(normalized);
  if (existing && !(existing instanceof TFolder)) throw new Error(`destination is a file: ${normalized}`);
  return normalized;
}

function isSupportedTarget(target: TAbstractFile): target is TFile | TFolder {
  return target instanceof TFolder || (target instanceof TFile && target.extension.toLowerCase() === "md");
}

function normalizeReference(value: string): string {
  let link = value.trim();
  if (link.startsWith("<") && link.endsWith(">")) link = link.slice(1, -1).trim();
  const pipe = link.indexOf("|");
  if (pipe >= 0) link = link.slice(0, pipe).trim();
  const hash = link.indexOf("#");
  if (hash >= 0) link = link.slice(0, hash).trim();
  const query = link.indexOf("?");
  if (query >= 0) link = link.slice(0, query).trim();
  return decodePath(link).replace(/\\/g, "/").replace(/^\/+/, "");
}

function decodePath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeVaultPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function isSafeVaultPath(value: string): boolean {
  return !value.split("/").some((part) => part === "..");
}

function isExcludedPath(filePath: string, excludedFolders: string[]): boolean {
  const path = normalizeVaultPath(filePath);
  return excludedFolders.some((folder) => {
    const normalizedFolder = normalizeVaultPath(folder);
    return normalizedFolder && (path === normalizedFolder || path.startsWith(`${normalizedFolder}/`));
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
