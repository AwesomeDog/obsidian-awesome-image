import {Md5} from "md5-typescript";
import {MarkdownView, TFile} from "obsidian";
import type ImageToolkitPlugin from "../main";
import {md5Img, parseActiveViewData} from "../util/markdowParse";
import {GalleryImgCacheCto} from "../to/galleryNavbarTo";
import {MainContainerView} from "./mainContainerView";

type ImageContext = [string | null, string | null, string | null];

export class GalleryNavbarView {
  private state = false;
  private galleryNavbarEl: HTMLDivElement | null = null;
  private galleryListEl: HTMLUListElement | null = null;
  private galleryIsMousingDown = false;
  private galleryMouseDownClientX = 0;
  private galleryTranslateX = 0;
  private mouseDownTime: number | null = null;
  private static galleryImageCache = new Map<string, GalleryImgCacheCto>();
  private readonly cacheLimit = 10;
  private readonly clickTime = 150;

  constructor(
    private readonly mainContainerView: MainContainerView,
    private readonly plugin: ImageToolkitPlugin,
  ) {}

  async renderGalleryImg(imgFooterEl: HTMLElement): Promise<void> {
    if (this.state) return;
    const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView || document.getElementsByClassName("modal-container").length) {
      if (this.galleryNavbarEl) this.galleryNavbarEl.hidden = true;
      this.galleryListEl?.empty();
      return;
    }

    this.initGalleryNavbar(imgFooterEl);
    const activeFile = activeView.file;
    if (!activeFile) return;
    const gallery = this.getGalleryImgCache(activeFile) ??
      parseActiveViewData(this.plugin, activeView.data?.split("\n"), activeFile);
    if (!gallery) return;
    this.setGalleryImgCache(gallery);

    const context = this.getTargetImgContextHash(
      this.mainContainerView.getLastClickedImgEl(), activeView.containerEl, this.plugin.imgSelector,
    );
    const visible: HTMLImageElement[] = [];
    let activeLi: HTMLLIElement | null = null;
    let targetImageIdx = -1;
    let targetVisibleIdx = 0;
    let matchedContext = false;

    gallery.galleryImgList.forEach((image, index) => {
      if (!this.plugin.settings.viewImageWithALink && image.link) return;
      const li = createEl("li");
      const imageEl = createEl("img");
      imageEl.addClass("gallery-img");
      imageEl.setAttr("alt", image.alt);
      imageEl.setAttr("src", image.src);
      li.append(imageEl);
      this.galleryListEl?.append(li);
      visible.push(imageEl);
      this.mainContainerView.setImgViewDefaultBackground(imageEl);
      if (matchedContext || context[1] !== image.hash) return;

      if (targetImageIdx < 0) {
        targetImageIdx = index;
        activeLi = li;
        targetVisibleIdx = visible.length;
      }
      const previous = index ? gallery.galleryImgList[index - 1]?.hash ?? null : null;
      const next = gallery.galleryImgList[index + 1]?.hash ?? null;
      if (context[0] === previous && context[2] === next) matchedContext = true;
    });

