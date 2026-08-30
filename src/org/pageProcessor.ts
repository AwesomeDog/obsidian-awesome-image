import {Notice, TFile} from "obsidian";
import type ImageToolkitPlugin from "../main";
import {ImgSettingIto} from "../to/imgTo";
import {EXTERNAL_MEDIA_LINK_PATTERN, NOTICE_TIMEOUT, TIMEOUT_LIKE_INFINITY} from "./constants";
import {getLinkFullPath, isLocalImage, replaceAsync} from "./utils";
import {imageTagProcessor, type ImageProcessingFailure} from "./contentProcessor";

export async function processPage(
  plugin: ImageToolkitPlugin, file: TFile, silent = false,
): Promise<ImageProcessingFailure[]> {
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

export function findOrphanImages(plugin: ImageToolkitPlugin): TFile[] {
  return plugin.app.vault.getFiles()
    .filter(({path}) => isLocalImage(path))
    .filter(({path}) => getLinkFullPath(plugin.app, path) === null);
}

export async function processAllPages(plugin: ImageToolkitPlugin): Promise<ImageProcessingFailure[]> {
  const failures: ImageProcessingFailure[] = [];
  const regex = new RegExp(plugin.settings.includedFileRegex, "i");
  const files = plugin.app.vault.getMarkdownFiles().filter((file) =>
    regex.test(file.path) && !plugin.settings.excludedFolders.some((folder) => file.path.startsWith(folder)));
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
