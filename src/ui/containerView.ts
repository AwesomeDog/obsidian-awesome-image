import {IMG_DEFAULT_BACKGROUND_COLOR, IMG_FULL_SCREEN_MODE, type ContainerType} from "../conf/constants";
import type ImageToolkitPlugin from "../main";
import {ImgCto, ImgInfoCto, ImgStatusCto} from "../to/imgTo";
import {OffsetSizeIto} from "../to/commonTo";
import {ImgUtil} from "../util/imgUtil";
import {MenuView} from "./menuView";

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT" | "UP_LEFT" | "UP_RIGHT" | "DOWN_LEFT" | "DOWN_RIGHT";
type ImgStyle = Pick<CSSStyleDeclaration, "borderWidth" | "borderStyle" | "borderColor">;

export abstract class ContainerView {
  private readonly containerType: ContainerType;
  protected readonly plugin: ImageToolkitPlugin;
  protected lastClickedImgEl: HTMLImageElement | null = null;
  protected lastClickedImgDefaultStyle: ImgStyle = {borderWidth: "", borderStyle: "", borderColor: ""};
  protected imgGlobalStatus = new ImgStatusCto();
  protected imgInfoCto = new ImgInfoCto();
  protected pinMaximum: number;
  protected menuView?: MenuView;

  protected constructor(plugin: ImageToolkitPlugin, containerType: ContainerType, pinMaximum: number) {
    this.plugin = plugin;
    this.containerType = containerType;
    this.pinMaximum = pinMaximum;
  }

  isPinMode(): boolean { return this.containerType === "PIN"; }
  protected setMenuView(menuView: MenuView): void { this.menuView = menuView; }
  getPlugin(): ImageToolkitPlugin { return this.plugin; }
  getLastClickedImgEl(): HTMLImageElement | null { return this.lastClickedImgEl; }
  getActiveImg(): ImgCto | null { return this.imgGlobalStatus.activeImg; }
  setPinMaximum(value: number): void { this.pinMaximum = value; }
  getOitContainerViewEl(): HTMLDivElement | null { return this.imgInfoCto.imgContainerEl; }

  abstract setActiveImgForMouseEvent(imgCto: ImgCto | null): void;
  abstract initContainerViewDom(containerEl: HTMLElement): ImgCto | null;
  abstract openOitContainerView(matchedImg: ImgCto): void;
  abstract closeContainerView(event?: MouseEvent | null, activeImg?: ImgCto | null): void;

  renderContainerView(targetEl: HTMLImageElement): void {
    if (!this.checkStatus()) return;
    const matched = this.initContainerView(targetEl, this.plugin.app.workspace.containerEl);
    if (!matched) return;
    this.openOitContainerView(matched);
    this.renderGalleryNavbar();
    this.refreshImg(matched, targetEl.src, targetEl.alt);
    matched.mtime = Date.now();
  }

  initContainerView(targetEl: HTMLImageElement, containerEl: HTMLElement): ImgCto | null {
    const matched = this.initContainerViewDom(containerEl);
    if (!matched) return null;
    matched.targetOriginalImgEl = targetEl;
    this.restoreBorderForLastClickedImg();
    this.initDefaultData(matched, getComputedStyle(targetEl));
    this.addBorderForLastClickedImg(targetEl);
    this.addOrRemoveEvents(matched, true);
    return matched;
  }

  removeOitContainerView(): void {
    this.restoreBorderForLastClickedImg();
    this.removeGalleryNavbar();
    this.imgInfoCto.oitContainerViewEl?.remove();
    this.imgInfoCto.oitContainerViewEl = null;
    this.imgInfoCto.imgContainerEl = null;
    Object.assign(this.imgGlobalStatus, {
      dragging: false, popup: false, activeImgZIndex: 0, fullScreen: false, activeImg: null,
    });
    this.imgInfoCto.imgList.length = 0;
  }

  protected checkStatus(): boolean {
    if (!this.containerType) return false;
    const className = this.containerType === "PIN" ? "oit-pin-container-view" : "oit-main-container-view";
    if ((this.containerType === "PIN") !== this.plugin.settings.pinMode) return false;
    if (this.imgInfoCto.oitContainerViewEl &&
        !document.getElementsByClassName(className).length) this.removeOitContainerView();
    return this.isPinMode() && this.plugin.settings.pinCoverMode ||
      !this.imgGlobalStatus.popup || this.pinMaximum > this.imgInfoCto.getPopupImgNum();
  }

