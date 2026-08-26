export interface OffsetSizeIto {
  offsetX: number;
  offsetY: number;
}

export class FileCto {
  constructor(
    public path = "",
    public ctime = 0,
    public mtime = 0,
  ) {}
}
