import type {ContainerType} from "../conf/constants";
import type ImageToolkitPlugin from "../main";
import {ImgCto} from "../to/imgTo";
import {ContainerView} from "./containerView";
import {MenuView} from "./menuView";

export class PinContainerView extends ContainerView {
  constructor(plugin: ImageToolkitPlugin, containerType: ContainerType) {
    super(plugin, containerType, plugin.settings.pinMaximum);
    this.setMenuView(new MenuView(this));
  }

  override setActiveImgForMouseEvent(imgCto: ImgCto | null): void {
    this.imgGlobalStatus.activeImg = imgCto;
  }

  override initContainerViewDom(containerEl: HTMLElement): ImgCto {
    if (!this.imgInfoCto.oitContainerViewEl) {
      const root = createDiv("oit-pin-container-view");
      const container = createDiv("img-container");
      const tip = createDiv("img-tip");
      const player = createDiv("img-player");
      const playerImage = createEl("img");
      this.imgInfoCto.oitContainerViewEl = root;
      this.imgInfoCto.imgContainerEl = container;
      this.imgInfoCto.imgTipEl = tip;
      this.imgInfoCto.imgPlayerEl = player;
      this.imgInfoCto.imgPlayerImgViewEl = playerImage;
      tip.hidden = true;
      playerImage.addClass("img-fullscreen");
      player.append(playerImage);
      root.append(container, tip, player);
      containerEl.append(root);
    }
    this.updateImgViewElAndList(this.pinMaximum);
    return this.getMatchedImg()!;
  }

  override openOitContainerView(matchedImg: ImgCto): void {
    const root = this.imgInfoCto.oitContainerViewEl;
    if (!root) {
      console.error("obsidian-image-toolkit: container view is not initialized");
      return;
    }
    matchedImg.popup = true;
    if (!this.imgGlobalStatus.popup) {
      this.imgGlobalStatus.popup = true;
      this.imgGlobalStatus.activeImgZIndex = 0;
      this.imgInfoCto.imgList.forEach((image) => { image.zIndex = 0; });
    } else {
      matchedImg.zIndex = ++this.imgGlobalStatus.activeImgZIndex;
    }
    matchedImg.imgViewEl.style.zIndex = String(matchedImg.zIndex);
    root.style.display = "block";
  }

  override closeContainerView = (_event: MouseEvent | null = null, activeImg: ImgCto | null = null): void => {
    if (_event && !activeImg) return;
    if (!this.imgInfoCto.oitContainerViewEl) return;
    const active = activeImg ?? this.imgGlobalStatus.activeImg;
    if (!active) return;
    this.renderImgView(active.imgViewEl, "", "");
    active.popup = false;
    active.mtime = 0;
    const hasPopup = this.imgInfoCto.imgList.some(({popup}) => popup);
    if (!hasPopup) {
      this.imgInfoCto.oitContainerViewEl.style.display = "none";
      this.imgGlobalStatus.activeImgZIndex = 0;
      this.imgInfoCto.imgList.forEach((image) => { image.zIndex = 0; });
    }
    this.imgGlobalStatus.popup = hasPopup;
    this.addOrRemoveEvents(active, false);
  };

  protected override setActiveImgZIndex(activeImg: ImgCto): void {
    if (this.imgInfoCto.imgList.some((image) =>
      image.index !== activeImg.index && activeImg.zIndex <= image.zIndex)) {
      activeImg.zIndex = ++this.imgGlobalStatus.activeImgZIndex;
      activeImg.imgViewEl.style.zIndex = String(activeImg.zIndex);
    }
  }
}
