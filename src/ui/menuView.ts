import {Menu} from "obsidian";
import {SEPARATOR_SYMBOL, TOOLBAR_CONF} from "../conf/constants";
import {t} from "../lang/helpers";
import {ImgCto} from "../to/imgTo";
import {PinContainerView} from "./pinContainerView";

export class MenuView {
  private menu: Menu | null = null;
  private static activeImg: ImgCto | null = null;

  constructor(private readonly pinContainerView: PinContainerView) {}

  private init(): void {
    if (this.menu) return;
    this.menu = new Menu();
    TOOLBAR_CONF.filter(({enableMenu}) => enableMenu).forEach((config) => {
      if (config.title === SEPARATOR_SYMBOL) {
        this.menu!.addSeparator();
        return;
      }
      this.menu!.addItem((item) => {
        if (config.icon) item.setIcon(config.icon);
        item.setTitle(t(config.title)).onClick(() =>
          this.pinContainerView.clickImgToolbar(null, config.class, MenuView.activeImg));
      });
    });
  }

  show(event: MouseEvent, activeImg: ImgCto): void {
    MenuView.activeImg = activeImg;
    this.init();
    this.menu!.showAtPosition({x: event.clientX, y: event.clientY});
  }
}
