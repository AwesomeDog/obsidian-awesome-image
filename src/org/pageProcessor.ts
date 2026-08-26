import {Notice, TFile} from "obsidian";
import type ImageToolkitPlugin from "../main";
import {ImgSettingIto} from "../to/imgTo";
import {EXTERNAL_MEDIA_LINK_PATTERN, NOTICE_TIMEOUT, TIMEOUT_LIKE_INFINITY} from "./constants";
import {getLinkFullPath, isLocalImage, replaceAsync} from "./utils";
import {imageTagProcessor} from "./contentProcessor";

export async function processPage(
  plugin: ImageToolkitPlugin, file: TFile, silent = false,
): Promise<void> {
  const settings: ImgSettingIto = plugin.settings;
  const content = await plugin.app.vault.cachedRead(file);
  const fixedContent = await replaceAsync(
    content, EXTERNAL_MEDIA_LINK_PATTERN,
    imageTagProcessor(plugin.app, settings.mediaRootDirectory),
  );
  const changed = content !== fixedContent;
  if (changed) await plugin.app.vault.modify(file, fixedContent);
  if (!silent) new Notice(
    'Page "' + file.path + '" has been processed, ' + (changed ? "and changed." : "but nothing was changed."),
  );
}

export async function findOrphanImages(plugin: ImageToolkitPlugin): Promise<void> {
  const orphan = plugin.app.vault.getFiles()
    .map(({path}) => path)
    .filter(isLocalImage)
    .filter((path) => getLinkFullPath(plugin.app, path) === null);
  const result = "----below are orphaned images----\n" + orphan.join("\n") + "\n----end----";
  console.log(result);
  await navigator.clipboard.writeText(result);
  new Notice("Orphaned images copied to clipboard");
}

export async function processAllPages(plugin: ImageToolkitPlugin): Promise<void> {
  const regex = new RegExp(plugin.settings.includedFileRegex, "i");
  const files = plugin.app.vault.getMarkdownFiles().filter((file) =>
    regex.test(file.path) && !plugin.settings.excludedFolders.some((folder) => file.path.startsWith(folder)));
  const total = files.length;
  const notice = new Notice("Awesome Image \nStart processing. Total " + total + " pages. ", TIMEOUT_LIKE_INFINITY);

  for (const [index, file] of files.entries()) {
    notice.setMessage('Awesome Image: Processing \n"' + file.path + '" \nPage ' + index + " of " + total);
    await processPage(plugin, file, true);
  }
  notice.setMessage("Awesome Image: " + total + " pages were processed.");
  setTimeout(() => notice.hide(), NOTICE_TIMEOUT);
}
