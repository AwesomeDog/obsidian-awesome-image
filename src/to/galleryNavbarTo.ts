import {FileCto} from "./commonTo";

export class GalleryImgCto {
  alt = "";
  src = "";
  name?: string | null;
  convert?: boolean;
  hash?: string;
  link?: boolean;
  match?: RegExpMatchArray | null;

  constructor(alt = "", src = "") {
    this.alt = alt;
    this.src = src;
  }
}

export class GalleryImgCacheCto {
  constructor(
    public file = new FileCto(),
    public galleryImgList: GalleryImgCto[] = [],
    public mtime = 0,
  ) {}
}
