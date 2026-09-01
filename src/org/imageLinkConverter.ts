import {App, Notice, TFile} from "obsidian";
import type ImageToolkitPlugin from "../main";
import {TIMEOUT_LIKE_INFINITY} from "./constants";
import {collectMarkdownNotes, isLocalImage} from "./utils";

/** `[[img.png]]`, `![[embed.png]]`, `[[img.png|caption]]`, `![[img.png|300]]` ... */
const WIKILINK_PATTERN = /(!?)\[\[([^[\]\n]+)\]\]/g;
const CODE_FENCE = String.fromCharCode(96).repeat(3);
/** The characters Obsidian percent-encodes in a Markdown link target. */
const MARKDOWN_UNSAFE_PATTERN = /[\\\x00\x08\x0B\x0C\x0E-\x1F ]/g;

export interface LinkConversionResult {
  notes: number;
  converted: number;
  skipped: number;
}

interface Counters {
  converted: number;
  skipped: number;
}

/**
 * Rewrites `[[image.png]]` links and `![[image.png]]` embeds as Markdown links in every note of
 * the vault. Links to notes, PDFs and other non-image files are left alone: this command exists
 * so that the image processing commands, which only read Markdown image links, can see them.
 *
 * The scan is read-only until a note actually changes, and the caller is expected to have asked
 * the user for confirmation first.
 */
export async function convertWikiImageLinksInVault(plugin: ImageToolkitPlugin): Promise<LinkConversionResult> {
  const files = collectMarkdownNotes(plugin);
  const result: LinkConversionResult = {notes: 0, converted: 0, skipped: 0};
  const notice = new Notice(
    "Converting wiki image links in " + files.length + " note(s)...", TIMEOUT_LIKE_INFINITY,
  );
  try {
    for (const [index, file] of files.entries()) {
      notice.setMessage("Converting wiki image links: " + (index + 1) + "/" + files.length);
      if (isGeneratedFile(plugin.app, file)) continue;

      const text = await plugin.app.vault.cachedRead(file);
      const next = convertWikiImageLinks(plugin.app, text, file.path);
      result.skipped += next.skipped;
      if (!next.converted) continue;

      await plugin.app.vault.modify(file, next.text);
      result.notes++;
      result.converted += next.converted;
    }
  } finally {
    notice.hide();
  }
  return result;
}

function convertWikiImageLinks(app: App, text: string, sourcePath: string):
  {text: string; converted: number; skipped: number} {
  const counters: Counters = {converted: 0, skipped: 0};
  let inCode = false;

  const lines = text.split("\n").map((line) => {
    if (line.trimStart().startsWith(CODE_FENCE)) {
      inCode = !inCode;
      return line;
    }
    if (inCode) return line;
    return convertWikiImageLinksInLine(app, line, sourcePath, counters);
  });

  return {text: lines.join("\n"), converted: counters.converted, skipped: counters.skipped};
}

/** Only the segments outside inline code (the even indices) can hold real links. */
function convertWikiImageLinksInLine(app: App, line: string, sourcePath: string, counters: Counters): string {
  return line.split(String.fromCharCode(96))
    .map((segment, index) =>
      index % 2 ? segment : replaceWikiImageLinks(app, segment, sourcePath, counters))
    .join(String.fromCharCode(96));
}

function replaceWikiImageLinks(app: App, text: string, sourcePath: string, counters: Counters): string {
  return text.replace(WIKILINK_PATTERN, (whole: string, bang: string, content: string) => {
    const link = toMarkdownImageLink(app, content, sourcePath, bang === "!");
    if (!link) {
      // Only image links that could not be resolved are worth reporting; anything else is
      // simply not an image link and therefore out of scope.
      if (isImageLinkText(content)) counters.skipped++;
      return whole;
    }
    counters.converted++;
    return bang + link;
  });
}

/**
 * @returns the Markdown replacement, without the leading `!`, or `null` when the link should be
 * left untouched.
 *
 * The link is built here rather than by `FileManager.generateMarkdownLink`, because that helper
 * returns a wikilink whenever the vault has `Use [[Wikilinks]]` enabled, which is the default.
 * `MetadataCache.fileToLinktext` is used instead: it applies the `New link format` setting and
 * nothing else.
 */
function toMarkdownImageLink(app: App, content: string, sourcePath: string, embedded: boolean): string | null {
  const [target = "", ...aliasParts] = content.split("|");
  const alias = aliasParts.join("|").trim();
  const hash = target.indexOf("#");
  const linkPath = (hash < 0 ? target : target.slice(0, hash)).trim();
  if (!isLocalImage(linkPath)) return null;

  const file = app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
  if (!file) return null;

  const href = (app.metadataCache.fileToLinktext(file, sourcePath, false) +
    (hash < 0 ? "" : target.slice(hash))).replace(MARKDOWN_UNSAFE_PATTERN, (part) =>
    encodeURIComponent(part));

  // A size such as `![[img.png|300]]` needs no special case: Obsidian reads the size from the alt
  // text of a Markdown embed, so it simply stays where it is.
  //
  // An empty alt text is right for an embed, but a bare link with no text renders as nothing,
  // so a link falls back to the file name, the way the wikilink did.
  return "[" + (alias || (embedded ? "" : file.name)) + "](" + href + ")";
}

function isImageLinkText(content: string): boolean {
  return isLocalImage(content.split("|")[0] ?? "");
}

/** Excalidraw and Kanban notes store structured data that a link rewrite would corrupt. */
function isGeneratedFile(app: App, file: TFile): boolean {
  const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
  return Boolean(frontmatter?.["excalidraw-plugin"] || frontmatter?.["kanban-plugin"]);
}