  initDefaultData(image: ImgCto, style: CSSStyleDeclaration | null): void {
    if (style) {
      Object.assign(image.defaultImgStyle, {
        transform: "none", filter: style.filter, mixBlendMode: style.mixBlendMode,
        borderWidth: style.borderWidth, borderStyle: style.borderStyle, borderColor: style.borderColor,
      });
      Object.assign(this.lastClickedImgDefaultStyle, {
        borderWidth: style.borderWidth, borderStyle: style.borderStyle, borderColor: style.borderColor,
      });
    }
    Object.assign(this.imgGlobalStatus, {
      dragging: false, arrowUp: false, arrowDown: false, arrowLeft: false, arrowRight: false,
    });
    Object.assign(image, {invertColor: false, scaleX: false, scaleY: false, fullScreen: false});
    if (!this.imgGlobalStatus.popup) this.resetClickTimer();
  }

  protected setLastClickedImg(targetEl: HTMLImageElement): void {
    if (!targetEl) return;
    targetEl.dataset.oitTarget = "1";
    this.lastClickedImgEl = targetEl;
  }

  protected addBorderForLastClickedImg(targetEl: HTMLImageElement): void {
    this.setLastClickedImg(targetEl);
    if (!this.plugin.settings.imageBorderToggle) return;
    Object.assign(targetEl.style, {
      borderWidth: this.plugin.settings.imageBorderWidth,
      borderStyle: this.plugin.settings.imageBorderStyle,
      borderColor: this.plugin.settings.imageBorderColor,
    });
  }

  protected restoreBorderForLastClickedImg(): void {
    if (!this.lastClickedImgEl) return;
    delete this.lastClickedImgEl.dataset.oitTarget;
    Object.assign(this.lastClickedImgEl.style, this.lastClickedImgDefaultStyle);
  }

  protected updateImgViewElAndList(pinMaximum: number): void {
    const container = this.imgInfoCto.imgContainerEl;
    if (!container) return;
    if (pinMaximum < this.imgInfoCto.imgList.length) {
      container.empty();
      this.imgInfoCto.imgList.length = 0;
    }
    const now = Date.now();
    for (let index = this.imgInfoCto.imgList.length; index < pinMaximum; index++) {
      const image = createEl("img");
      image.addClass("img-view");
      image.hidden = true;
      image.dataset.index = String(index);
      this.setImgViewDefaultBackground(image);
      container.append(image);
      this.imgInfoCto.imgList.push(new ImgCto(index, now, image));
    }
  }

  protected getMatchedImg(): ImgCto | null {
    let earliest: ImgCto | undefined;
    for (const image of this.imgInfoCto.imgList) {
      if (!earliest || earliest.mtime > image.mtime) earliest = image;
      if (!image.popup) return image;
    }
    return this.plugin.settings.pinCoverMode ? earliest ?? null : null;
  }

  refreshImg(image: ImgCto, src?: string, alt?: string, titleIndex?: string): void {
    src ||= image.imgViewEl?.src;
    alt ||= image.imgViewEl?.alt;
    this.renderImgTitle(alt, titleIndex);
    if (!src || !image.imgViewEl) return;
    if (image.refreshImgInterval) clearInterval(image.refreshImgInterval);
    const realImage = new Image();
    realImage.src = src;
    image.refreshImgInterval = setInterval(() => {
      if (realImage.width <= 0 && realImage.height <= 0) return;
      if (image.refreshImgInterval) clearInterval(image.refreshImgInterval);
      image.refreshImgInterval = null;
      this.setImgViewPosition(ImgUtil.calculateImgZoomSize(realImage, image), 0);
      this.renderImgView(image.imgViewEl, src!, alt ?? "");
      this.renderImgTip(image);
      Object.assign(image.imgViewEl.style, {
        transform: image.defaultImgStyle.transform,
        filter: image.defaultImgStyle.filter,
        mixBlendMode: image.defaultImgStyle.mixBlendMode,
      });
    }, 40);
  }