    const total = visible.length;
    this.mainContainerView.renderImgTitle(undefined, "[" + targetVisibleIdx + "/" + total + "]");
    visible.forEach((image, index) => image.dataset.index = "[" + (index + 1) + "/" + total + "]");
    if (targetImageIdx >= 0 && activeLi) {
      this.activateListItem(activeLi, undefined, false);
      this.galleryTranslateX = (document.documentElement.clientWidth || document.body.clientWidth) / 2.5 - targetImageIdx * 52;
      this.galleryListEl?.style.setProperty("transform", "translateX(" + this.galleryTranslateX + "px)");
    }
  }

  private initDefaultData(): void {
    this.galleryMouseDownClientX = 0;
    this.galleryTranslateX = 0;
    if (this.galleryListEl) {
      this.galleryListEl.setCssProps({transform: "translateX(0px)"});
      this.galleryListEl.empty();
    }
  }

  private initGalleryNavbar(imgFooterEl: HTMLElement): void {
    if (!this.galleryNavbarEl) {
      this.galleryNavbarEl = createDiv();
      this.galleryNavbarEl.addClass("gallery-navbar");
      imgFooterEl.append(this.galleryNavbarEl);
      this.galleryNavbarEl.onmouseover = () =>
        this.galleryNavbarEl?.style.setProperty("background-color", this.plugin.settings.galleryNavbarHoverColor);
      this.galleryNavbarEl.onmouseout = () =>
        this.galleryNavbarEl?.style.setProperty("background-color", this.plugin.settings.galleryNavbarDefaultColor);
      this.galleryNavbarEl.addEventListener("mousedown", this.mouseDownGallery);
      this.galleryNavbarEl.addEventListener("mousemove", this.mouseMoveGallery);
      this.galleryNavbarEl.addEventListener("mouseup", this.mouseUpGallery);
      this.galleryNavbarEl.addEventListener("mouseleave", this.mouseLeaveGallery);
    }
    this.galleryNavbarEl.style.setProperty("background-color", this.plugin.settings.galleryNavbarDefaultColor);
    if (!this.galleryListEl) {
      this.galleryListEl = createEl("ul");
      this.galleryListEl.addClass("gallery-list");
      this.galleryNavbarEl.append(this.galleryListEl);
    }
    this.initDefaultData();
    this.galleryNavbarEl.hidden = false;
    this.state = true;
  }

  closeGalleryNavbar(): void {
    if (!this.state) return;
    this.galleryNavbarEl!.hidden = true;
    this.state = false;
    this.initDefaultData();
  }

  remove(): void {
    this.state = false;
    this.galleryNavbarEl?.remove();
    this.galleryListEl?.remove();
    this.galleryNavbarEl = null;
    this.galleryListEl = null;
    this.galleryIsMousingDown = false;
    this.galleryMouseDownClientX = 0;
    this.galleryTranslateX = 0;
    this.mouseDownTime = null;
    GalleryNavbarView.galleryImageCache.clear();
  }

  private getTargetImgContextHash(
    targetImgEl: HTMLImageElement | null, containerEl: HTMLElement, selector: string,
  ): ImageContext {
    if (!selector) return [null, null, null];
    const images = [...containerEl.querySelectorAll<HTMLImageElement>(selector)];
    const targetIndex = images.findIndex((image) => image.dataset.oitTarget === "1");
    const index = targetIndex < 0 ? -1 : targetIndex;
    const target = targetIndex < 0 && targetImgEl ? targetImgEl : images[targetIndex];
    if (!target) return [null, null, null];
    const hash = (image: HTMLImageElement | undefined) => image ? md5Img(image.alt, image.src) : null;
    return [hash(images[index - 1]), md5Img(target.alt, target.src), hash(images[index + 1])];
  }

  private activateListItem(li: HTMLLIElement, image?: HTMLImageElement, refresh = true): void {
    if (!image) image = li.querySelector("img") ?? undefined;
    const active = this.mainContainerView.getActiveImg();
    if (refresh && image && active) {
      this.mainContainerView.initDefaultData(active, image.style);
      this.mainContainerView.refreshImg(active, image.src, image.alt, image.dataset.index);
    }
    li.addClass("gallery-active");
    if (this.plugin.settings.galleryImgBorderActive) {
      li.addClass("img-border-active");
      li.style.setProperty("border-color", this.plugin.settings.galleryImgBorderActiveColor);
    }
  }

  private deactivateListItem(li: HTMLLIElement): void {
    li.removeClass("gallery-active");
    if (li.hasClass("img-border-active")) {
      li.removeClass("img-border-active");
      li.style.removeProperty("border-color");
    }
  }

  private clickGalleryImg = (event: MouseEvent): void => {
    const image = event.target as HTMLImageElement | null;
    if (!image || image.tagName !== "IMG") return;
    this.galleryListEl?.querySelectorAll(".gallery-active").forEach((li) =>
      this.deactivateListItem(li as HTMLLIElement));
    if (image.parentElement) this.activateListItem(image.parentElement as HTMLLIElement, image);
  };

  switchImage(next: boolean): void {
    if (!this.state || !this.galleryListEl) return;
    const items = [...this.galleryListEl.getElementsByTagName("li")];
    if (!items.length) return;
    const current = items.findIndex((item) => item.hasClass("gallery-active"));
    const index = current < 0 ? 0 : (current + (next ? 1 : -1) + items.length) % items.length;
    if (current >= 0) this.deactivateListItem(items[current]);
    this.activateListItem(items[index]);
  }

  private mouseDownGallery = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    this.mouseDownTime = Date.now();
    this.galleryIsMousingDown = true;
    this.galleryMouseDownClientX = event.clientX;
  };

  private mouseMoveGallery = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    if (!this.galleryIsMousingDown || !this.galleryListEl) return;
    const distance = event.clientX - this.galleryMouseDownClientX;
    if (Math.abs(distance) < 4) return;
    this.galleryMouseDownClientX = event.clientX;
    this.galleryTranslateX += distance;
    const width = document.documentElement.clientWidth || document.body.clientWidth;
    const listWidth = (this.galleryListEl.childElementCount - 1) * 52;
    this.galleryTranslateX = Math.min(width - 50, this.galleryTranslateX);
    this.galleryTranslateX = Math.max(-listWidth, this.galleryTranslateX);
    this.galleryListEl.style.transform = "translateX(" + this.galleryTranslateX + "px)";
  };

  private mouseUpGallery = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    this.galleryIsMousingDown = false;
    if (!this.mouseDownTime || Date.now() - this.mouseDownTime < this.clickTime) this.clickGalleryImg(event);
    this.mouseDownTime = null;
  };

  private mouseLeaveGallery = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    this.galleryIsMousingDown = false;
    this.mouseDownTime = null;
  };

  private getGalleryImgCache(file: TFile): GalleryImgCacheCto | null {
    const key = this.md5File(file.path, file.stat.ctime);
    if (!key) return null;
    const cache = GalleryNavbarView.galleryImageCache.get(key);
    if (cache && cache.file.mtime !== file.stat.mtime) {
      GalleryNavbarView.galleryImageCache.delete(key);
      return null;
    }
    return cache ?? null;
  }

  private setGalleryImgCache(cache: GalleryImgCacheCto): void {
    const key = this.md5File(cache.file.path, cache.file.ctime);
    if (!key) return;
    this.trimGalleryImgCache();
    GalleryNavbarView.galleryImageCache.set(key, cache);
  }

  private trimGalleryImgCache(): void {
    if (GalleryNavbarView.galleryImageCache.size < this.cacheLimit) return;
    const oldest = [...GalleryNavbarView.galleryImageCache.entries()]
      .sort(([, a], [, b]) => a.mtime - b.mtime)[0]?.[0];
    if (oldest) GalleryNavbarView.galleryImageCache.delete(oldest);
  }

  private md5File(path: string, ctime: number): string | null {
    return path && ctime ? Md5.init(path + "_" + ctime) : null;
  }
}
