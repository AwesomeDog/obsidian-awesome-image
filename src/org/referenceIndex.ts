import {App, CachedMetadata, type Pos, TFile} from "obsidian";
import {extractCanvasReferences, resolveCanvasImagePaths} from "./canvas";
import {isLocalImage, pathBasename} from "./utils";

/** How a note or canvas points at an image. */
export type ReferenceKind = "embed" | "link" | "reference" | "frontmatter" | "canvas";

export interface ImageReference {
  /** Vault path of the note or canvas holding the reference. */
  sourcePath: string;
  kind: ReferenceKind;
  /** Zero-based line of the link, when the source is a Markdown note. */
  line?: number;
  /** Zero-based column of the link, when the source is a Markdown note. */
  col?: number;
  /** Frontmatter key, for `kind: "frontmatter"`. */
  frontmatterKey?: string;
}

export interface ReferenceIndexStats {
  /** Notes and canvases that link to at least one image. */
  sources: number;
  /** Images that are linked at least once. */
  images: number;
  /** Total recorded references. */
  references: number;
}

const CANVAS_EXTENSION = "canvas";
const SLICE_ROWS = 50;
const SLICE_MS = 8;

/**
 * A read-only snapshot of "which note or canvas points at which image".
 *
 * Obsidian only exposes the forward link graph (`resolvedLinks`), so deciding
 * whether an image is referenced means reversing it. The snapshot is built on
 * demand and thrown away afterwards: it is never kept in memory between runs
 * and it never listens to vault or metadata events.
 */
export class ImageReferenceIndex {
  constructor(private readonly byTarget: Map<string, ImageReference[]>) {}

  /** References pointing at `targetPath`, sorted by source path then line. */
  getReferences(targetPath: string): ImageReference[] {
    const references = [...(this.byTarget.get(targetPath) ?? [])];
    return references.sort((left, right) =>
      left.sourcePath.localeCompare(right.sourcePath) || (left.line ?? -1) - (right.line ?? -1));
  }

  countReferences(targetPath: string): number {
    return this.byTarget.get(targetPath)?.length ?? 0;
  }

  isReferenced(targetPath: string): boolean {
    return this.byTarget.has(targetPath);
  }

  getStats(): ReferenceIndexStats {
    let references = 0;
    let sources = 0;
    for (const list of this.byTarget.values()) {
      references += list.length;
      sources += new Set(list.map(({sourcePath}) => sourcePath)).size;
    }
    return {sources, images: this.byTarget.size, references};
  }

  describe(): string {
    const {sources, images, references} = this.getStats();
    return `Reference index: ${references} reference(s) from ${sources} note(s) or canvas(es) to ${images} image(s).`;
  }
}

/**
 * Reverses the vault link graph for images. Call this only when a command needs
 * it; the result is a plain snapshot with no listeners attached.
 */
export async function buildImageReferenceIndex(app: App): Promise<ImageReferenceIndex> {
  const byTarget = new Map<string, ImageReference[]>();
  const push = (target: string, reference: ImageReference): void => {
    const list = byTarget.get(target);
    if (list) list.push(reference);
    else byTarget.set(target, [reference]);
  };

  const sources = Object.keys(app.metadataCache.resolvedLinks);
  let sliceStart = Date.now();
  for (let index = 0; index < sources.length; index += 1) {
    const sourcePath = sources[index];
    const file = app.vault.getAbstractFileByPath(sourcePath);
    if (file instanceof TFile) {
      const cache = app.metadataCache.getFileCache(file);
      const destinations = app.metadataCache.resolvedLinks[sourcePath] ?? {};
      collectNote(app, file, cache, destinations, push);
    }
    if ((index + 1) % SLICE_ROWS === 0 && Date.now() - sliceStart > SLICE_MS) {
      await yieldToEventLoop();
      sliceStart = Date.now();
    }
  }

  for (const file of app.vault.getFiles()) {
    if (file.extension.toLowerCase() !== CANVAS_EXTENSION) continue;
    await collectCanvas(app, file, push);
  }

  return new ImageReferenceIndex(byTarget);
}

/** Resolves every link of one note into image references. */
function collectNote(
  app: App, source: TFile, cache: CachedMetadata | null,
  destinations: Record<string, number>, push: (target: string, reference: ImageReference) => void,
): void {
  const resolved = new Set<string>();
  const seen = new Set<string>();

  const add = (link: string, kind: ReferenceKind, position?: Pos, frontmatterKey?: string): void => {
    const target = resolveImage(app, source.path, link);
    if (!target) return;
    const line = position?.start.line;
    const col = position?.start.col;
    const key = `${target}|${kind}|${line ?? ""}|${col ?? ""}|${frontmatterKey ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    resolved.add(target);
    const reference: ImageReference = {sourcePath: source.path, kind};
    if (line !== undefined) reference.line = line;
    if (col !== undefined) reference.col = col;
    if (frontmatterKey) reference.frontmatterKey = frontmatterKey;
    push(target, reference);
  };

  for (const embed of cache?.embeds ?? []) add(embed.link, "embed", embed.position);
  for (const link of cache?.links ?? []) add(link.link, "link", link.position);
  for (const link of cache?.referenceLinks ?? []) add(link.link, "reference", link.position);
  for (const link of cache?.frontmatterLinks ?? []) add(link.link, "frontmatter", undefined, link.key);

  // `resolvedLinks` is Obsidian's own count of outgoing links. Fall back to it
  // for link forms the cache arrays above do not expose, so an image is never
  // reported as unused just because we failed to classify the link.
  for (const target of Object.keys(destinations)) {
    if (destinations[target] > 0 && !resolved.has(target) && isLocalImage(target)) {
      push(target, {sourcePath: source.path, kind: "link"});
    }
  }
}

async function collectCanvas(
  app: App, file: TFile, push: (target: string, reference: ImageReference) => void,
): Promise<void> {
  let data: unknown;
  try {
    data = JSON.parse(await app.vault.cachedRead(file)) as unknown;
  } catch (error) {
    console.warn("Awesome Image: failed to read canvas " + file.path, error);
    return;
  }
  for (const reference of extractCanvasReferences(data)) {
    for (const path of resolveCanvasImagePaths(app, reference)) {
      push(path, {sourcePath: file.path, kind: "canvas"});
    }
  }
}

function resolveImage(app: App, sourcePath: string, link: string): string | null {
  const raw = link.split("#")[0].split("|")[0].trim();
  for (const candidate of [raw, decodePath(raw)]) {
    if (!candidate) continue;
    const target = app.metadataCache.getFirstLinkpathDest(candidate, sourcePath);
    if (target && isLocalImage(target.path)) return target.path;
  }
  return null;
}

/**
 * Basenames of every path Obsidian resolved a link to. Used as a last-resort
 * check so an image is not reported as unused while some link resolves to a
 * same-named file elsewhere in the vault.
 */
export function collectResolvedBasenames(app: App): Set<string> {
  const basenames = new Set<string>();
  for (const targets of Object.values(app.metadataCache.resolvedLinks)) {
    for (const target of Object.keys(targets)) basenames.add(pathBasename(target));
  }
  return basenames;
}

function decodePath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}