  renderImgTitle(_name?: string, _index?: string): void {}

  protected setImgViewPosition(image: ImgCto, rotate = 0): void {
    if (!image.imgViewEl) return;
    image.imgViewEl.setAttribute("width", image.curWidth + "px");
    image.imgViewEl.style.setProperty("margin-top", image.top + "px", "important");
    image.imgViewEl.style.setProperty("margin-left", image.left + "px", "important");
    image.imgViewEl.style.transform = "rotate(" + rotate + "deg)";
    image.rotate = rotate;
  }

  protected renderImgView(image: HTMLImageElement, src: string, alt: string): void {
    if (!image) return;
    image.setAttribute("src", src);
    image.setAttribute("alt", alt);
    image.hidden = !src && !alt;
  }

  renderImgTip(activeImg: ImgCto | null = this.imgGlobalStatus.activeImg): void {
    const tip = this.imgInfoCto.imgTipEl;
    if (!activeImg || !tip || activeImg.realWidth <= 0 || activeImg.curWidth <= 0) return;
    if (this.imgInfoCto.imgTipTimeout) clearTimeout(this.imgInfoCto.imgTipTimeout);
    if (!this.plugin.settings.imgTipToggle) {
      tip.hidden = true;
      this.imgInfoCto.imgTipTimeout = null;
      return;
    }
    tip.hidden = false;
    const ratio = activeImg.curWidth * 100 / activeImg.realWidth;
    const singleDigit = ratio < 10;
    const width = singleDigit ? 20 : 40;
    Object.assign(tip.style, {
      width: width + "px",
      fontSize: singleDigit || activeImg.curWidth <= 100 ? "xx-small" : "x-small",
      left: activeImg.left + activeImg.curWidth / 2 - width / 2 + "px",
      top: activeImg.top + activeImg.curHeight / 2 - 10 + "px",
      zIndex: String(activeImg.zIndex),
    });
    tip.setText(parseInt(String(ratio)) + "%");
    this.imgInfoCto.imgTipTimeout = setTimeout(() => { tip.hidden = true; }, 1000);
  }

  setImgViewDefaultBackgroundForImgList(): void {
    this.imgInfoCto.imgList.forEach(({imgViewEl}) => this.setImgViewDefaultBackground(imgViewEl));
  }

  setImgViewDefaultBackground(image: HTMLImageElement | null): void {
    if (!image) return;
    const color = this.plugin.settings.imgViewBackgroundColor;
    if (color && color !== IMG_DEFAULT_BACKGROUND_COLOR) {
      image.removeClass("img-default-background");
      image.style.backgroundColor = color;
    } else {
      image.addClass("img-default-background");
      image.style.removeProperty("background-color");
    }
  }

  protected setActiveImgZIndex(_activeImg: ImgCto): void {}
  protected switchImageOnGalleryNavBar(_event: KeyboardEvent, _next: boolean): void {}
  protected renderGalleryNavbar(): void {}
  protected removeGalleryNavbar(): void {}

  protected showPlayerImg(activeImg: ImgCto | null = this.imgGlobalStatus.activeImg): void {
    if (!activeImg || !this.imgInfoCto.imgPlayerEl || !this.imgInfoCto.imgPlayerImgViewEl) return;
    this.imgGlobalStatus.fullScreen = true;
    activeImg.fullScreen = true;
    const player = this.imgInfoCto.imgPlayerEl;
    const image = this.imgInfoCto.imgPlayerImgViewEl;
    player.style.display = "block";
    player.style.zIndex = String(this.imgGlobalStatus.activeImgZIndex + 10);
    player.addEventListener("click", this.closePlayerImg);

    const windowWidth = document.documentElement.clientWidth || document.body.clientWidth;
    const windowHeight = document.documentElement.clientHeight || document.body.clientHeight;
    let width: string;
    let height: string;
    let top = 0;
    if (this.plugin.settings.imgFullScreenMode === IMG_FULL_SCREEN_MODE.STRETCH) {
      width = windowWidth + "px";
      height = windowHeight + "px";
    } else if (this.plugin.settings.imgFullScreenMode === IMG_FULL_SCREEN_MODE.FILL) {
      width = height = "100%";
    } else {
      const ratio = Math.min(windowWidth / activeImg.realWidth, windowHeight / activeImg.realHeight);
      width = activeImg.realWidth * ratio + "px";
      height = activeImg.realHeight * ratio + "px";
      top = (windowHeight - activeImg.realHeight * ratio) / 2;
    }
    image.src = activeImg.imgViewEl.src;
    image.alt = activeImg.imgViewEl.alt;
    image.setAttribute("width", width);
    image.setAttribute("height", height);
    image.style.marginTop = top + "px";
    this.setImgViewDefaultBackground(image);
  }

