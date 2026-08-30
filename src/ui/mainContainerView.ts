import {TOOLBAR_CONF, type ContainerType} from "../conf/constants";
import {t} from "../lang/helpers";
import type ImageToolkitPlugin from "../main";
import {ImgCto} from "../to/imgTo";
import {ContainerView} from "./containerView";
import {GalleryNavbarView} from "./galleryNavbarView";

export class MainContainerView extends ContainerView {
  private galleryNavbarView: GalleryNavbarView | null = null;

  constructor(plugin: ImageToolkitPlugin, containerType: ContainerType) {
    super(plugin, containerType, 1);
  }

  override setActiveImgForMouseEvent(_imgCto: ImgCto | null): void {}

  override initContainerViewDom(containerEl: HTMLElement): ImgCto {
    if (!this.imgInfoCto.oitContainerViewEl) {
      const root = createDiv("oit-main-container-view");
      const container = createDiv("img-container");
      const tip = createDiv("img-tip");
      const footer = createDiv("img-footer");
      const title = createDiv("img-title");
      const titleName = createSpan("img-title-name");
      const titleIndex = createSpan("img-title-index");
      const toolbar = createEl("ul");
      const player = createDiv("img-player");
      const playerImage = createEl("img");
      this.imgInfoCto.oitContainerViewEl = root;
      this.imgInfoCto.imgContainerEl = container;
      this.imgInfoCto.imgTipEl = tip;
      this.imgInfoCto.imgFooterEl = footer;
      this.imgInfoCto.imgTitleEl = title;
      this.imgInfoCto.imgTitleNameEl = titleName;
      this.imgInfoCto.imgTitleIndexEl = titleIndex;
      this.imgInfoCto.imgPlayerEl = player;
      this.imgInfoCto.imgPlayerImgViewEl = playerImage;
      tip.hidden = true;
      title.append(titleName, titleIndex);
      toolbar.addClass("img-toolbar");
      TOOLBAR_CONF.filter(({enableToolbarIcon}) => enableToolbarIcon).forEach((config) => {
        const item = createEl("li");
        item.addClass(config.class ?? "");
        item.setAttr("alt", config.title);
        item.setAttr("title", t(config.title));
        toolbar.append(item);
      });
      toolbar.addEventListener("click", this.clickImgToolbar);
      playerImage.addClass("img-fullscreen");
      player.append(playerImage);
      root.append(container, tip, footer, player);
      footer.append(title, toolbar);
      containerEl.append(root);
      this.updateImgViewElAndList(this.pinMaximum);
    }
    const image = this.imgInfoCto.imgList[0];
    this.imgGlobalStatus.activeImg = image;
    return image;
  }

  override openOitContainerView(matchedImg: ImgCto): void {
    const root = this.imgInfoCto.oitContainerViewEl;
    if (!root) {
      console.error("obsidian-image-toolkit: container view is not initialized");
      return;
    }
    matchedImg.popup = true;
    this.imgGlobalStatus.popup = true;
    root.setCssProps({display: "block"});
  }

  override closeContainerView = (event: MouseEvent | null = null, activeImg: ImgCto | null = null): void => {
    if (event) {
      const target = event.target as HTMLElement;
      if (!["img-container", "oit-main-container-view"].includes(target.className)) return;
    }
    const active = activeImg ?? this.imgGlobalStatus.activeImg;
    if (!active) return;
    if (this.imgInfoCto.oitContainerViewEl) this.imgInfoCto.oitContainerViewEl.setCssProps({display: "none"});
    this.renderImgTitle("", "");
    this.renderImgView(active.imgViewEl, "", "");
    this.imgGlobalStatus.popup = false;
    active.popup = false;
    active.mtime = 0;
    this.addOrRemoveEvents(active, false);
    if (this.plugin.settings.galleryNavbarToggle) this.galleryNavbarView?.closeGalleryNavbar();
  };

  protected override renderGalleryNavbar(): void {
    if (!this.plugin.settings.galleryNavbarToggle || !this.imgInfoCto.imgFooterEl) return;
    this.galleryNavbarView ??= new GalleryNavbarView(this, this.plugin);
    void this.galleryNavbarView.renderGalleryImg(this.imgInfoCto.imgFooterEl);
  }

  protected override removeGalleryNavbar(): void {
    this.galleryNavbarView?.remove();
    this.galleryNavbarView = null;
  }

  override renderImgTitle(name?: string, index?: string): void {
    if (name != null) this.imgInfoCto.imgTitleNameEl?.setText(name);
    if (index != null) this.imgInfoCto.imgTitleIndexEl?.setText(" " + index);
  }

  protected override switchImageOnGalleryNavBar(event: KeyboardEvent, next: boolean): void {
    if (this.checkHotkeySettings(event, this.plugin.settings.switchTheImageHotkey))
      this.galleryNavbarView?.switchImage(next);
  }
}
