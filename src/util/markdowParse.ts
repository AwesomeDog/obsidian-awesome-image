import {Md5} from "md5-typescript";
import {TFile} from "obsidian";
import type ImageToolkitPlugin from "../main";
import {FileCto} from "../to/commonTo";
import {GalleryImgCacheCto, GalleryImgCto} from "../to/galleryNavbarTo";

const IMAGE_LINK_REGEX1 = /\[\s*?(!\[(.*?)\]\((.*?)\))\s*?\]\(.*?\)/;
const IMAGE_REGEX1 = /!\[(.*?)\]\((.*?)\)/;
const IMAGE_LINK_REGEX2 = /\[\s*?(!\[\[(.*?[jpe?g|png|gif|svg|bmp].*?)\]\])\s*?\]\(.*?\)/i;
const IMAGE_REGEX2 = /!\[\[(.*?[jpe?g|png|gif|svg|bmp].*?)\]\]/i;
const SRC_LINK_REGEX = /[a-z][a-z0-9+\-.]+:\/.*/i;
const SRC_IMG_REGEX = /.*?\.jpe?g|png|gif|svg|bmp/i;
const IMG_TAG_LINK_SRC_REGEX = /<a.*?(<img.*?src=['"](.*?)['"].*?\/?>).*?\/a>/i;
const IMG_TAG_SRC_REGEX = /<img.*?src=['"](.*?)['"].*?\/?>/i;
const IMG_TAG_ALT_REGEX = /<img.*?alt=['"](.*?)['"].*?\/?>/i;
const FULL_PATH_REGEX = /^[a-z]\:.*?[jpe?g|png|gif|svg|bmp]/i;
const BLOCKQUOTE_PREFIX = "#^";
const CODE_FENCE = String.fromCharCode(96).repeat(3);

export function parseActiveViewData(
  plugin: ImageToolkitPlugin,
  lines: string[] | undefined,
  file: TFile,
): GalleryImgCacheCto | null {
  if (!lines?.length) return null;
  const images: GalleryImgCto[] = [];
  let inCode = false;

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith(CODE_FENCE)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    for (const text of getNonCodeAreaTexts(line) ?? [line]) extractImage(text, images);
  }

  for (const image of images) {
    if (image.convert) {
      const fileTarget = plugin.app.metadataCache.getFirstLinkpathDest(
        decodeURIComponent(image.src), file.path,
      );
      image.src = fileTarget ? plugin.app.vault.getResourcePath(fileTarget) : "";
    }
    image.hash = md5Img(image.alt, image.src);
    image.match = null;
    image.name = null;
  }
  return new GalleryImgCacheCto(
    new FileCto(file.path, file.stat.ctime, file.stat.mtime), images, Date.now(),
  );
}

function getNonCodeAreaTexts(line: string): string[] | null {
  const start = line.indexOf(String.fromCharCode(96));
  if (start < 0) return null;
  const end = line.lastIndexOf(String.fromCharCode(96));
  if (start === end) return null;
  return [
    start ? line.slice(0, start) : "",
    end < line.length - 1 ? line.slice(end + 1) : "",
  ].filter(Boolean);
}

function extractImage(text: string, images: GalleryImgCto[]): void {
  const image = matchImage1(text) ?? matchImage2(text) ?? matchImageTag(text);
  if (!image) return;
  images.push(image);
  const match = image.match;
  if (!match || match.index === undefined) return;
  const next = match.index + match[0].length;
  if (next <= text.length - 7) extractImage(text.slice(next), images);
}

function matchImage1(text: string): GalleryImgCto | null {
  let match = text.match(IMAGE_LINK_REGEX1);
  const linked = Boolean(match);
  let alt: string | undefined;
  let src: string | undefined;

  if (match) {
    alt = match[2];
    src = match[3];
  } else if ((match = text.match(IMAGE_REGEX1))) {
    alt = match[1];
    if (alt?.includes("[") && alt.includes("]")) return null;
    src = match[2];
    if (src?.startsWith(BLOCKQUOTE_PREFIX)) return null;
  }
  if (!match) return null;

  const image = new GalleryImgCto(alt ?? "", src ?? "");
  image.link = linked;
  image.match = match;
  annotateSource(image);
  trimWidthFromAlt(image);
  return image;
}

function matchImage2(text: string): GalleryImgCto | null {
  let match = text.match(IMAGE_LINK_REGEX2);
  const linked = Boolean(match);
  let content: string | undefined;
  if (match) content = match[2];
  else if ((match = text.match(IMAGE_REGEX2))) {
    content = match[1];
    if (content?.startsWith(BLOCKQUOTE_PREFIX)) return null;
  }
  if (!match || !content) return null;

  const [src = "", ...parts] = content.split("|");
  const image = new GalleryImgCto();
  image.link = linked;
  image.match = match;
  if (!src) return image;
  image.src = src;
  image.name = src.split("/").at(-1);
  image.convert = true;
  image.alt = parts.filter((part, index) =>
    index !== parts.length - 1 || !/\d+/.test(part)).join("|") || (parts.length ? "" : src);
  return image;
}

function matchImageTag(text: string): GalleryImgCto | null {
  let match = text.match(IMG_TAG_LINK_SRC_REGEX);
  const linked = Boolean(match);
  if (!match) match = text.match(IMG_TAG_SRC_REGEX);
  if (!match) return null;

  const image = new GalleryImgCto("", linked ? match[2] : match[1]);
  image.link = linked;
  image.match = match;
  if (image.src.startsWith("file://")) image.src = image.src.replace(/^file:\/+/, "app://local/");
  else if (FULL_PATH_REGEX.test(image.src)) image.src = "app://local/" + image.src;
  image.alt = text.match(IMG_TAG_ALT_REGEX)?.[1] ?? "";
  return image;
}

function annotateSource(image: GalleryImgCto): void {
  if (SRC_LINK_REGEX.test(image.src)) {
    if (image.src.startsWith("file://")) image.src = image.src.replace(/^file:\/+/, "app://local/");
  } else if (SRC_IMG_REGEX.test(image.src)) {
    image.name = image.src.split("/").at(-1);
    image.convert = true;
  }
}

function trimWidthFromAlt(image: GalleryImgCto): void {
  const parts = image.alt.split("|");
  const width = parts.at(-1);
  if (parts.length > 1 && width && /\d+/.test(width)) image.alt = parts.slice(0, -1).join("|");
}

export const md5Img = (alt: string, src: string): string =>
  Md5.init((alt || "") + "_" + src);
