export type Timer = ReturnType<Window["setTimeout"]>;

export class ImgStatusCto {
  popup = false;
  dragging = false;
  arrowUp = false;
  arrowDown = false;
  arrowLeft = false;
  arrowRight = false;
  fullScreen = false;
  activeImg: ImgCto | null = null;
  activeImgZIndex = 0;
  clickCount = 0;
  clickTimer: Timer | null = null;
}

export interface ImgInfoIto {
  oitContainerViewEl: HTMLDivElement;
  imgViewEl: HTMLImageElement;
  imgTitleEl: HTMLDivElement;
  imgTipEl: HTMLDivElement;
  imgTipTimeout?: Timer;
  imgFooterEl: HTMLElement;
  imgPlayerEl: HTMLDivElement;
  imgPlayerImgViewEl: HTMLImageElement;
  curWidth: number;
  curHeight: number;
  realWidth: number;
  realHeight: number;
  left: number;
  top: number;
  moveX: number;
  moveY: number;
  rotate: number;
  invertColor: boolean;
  scaleX: boolean;
  scaleY: boolean;
  fullScreen: boolean;
}

export class ImgInfoCto {
  oitContainerViewEl: HTMLDivElement | null = null;
  imgContainerEl: HTMLDivElement | null = null;
  imgViewEl: HTMLImageElement | null = null;
  imgTitleEl: HTMLDivElement | null = null;
  imgTitleNameEl: HTMLSpanElement | null = null;
  imgTitleIndexEl: HTMLSpanElement | null = null;
  imgTipEl: HTMLDivElement | null = null;
  imgTipTimeout: Timer | null = null;
  imgFooterEl: HTMLElement | null = null;
  imgPlayerEl: HTMLDivElement | null = null;
  imgPlayerImgViewEl: HTMLImageElement | null = null;
  imgList: ImgCto[] = [];

  getPopupImgNum(): number {
    return this.imgList.filter(({popup}) => popup).length;
  }
}

export class ImgCto {
  popup = false;
  zIndex = 0;
  curWidth = 0;
  curHeight = 0;
  realWidth = 0;
  realHeight = 0;
  left = 0;
  top = 0;
  moveX = 0;
  moveY = 0;
  rotate = 0;
  invertColor = false;
  scaleX = false;
  scaleY = false;
  fullScreen = false;
  targetOriginalImgEl: HTMLImageElement | null = null;
  imgViewEl: HTMLImageElement;
  refreshImgInterval: Timer | null = null;
  defaultImgStyle: Pick<CSSStyleDeclaration, "transform" | "filter" | "mixBlendMode" | "borderWidth" | "borderStyle" | "borderColor"> = {
    transform: "none",
    filter: "none",
    mixBlendMode: "normal",
    borderWidth: "",
    borderStyle: "",
    borderColor: "",
  };

  constructor(public index = 0, public mtime = 0, imgViewEl?: HTMLImageElement) {
    this.imgViewEl = imgViewEl!;
  }
}

export interface ImgSettingIto {
  viewImageEditor: boolean;
  viewImageInCPB: boolean;
  viewImageWithALink: boolean;
  viewImageOther: boolean;
  pinMode: boolean;
  pinMaximum: number;
  pinCoverMode: boolean;
  imageMoveSpeed: number;
  imgTipToggle: boolean;
  imgFullScreenMode: string;
  imgViewBackgroundColor: string;
  imageBorderToggle: boolean;
  imageBorderWidth: string;
  imageBorderStyle: string;
  imageBorderColor: string;
  galleryNavbarToggle: boolean;
  galleryNavbarDefaultColor: string;
  galleryNavbarHoverColor: string;
  galleryImgBorderActive: boolean;
  galleryImgBorderActiveColor: string;
  moveTheImageHotkey: string;
  switchTheImageHotkey: string;
  doubleClickToolbar: string;
  viewTriggerHotkey: string;
  showExportMenu: boolean;
  realTimeUpdate: boolean;
  excludedFolders: string[];
  includedFileRegex: string;
  mediaRootDirectory: string;
}
