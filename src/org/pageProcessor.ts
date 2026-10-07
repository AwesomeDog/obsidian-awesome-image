import {App, Notice, TFile} from "obsidian";
import type ImageToolkitPlugin from "../main";
import {ImgSettingIto} from "../to/imgTo";
import {EXTERNAL_MEDIA_LINK_PATTERN, NOTICE_TIMEOUT, TIMEOUT_LIKE_INFINITY} from "./constants";
import {buildImageReferenceIndex, collectResolvedBasenames, type ImageReferenceIndex} from "./referenceIndex";
import {collectMarkdownNotes, isLocalImage, pathBasename, replaceAsync} from "./utils";
import {imageTagProcessor, type ImageProcessingFailure} from "./contentProcessor";

export async function processPage(
  plugin: ImageToolkitPlugin, file: TFile, silent = false,
): Promise<ImageProcessingFailure[]> {
  const extension = file.extension.toLowerCase();
  if (extension !== "md") {
    if (!silent && extension === "canvas") new Notice('Canvas file "' + file.path + '" was not processed.');
    return [];
  }

  const failures: ImageProcessingFailure[] = [];
  const settings: ImgSettingIto = plugin.settings;
  const content = await plugin.app.vault.cachedRead(file);
  const fixedContent = await replaceAsync(
    content, EXTERNAL_MEDIA_LINK_PATTERN,
    imageTagProcessor(plugin.app, settings.mediaRootDirectory, file.path, (failure) => failures.push(failure)),
  );
  const changed = content !== fixedContent;
  if (changed) await plugin.app.vault.modify(file, fixedContent);
  if (!silent) new Notice(
    'Page "' + file.path + '" has been processed, ' + (changed ? "and changed." : "but nothing was changed."),
  );
  return failures;
}

export interface OrphanImagesResult {
  orphans: TFile[];
  /** Snapshot used for this run only; discarded when the command returns. */
  index: ImageReferenceIndex;
}

/**
 * Lists images that nothing links to. The reference index is built here and
 * dropped afterwards — it is never cached and registers no listeners. It covers
 * Markdown embeds, links, reference links, frontmatter links and Canvas files,
 * and a basename pass over `resolvedLinks` is kept as a conservative fallback.
 */
export async function findOrphanImages(plugin: ImageToolkitPlugin): Promise<OrphanImagesResult> {
  const app = plugin.app;
  const index = await buildImageReferenceIndex(app);
  const linkedBasenames = collectResolvedBasenames(app);
  const orphans = app.vault.getFiles()
    .filter(({path}) => isLocalImage(path))
    .filter(({path}) => !index.isReferenced(path) && !linkedBasenames.has(pathBasename(path)));
  return {orphans, index};
}

/**
 * Re-checks references right before a destructive action and returns only the
 * files that are still unreferenced. A note can start referencing an image at
 * any moment, so this runs again instead of trusting an earlier scan.
 */
export async function filterStillUnreferenced(app: App, files: TFile[]): Promise<TFile[]> {
  const index = await buildImageReferenceIndex(app);
  const linkedBasenames = collectResolvedBasenames(app);
  return files.filter(({path}) =>
    !index.isReferenced(path) && !linkedBasenames.has(pathBasename(path)));
}

export async function processAllPages(plugin: ImageToolkitPlugin): Promise<ImageProcessingFailure[]> {
  const failures: ImageProcessingFailure[] = [];
  const files = collectMarkdownNotes(plugin);
  const total = files.length;
  const notice = new Notice("Awesome Image \nStart processing. Total " + total + " pages. ", TIMEOUT_LIKE_INFINITY);

  for (const [index, file] of files.entries()) {
    notice.setMessage('Awesome Image: Processing \n"' + file.path + '" \nPage ' + index + " of " + total);
    failures.push(...await processPage(plugin, file, true));
  }
  notice.setMessage("Awesome Image: " + total + " pages were processed.");
  window.setTimeout(() => notice.hide(), NOTICE_TIMEOUT);
  return failures;
}