  protected closePlayerImg = (): void => {
    const player = this.imgInfoCto.imgPlayerEl;
    if (player) {
      player.style.display = "none";
      player.removeEventListener("click", this.closePlayerImg);
    }
    if (this.imgInfoCto.imgPlayerImgViewEl) {
      this.imgInfoCto.imgPlayerImgViewEl.src = "";
      this.imgInfoCto.imgPlayerImgViewEl.alt = "";
    }
    this.imgInfoCto.imgList.forEach((image) => { image.fullScreen = false; });
    this.imgGlobalStatus.fullScreen = false;
  };

  protected addOrRemoveEvents(image: ImgCto, add: boolean): void {
    const view = image.imgViewEl;
    const container = this.imgInfoCto.oitContainerViewEl;
    if (!view || !container) return;
    const method = add ? "addEventListener" : "removeEventListener";
    if (add && !this.imgGlobalStatus.popup) {
      document.addEventListener("keydown", this.triggerKeydown);
      document.addEventListener("keyup", this.triggerKeyup);
    } else if (!add && !this.imgGlobalStatus.popup) {
      document.removeEventListener("keydown", this.triggerKeydown);
      document.removeEventListener("keyup", this.triggerKeyup);
      this.resetClickTimer();
    }
    if (!this.isPinMode()) container[method]("click", this.closeContainerView as EventListener);
    view[method]("mouseenter", this.mouseenterImgView as EventListener);
    view[method]("mouseleave", this.mouseleaveImgView as EventListener);
    view[method]("mousedown", this.mousedownImgView as EventListener);
    view[method]("mouseup", this.mouseupImgView as EventListener);
    view[method]("mousewheel", this.mousewheelViewContainer as EventListener, {passive: true});
    if (!add && image.refreshImgInterval) {
      clearInterval(image.refreshImgInterval);
      image.refreshImgInterval = null;
    }
  }

  protected triggerKeyup = (event: KeyboardEvent): void => {
    if (!event.key) return;
    if (event.key !== "Escape") {
      event.preventDefault();
      event.stopPropagation();
    }
    const flags: Record<string, keyof ImgStatusCto> = {
      ArrowUp: "arrowUp", ArrowDown: "arrowDown", ArrowLeft: "arrowLeft", ArrowRight: "arrowRight",
    };
    if (event.key === "Escape") {
      this.imgGlobalStatus.fullScreen ? this.closePlayerImg() : this.closeContainerView();
    } else if (flags[event.key]) {
      (this.imgGlobalStatus as unknown as Record<string, boolean>)[flags[event.key]] = false;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight")
        this.switchImageOnGalleryNavBar(event, event.key === "ArrowRight");
    }
  };

  protected triggerKeydown = (event: KeyboardEvent): void => {
    if (this.isPinMode()) return;
    event.preventDefault();
    event.stopPropagation();
    const status = this.imgGlobalStatus;
    if (status.arrowUp && status.arrowLeft) return void this.moveImgViewByHotkey(event, "UP_LEFT");
    if (status.arrowUp && status.arrowRight) return void this.moveImgViewByHotkey(event, "UP_RIGHT");
    if (status.arrowDown && status.arrowLeft) return void this.moveImgViewByHotkey(event, "DOWN_LEFT");
    if (status.arrowDown && status.arrowRight) return void this.moveImgViewByHotkey(event, "DOWN_RIGHT");
    const directions: Record<string, [Direction, keyof ImgStatusCto]> = {
      ArrowUp: ["UP", "arrowUp"], ArrowDown: ["DOWN", "arrowDown"],
      ArrowLeft: ["LEFT", "arrowLeft"], ArrowRight: ["RIGHT", "arrowRight"],
    };
    const [direction, flag] = directions[event.key] ?? [];
    if (direction && flag) {
      (status as unknown as Record<string, boolean>)[flag] = true;
      this.moveImgViewByHotkey(event, direction);
    }
  };

