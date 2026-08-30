import {App} from "obsidian";
import {
  arraybufferEqual, cleanFileName, downloadImage, ensureFolderExists, fileExtByContent,
  genSha256, getLinkFullPath, isLocalImage, isUrl, pathDirname, pathJoin,
} from "./utils";

export function imageTagProcessor(app: App, mediaDir: string) {
  return async (match: string, anchor: string, link: string): Promise<string> => {
    if (!isUrl(link) && !isLocalImage(link)) return match;
    try {
      let fileData: ArrayBuffer;
      if (isLocalImage(link)) {
        const source = getLinkFullPath(app, decodeURI(link));
        if (!source) return match;
        fileData = await app.vault.adapter.readBinary(source);
      } else {
        fileData = await downloadImage(link);
      }

      const {newFileName, isDuplicated} = await getNewFileName(app, mediaDir, fileData);
      if (!isDuplicated) {
        await ensureFolderExists(app, pathDirname(newFileName));
        await app.vault.createBinary(newFileName, fileData);
      }
      if (!newFileName) return match;
      const newMatch = "![" + anchor + "](" + newFileName + ")";
      if (match === newMatch) return match;
      console.log("Awesome Image changed link: FROM |" + link + "| TO |" + newFileName + "|");
      return newMatch;
    } catch (error) {
      console.warn("Image processing failed for link: " + link, error);
      return match;
    }
  };
}

export async function getNewFileName(
  app: App, dir: string, contentData: ArrayBuffer,
): Promise<{newFileName: string; isDuplicated: boolean}> {
  const extension = await fileExtByContent(contentData);
  const baseName = cleanFileName(await genSha256(contentData));
  const targetDir = pathJoin(dir, baseName.slice(0, 3).split("").join("/"));
  const newFileName = pathJoin(targetDir, baseName + "." + extension);
  if (!await app.vault.adapter.exists(newFileName, false))
    return {newFileName, isDuplicated: false};

  if (arraybufferEqual(contentData, await app.vault.adapter.readBinary(newFileName)))
    return {newFileName, isDuplicated: true};
  const message = "SHA256 collision happened for file: " + newFileName;
  console.warn(message);
  throw new Error(message);
}
