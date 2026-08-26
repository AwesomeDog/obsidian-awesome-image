import {Notice} from "obsidian";
import {t} from "../lang/helpers";
import {OffsetSizeIto} from "../to/commonTo";
import {ImgCto, ImgInfoIto} from "../to/imgTo";
import {IMG_VIEW_MIN, ZOOM_FACTOR} from "../conf/constants";

export class ImgUtil {
  static calculateImgZoomSize(realImg: HTMLImageElement, image: ImgCto): ImgCto {
    const windowWidth = document.documentElement.clientWidth || document.body.clientWidth;
    const windowHeight = (document.documentElement.clientHeight || document.body.clientHeight) - 100;
    const maxWidth = windowWidth * ZOOM_FACTOR;
    const maxHeight = windowHeight * ZOOM_FACTOR;
    let width = realImg.width;
    let height = realImg.height;

    if (height > maxHeight) {
      height = maxHeight;
      width = Math.min(height / realImg.height * realImg.width, maxWidth);
    } else if (width > maxWidth) {
      width = maxWidth;
      height = width / realImg.width * realImg.height;
    }
    height = width * realImg.height / realImg.width;
    Object.assign(image, {
      left: (windowWidth - width) / 2,
      top: (windowHeight - height) / 2,
      curWidth: width,
      curHeight: height,
      realWidth: realImg.width,
      realHeight: realImg.height,
    });
    return image;
  }

  static zoom(
    ratio: number | null,
    image: ImgCto,
    offsetSize: OffsetSizeIto = {offsetX: 0, offsetY: 0},
    actualSize = false,
  ): ImgCto {
    let zoomRatio = 1;
    if (!actualSize) {
      const value = ratio ?? 0;
      const factor = value > 0 ? 1 + value : 1 / (1 - value);
      ratio = factor;
      zoomRatio = image.curWidth * factor / image.realWidth;
    }

    const currentRatio = image.curWidth / image.realWidth;
    if (actualSize || (currentRatio < 1 && zoomRatio > 1) || (currentRatio > 1 && zoomRatio < 1)) {
      zoomRatio = 1;
      ratio = 1 / currentRatio;
    }

    let width = image.realWidth * zoomRatio;
    let height = image.realHeight * zoomRatio;
    if (IMG_VIEW_MIN >= width || IMG_VIEW_MIN >= height) {
      if (IMG_VIEW_MIN >= width) {
        width = IMG_VIEW_MIN;
        height = width * image.realHeight / image.realWidth;
      } else {
        height = IMG_VIEW_MIN;
        width = height * image.realWidth / image.realHeight;
      }
      ratio = 1;
    }
    Object.assign(image, {
      curWidth: width,
      curHeight: height,
      left: image.left + offsetSize.offsetX * (1 - (ratio ?? 0)),
      top: image.top + offsetSize.offsetY * (1 - (ratio ?? 0)),
    });
    return image;
  }

  static transform(image: ImgCto): void {
    image.imgViewEl.style.transform =
      "rotate(" + image.rotate + "deg)" +
      (image.scaleX ? " scaleX(-1)" : "") + (image.scaleY ? " scaleY(-1)" : "");
  }

  static rotate(degree: number, image: ImgInfoIto): void {
    image.imgViewEl.style.transform = "rotate(" + (image.rotate += degree) + "deg)";
  }

  static invertImgColor(image: HTMLImageElement, enabled: boolean): void {
    image.style.filter = enabled ? "invert(1) hue-rotate(180deg)" : "none";
    image.style.mixBlendMode = enabled ? "screen" : "normal";
  }

  static copyText(text: string): void {
    navigator.clipboard.writeText(text).catch((error) => console.error("copy text error", error));
  }

  static copyImage(image: HTMLImageElement, _width: number, _height: number): void {
    const source = new Image();
    source.crossOrigin = "anonymous";
    source.src = image.src;
    source.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = source.width;
      canvas.height = source.height;
      const context = canvas.getContext("2d");
      if (!context) {
        new Notice(t("COPY_IMAGE_ERROR"));
        return;
      }
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, 0, 0);
      try {
        canvas.toBlob(async (blob) => {
          try {
            if (!blob) throw new Error("Unable to encode image");
            await navigator.clipboard.write([new ClipboardItem({"image/png": blob})]);
            new Notice(t("COPY_IMAGE_SUCCESS"));
          } catch (error) {
            new Notice(t("COPY_IMAGE_ERROR"));
            console.error(error);
          }
        });
      } catch (error) {
        new Notice(t("COPY_IMAGE_ERROR"));
        console.error(error);
      }
    };
    source.onerror = () => new Notice(t("COPY_IMAGE_ERROR"));
  }
}