  protected moveImgViewByHotkey(event: KeyboardEvent, direction: Direction): void {
    if (!this.imgGlobalStatus.popup || !this.checkHotkeySettings(event, this.plugin.settings.moveTheImageHotkey)) return;
    const amount = this.plugin.settings.imageMoveSpeed;
    const diagonal = direction.includes("_");
    const [vertical, horizontal] = direction.split("_");
    const offset: OffsetSizeIto = {
      offsetX: horizontal === "LEFT" ? -amount : horizontal === "RIGHT" ? amount : 0,
      offsetY: vertical === "UP" ? -amount : vertical === "DOWN" ? amount : 0,
    };
    if (!diagonal && direction === "LEFT") offset.offsetX = -amount;
    if (!diagonal && direction === "RIGHT") offset.offsetX = amount;
    if (!diagonal && direction === "UP") offset.offsetY = -amount;
    if (!diagonal && direction === "DOWN") offset.offsetY = amount;
    this.mousemoveImgView(null, offset);
  }

  checkHotkeySettings(event: KeyboardEvent | MouseEvent, hotkey: string): boolean {
    const {ctrlKey, altKey, shiftKey} = event;
    return ({
      NONE: !ctrlKey && !altKey && !shiftKey,
      CTRL: ctrlKey && !altKey && !shiftKey,
      ALT: !ctrlKey && altKey && !shiftKey,
      SHIFT: !ctrlKey && !altKey && shiftKey,
      CTRL_ALT: ctrlKey && altKey && !shiftKey,
      CTRL_SHIFT: ctrlKey && !altKey && shiftKey,
      SHIFT_ALT: !ctrlKey && altKey && shiftKey,
      CTRL_SHIFT_ALT: ctrlKey && altKey && shiftKey,
    } as Record<string, boolean>)[hotkey] ?? false;
  }

  protected mouseenterImgView = (event: MouseEvent): void => {
    this.resetClickTimer();
    event.stopPropagation();
    event.preventDefault();
    this.getAndUpdateActiveImg(event);
  };

  protected mousedownImgView = (event: MouseEvent): void => {
    event.stopPropagation();
    event.preventDefault();
    const active = this.getAndUpdateActiveImg(event);
    if (!active || event.button !== 0) return;
    this.setClickTimer(active);
    this.setActiveImgZIndex(active);
    this.imgGlobalStatus.dragging = true;
    active.moveX = active.imgViewEl.offsetLeft - event.clientX;
    active.moveY = active.imgViewEl.offsetTop - event.clientY;
    active.imgViewEl.onmousemove = this.mousemoveImgView;
  };

  protected mousemoveImgView = (event: MouseEvent | null, offsetSize?: OffsetSizeIto): void => {
    const active = this.imgGlobalStatus.activeImg;
    if (!active) return;
    if (event) {
      if (!this.imgGlobalStatus.dragging) return;
      active.left = event.clientX + active.moveX;
      active.top = event.clientY + active.moveY;
    } else if (offsetSize) {
      active.left += offsetSize.offsetX;
      active.top += offsetSize.offsetY;
    } else return;
    active.imgViewEl.style.setProperty("margin-left", active.left + "px", "important");
    active.imgViewEl.style.setProperty("margin-top", active.top + "px", "important");
  };

  protected mouseupImgView = (event: MouseEvent): void => {
    this.imgGlobalStatus.dragging = false;
    event.preventDefault();
    event.stopPropagation();
    const active = this.imgGlobalStatus.activeImg;
    if (!active) return;
    active.imgViewEl.onmousemove = null;
    if (event.button === 2) this.menuView?.show(event, active);
  };

  protected mouseleaveImgView = (event: MouseEvent): void => {
    this.imgGlobalStatus.dragging = false;
    this.resetClickTimer();
    event.preventDefault();
    event.stopPropagation();
    const active = this.imgGlobalStatus.activeImg;
    if (active) {
      active.imgViewEl.onmousemove = null;
      this.setActiveImgForMouseEvent(null);
    }
  };

  private setClickTimer(activeImg?: ImgCto): void {
    this.imgGlobalStatus.clickCount++;
    if (this.imgGlobalStatus.clickTimer) clearTimeout(this.imgGlobalStatus.clickTimer);
    this.imgGlobalStatus.clickTimer = setTimeout(() => {
      const count = this.imgGlobalStatus.clickCount;
      this.resetClickTimer();
      if (count === 2) this.clickImgToolbar(null, this.plugin.settings.doubleClickToolbar, activeImg ?? this.imgGlobalStatus.activeImg);
    }, 200);
  }

  private resetClickTimer(): void {
    if (this.imgGlobalStatus.clickTimer) clearTimeout(this.imgGlobalStatus.clickTimer);
    this.imgGlobalStatus.clickTimer = null;
    this.imgGlobalStatus.clickCount = 0;
  }

  private getAndUpdateActiveImg(event: MouseEvent | KeyboardEvent): ImgCto | null {
    const target = event.target as HTMLImageElement | null;
    const index = target?.dataset.index;
    if (!index) return null;
    const active = this.imgInfoCto.imgList[Number.parseInt(index, 10)];
    if (active && active.index !== this.imgGlobalStatus.activeImg?.index) this.setActiveImgForMouseEvent(active);
    return active ?? null;
  }

  protected mousewheelViewContainer = (event: WheelEvent): void => {
    event.stopPropagation();
    const wheelDelta = (event as WheelEvent & {wheelDelta?: number}).wheelDelta;
    this.zoomAndRender((wheelDelta ?? -event.deltaY) > 0 ? 0.1 : -0.1, event);
  };

  protected zoomAndRender(
    ratio: number | null, event?: WheelEvent, actualSize = false, activeImg?: ImgCto | null,
  ): void {
    const active = activeImg ?? this.imgGlobalStatus.activeImg;
    if (!active?.imgViewEl) return;
    const offset = event ? {offsetX: event.offsetX, offsetY: event.offsetY} :
      {offsetX: active.curWidth / 2, offsetY: active.curHeight / 2};
    const zoom = ImgUtil.zoom(ratio, active, offset, actualSize);
    this.renderImgTip(active);
    active.imgViewEl.setAttribute("width", zoom.curWidth + "px");
    active.imgViewEl.style.setProperty("margin-top", zoom.top + "px", "important");
    active.imgViewEl.style.setProperty("margin-left", zoom.left + "px", "important");
  }

  clickImgToolbar = (event: MouseEvent | null, targetElClass?: string, activeImg?: ImgCto | null): void => {
    const active = activeImg ?? this.imgGlobalStatus.activeImg;
    const targetClass = targetElClass ?? (event?.target as HTMLElement | null)?.className;
    if (!targetClass) return;
    switch (targetClass) {
      case "toolbar_zoom_to_100": this.zoomAndRender(null, undefined, true, active); break;
      case "toolbar_zoom_in": this.zoomAndRender(0.1, undefined, false, active); break;
      case "toolbar_zoom_out": this.zoomAndRender(-0.1, undefined, false, active); break;
      case "toolbar_full_screen": this.showPlayerImg(active); break;
      case "toolbar_refresh": if (active) this.refreshImg(active); break;
      case "toolbar_rotate_left": if (active) { active.rotate -= 90; ImgUtil.transform(active); } break;
      case "toolbar_rotate_right": if (active) { active.rotate += 90; ImgUtil.transform(active); } break;
      case "toolbar_scale_x": if (active) { active.scaleX = !active.scaleX; ImgUtil.transform(active); } break;
      case "toolbar_scale_y": if (active) { active.scaleY = !active.scaleY; ImgUtil.transform(active); } break;
      case "toolbar_invert_color": if (active) { active.invertColor = !active.invertColor; ImgUtil.invertImgColor(active.imgViewEl, active.invertColor); } break;
      case "toolbar_copy": if (active) ImgUtil.copyImage(active.imgViewEl, active.curWidth, active.curHeight); break;
      case "toolbar_close": this.closeContainerView(event, active); break;
    }
  };
}
