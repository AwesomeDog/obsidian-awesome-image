import {App, normalizePath, Notice, PluginSettingTab, Setting, type SettingDefinitionItem} from "obsidian";
import Pickr from "@simonwep/pickr";
import safeRegex from "safe-regex";
import {t} from "../lang/helpers";
import type ImageToolkitPlugin from "../main";
import {
  GALLERY_IMG_BORDER_ACTIVE_COLOR, GALLERY_NAVBAR_DEFAULT_COLOR, GALLERY_NAVBAR_HOVER_COLOR,
  IMG_BORDER_COLOR, IMG_BORDER_STYLE, IMG_BORDER_WIDTH, IMG_DEFAULT_BACKGROUND_COLOR,
  IMG_FULL_SCREEN_MODE, MODIFIER_HOTKEYS, MOVE_THE_IMAGE, SWITCH_THE_IMAGE, TOOLBAR_CONF,
} from "./constants";
import {ImgSettingIto} from "../to/imgTo";

export const DEFAULT_SETTINGS: ImgSettingIto = {
  viewImageEditor: true, viewImageInCPB: true, viewImageWithALink: true, viewImageOther: true,
  pinMode: false, pinMaximum: 3, pinCoverMode: true,
  imageMoveSpeed: 10, imgTipToggle: true, imgFullScreenMode: IMG_FULL_SCREEN_MODE.FIT,
  imgViewBackgroundColor: IMG_DEFAULT_BACKGROUND_COLOR,
  imageBorderToggle: false, imageBorderWidth: IMG_BORDER_WIDTH.MEDIUM,
  imageBorderStyle: IMG_BORDER_STYLE.SOLID, imageBorderColor: IMG_BORDER_COLOR.RED,
  galleryNavbarToggle: true, galleryNavbarDefaultColor: GALLERY_NAVBAR_DEFAULT_COLOR,
  galleryNavbarHoverColor: GALLERY_NAVBAR_HOVER_COLOR, galleryImgBorderActive: true,
  galleryImgBorderActiveColor: GALLERY_IMG_BORDER_ACTIVE_COLOR,
  moveTheImageHotkey: MOVE_THE_IMAGE.DEFAULT_HOTKEY, switchTheImageHotkey: SWITCH_THE_IMAGE.DEFAULT_HOTKEY,
  doubleClickToolbar: TOOLBAR_CONF[3].class ?? "toolbar_full_screen",
  viewTriggerHotkey: MODIFIER_HOTKEYS.NONE,
  showExportMenu: false,
  realTimeUpdate: false, excludedFolders: [".git/", ".trash/"],
  includedFileRegex: ".*\\.md", mediaRootDirectory: "assets/img",
};

type BooleanKey = "realTimeUpdate" | "viewImageEditor" | "viewImageInCPB" | "viewImageWithALink" |
  "viewImageOther" | "pinMode" | "pinCoverMode" | "imgTipToggle" | "imageBorderToggle" |
  "galleryNavbarToggle" | "galleryImgBorderActive";
type ColorName =
  | "IMG_VIEW_BACKGROUND_COLOR_NAME" | "GALLERY_NAVBAR_DEFAULT_COLOR_NAME"
  | "GALLERY_NAVBAR_HOVER_COLOR_NAME" | "GALLERY_IMG_BORDER_ACTIVE_COLOR_NAME";

export class ImageToolkitSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: ImageToolkitPlugin) { super(app, plugin); }

  // Keep the imperative renderer for Obsidian versions before 1.13.
  override getSettingDefinitions(): SettingDefinitionItem[] { return []; }

  override display(): void {
    const {containerEl} = this;
    containerEl.empty();
    new Setting(containerEl).setName(this.plugin.manifest.name).setHeading();
    this.addOrganizationSettings(containerEl);
    new Setting(containerEl).setName(t("IMAGE_TOOLKIT_SETTINGS_TITLE")).setHeading();
    this.addViewSettings(containerEl);
    this.addPinSettings(containerEl);
    this.addDetailSettings(containerEl);
    this.addBorderSettings(containerEl);
    this.addGallerySettings(containerEl);
    this.addHotkeySettings(containerEl);
  }

  private async saveValue(key: keyof ImgSettingIto, value: unknown): Promise<void> {
    (this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
    await this.plugin.saveSettings();
  }

  private addToggle(
    container: HTMLElement, key: BooleanKey, name: string, desc?: string, after?: (value: boolean) => void,
  ): Setting {
    return new Setting(container).setName(t(name)).setDesc(desc ? t(desc) : "")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings[key]).onChange(async (value) => {
        const save = this.saveValue(key, value);
        after?.(value);
        await save;
      }));
  }

  private heading(container: HTMLElement, key: string): void {
    new Setting(container).setName(t(key)).setHeading();
  }

  private addOrganizationSettings(container: HTMLElement): void {
    new Setting(container).setName("Show export menu")
      .setDesc("Show 'Export notes with referenced images' in File Explorer context menus.")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.showExportMenu)
        .onChange((value) => this.saveValue("showExportMenu", value)));
    new Setting(container).setName("On paste processing").setDesc("Process active page if image was pasted.")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.realTimeUpdate)
        .onChange((value) => this.saveValue("realTimeUpdate", value)));
    new Setting(container).setName("Ignore folders")
      .setDesc("Do not search or rename attachments in these folders. Write each folder on a new line.")
      .addTextArea((text) => text.setPlaceholder(`Example:\n.git/\n${this.plugin.app.vault.configDir}/`)
        .setValue(this.plugin.settings.excludedFolders.join("\n"))
        .onChange((value) => this.saveValue(
          "excludedFolders", value.trim().split("\n").map((path) =>
            (path ? normalizePath(path) : path) + "/"),
        )));
    new Setting(container).setName("Include")
      .setDesc("Include only files matching this regex pattern when running on all notes.")
      .addText((text) => text.setValue(this.plugin.settings.includedFileRegex).onChange(async (value) => {
        if (!safeRegex(value)) return void new Notice("Unsafe regular expression. See safe-regex on npm.");
        await this.saveValue("includedFileRegex", value);
      }));
    new Setting(container).setName("Media folder").setDesc("Folder to keep all downloaded media files.")
      .addText((text) => text.setValue(this.plugin.settings.mediaRootDirectory)
        .onChange((value) => this.saveValue("mediaRootDirectory", value)));
  }

  private addViewSettings(container: HTMLElement): void {
    this.heading(container, "VIEW_TRIGGER_SETTINGS");
    ([
      ["viewImageEditor", "VIEW_IMAGE_EDITOR_NAME", "VIEW_IMAGE_EDITOR_DESC"],
      ["viewImageInCPB", "VIEW_IMAGE_IN_CPB_NAME", "VIEW_IMAGE_IN_CPB_DESC"],
      ["viewImageWithALink", "VIEW_IMAGE_WITH_A_LINK_NAME", "VIEW_IMAGE_WITH_A_LINK_DESC"],
      ["viewImageOther", "VIEW_IMAGE_OTHER_NAME", "VIEW_IMAGE_OTHER_DESC"],
    ] as const).forEach(([key, name, desc]) => {
      this.addToggle(container, key, name, desc, () => this.plugin.toggleViewImage());
    });
  }

  private addPinSettings(container: HTMLElement): void {
    this.heading(container, "PIN_MODE_SETTINGS");
    let maximum: Setting;
    let cover: Setting;
    this.addToggle(container, "pinMode", "PIN_MODE_NAME", "PIN_MODE_DESC", (value) => {
      this.switchSettingsDisabled(!value, maximum, cover);
      this.plugin.togglePinMode(value);
    });
    let valueEl: HTMLDivElement;
    maximum = new Setting(container).setName(t("PIN_MAXIMUM_NAME"))
      .addSlider((slider) => slider.setLimits(1, 5, 1).setValue(this.plugin.settings.pinMaximum)
        .onChange(async (value) => {
          valueEl.setText(" " + value);
          this.plugin.settings.pinMaximum = value;
          this.plugin.containerView?.setPinMaximum(value);
          await this.plugin.saveSettings();
        }));
    valueEl = maximum.settingEl.createDiv();
    Object.assign(valueEl.style, {minWidth: "2.3em", textAlign: "right"});
    valueEl.setText(" " + this.plugin.settings.pinMaximum);
    cover = this.addToggle(container, "pinCoverMode", "PIN_COVER_NAME", "PIN_COVER_DESC");
    this.switchSettingsDisabled(!this.plugin.settings.pinMode, maximum, cover);
  }

  private addDetailSettings(container: HTMLElement): void {
    this.heading(container, "VIEW_DETAILS_SETTINGS");
    let speedEl: HTMLDivElement;
    const speed = new Setting(container).setName(t("IMAGE_MOVE_SPEED_NAME")).setDesc(t("IMAGE_MOVE_SPEED_DESC"))
      .addSlider((slider) => slider.setLimits(1, 30, 1).setValue(this.plugin.settings.imageMoveSpeed)
        .onChange(async (value) => {
          speedEl.setText(" " + value);
          this.plugin.settings.imageMoveSpeed = value;
          await this.plugin.saveSettings();
        }));
    speedEl = speed.settingEl.createDiv();
    Object.assign(speedEl.style, {minWidth: "2.3em", textAlign: "right"});
    speedEl.setText(" " + this.plugin.settings.imageMoveSpeed);
    this.addToggle(container, "imgTipToggle", "IMAGE_TIP_TOGGLE_NAME", "IMAGE_TIP_TOGGLE_DESC");
    this.addOptions(container, "IMG_FULL_SCREEN_MODE_NAME", "imgFullScreenMode", IMG_FULL_SCREEN_MODE);
    this.createPickrSetting(container, "IMG_VIEW_BACKGROUND_COLOR_NAME", IMG_DEFAULT_BACKGROUND_COLOR);
  }

  private addBorderSettings(container: HTMLElement): void {
    this.heading(container, "IMAGE_BORDER_SETTINGS");
    this.addToggle(container, "imageBorderToggle", "IMAGE_BORDER_TOGGLE_NAME", "IMAGE_BORDER_TOGGLE_DESC");
    this.addOptions(container, "IMAGE_BORDER_WIDTH_NAME", "imageBorderWidth", this.optionValues(IMG_BORDER_WIDTH));
    this.addOptions(container, "IMAGE_BORDER_STYLE_NAME", "imageBorderStyle", this.optionValues(IMG_BORDER_STYLE));
    this.addOptions(container, "IMAGE_BORDER_COLOR_NAME", "imageBorderColor", this.optionValues(IMG_BORDER_COLOR));
  }

  private addGallerySettings(container: HTMLElement): void {
    this.heading(container, "GALLERY_NAVBAR_SETTINGS");
    let defaults: Setting;
    let hover: Setting;
    let border: Setting;
    let borderColor: Setting;
    this.addToggle(container, "galleryNavbarToggle", "GALLERY_NAVBAR_TOGGLE_NAME", "GALLERY_NAVBAR_TOGGLE_DESC", (value) =>
      this.switchSettingsDisabled(!value, defaults, hover, border, borderColor));
    defaults = this.createPickrSetting(container, "GALLERY_NAVBAR_DEFAULT_COLOR_NAME", GALLERY_NAVBAR_DEFAULT_COLOR);
    hover = this.createPickrSetting(container, "GALLERY_NAVBAR_HOVER_COLOR_NAME", GALLERY_NAVBAR_HOVER_COLOR);
    border = this.addToggle(container, "galleryImgBorderActive", "GALLERY_IMG_BORDER_TOGGLE_NAME", "GALLERY_IMG_BORDER_TOGGLE_DESC");
    borderColor = this.createPickrSetting(container, "GALLERY_IMG_BORDER_ACTIVE_COLOR_NAME", GALLERY_IMG_BORDER_ACTIVE_COLOR);
    this.switchSettingsDisabled(!this.plugin.settings.galleryNavbarToggle, defaults, hover, border, borderColor);
  }

  private addHotkeySettings(container: HTMLElement): void {
    this.heading(container, "HOTKEY_SETTINGS");
    container.createEl("p", {text: t("HOTKEY_SETTINGS_DESC")});
    if (this.plugin.settings.moveTheImageHotkey === this.plugin.settings.switchTheImageHotkey)
      this.plugin.settings.moveTheImageHotkey = MOVE_THE_IMAGE.DEFAULT_HOTKEY;
    if (this.plugin.settings.switchTheImageHotkey === this.plugin.settings.moveTheImageHotkey)
      this.plugin.settings.switchTheImageHotkey = SWITCH_THE_IMAGE.DEFAULT_HOTKEY;

    let moveSetting: Setting;
    let switchSetting: Setting;
    moveSetting = this.hotkeySetting(container, "MOVE_THE_IMAGE_NAME", "MOVE_THE_IMAGE_DESC",
      "moveTheImageHotkey", MOVE_THE_IMAGE.SVG, () =>
        this.checkDropdownOptions(MOVE_THE_IMAGE.CODE, switchSetting));
    switchSetting = this.hotkeySetting(container, "SWITCH_THE_IMAGE_NAME", "SWITCH_THE_IMAGE_DESC",
      "switchTheImageHotkey", SWITCH_THE_IMAGE.SVG, () =>
        this.checkDropdownOptions(SWITCH_THE_IMAGE.CODE, moveSetting));
    this.checkDropdownOptions(MOVE_THE_IMAGE.CODE, switchSetting);
    this.checkDropdownOptions(SWITCH_THE_IMAGE.CODE, moveSetting);
    this.addOptions(container, "DOUBLE_CLICK_TOOLBAR_NAME", "doubleClickToolbar",
      Object.fromEntries(TOOLBAR_CONF.filter(({enableHotKey, class: className}) => enableHotKey && className)
        .map(({class: className, title}) => [className!, title])));
    this.addOptions(container, "VIEW_TRIGGER_HOTKEY_NAME", "viewTriggerHotkey", MODIFIER_HOTKEYS,
      "VIEW_TRIGGER_HOTKEY_DESC");
  }

  private hotkeySetting(
    container: HTMLElement, name: string, desc: string, key: "moveTheImageHotkey" | "switchTheImageHotkey",
    svg: string, after: () => void,
  ): Setting {
    const setting = this.addOptions(container, name, key, this.getDropdownOptions(), desc, after, false);
    setting.controlEl.append(createDiv("setting-editor-extra-setting-button hotkeys-settings-plus", (el) => el.setText("+")));
    setting.controlEl.append(createDiv("setting-editor-extra-setting-button", (el) => {
      const parsed = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;
      el.append(el.ownerDocument.importNode(parsed, true));
    }));
    return setting;
  }

  private addOptions(
    container: HTMLElement, name: string, key: keyof ImgSettingIto, options: Record<string, string>, desc?: string,
    after?: (value: string) => void, translate = true,
  ): Setting {
    return new Setting(container).setName(t(name)).setDesc(desc ? t(desc) : "")
      .addDropdown((dropdown) => {
        dropdown.addOptions(Object.fromEntries(Object.entries(options).map(([value, label]) => [value, translate ? t(label) : label])));
        dropdown.setValue(String(this.plugin.settings[key]));
        dropdown.onChange(async (value) => {
          const save = this.saveValue(key, value);
          after?.(value);
          await save;
        });
      });
  }

  private optionValues(options: Record<string, string>): Record<string, string> {
    return Object.fromEntries(Object.entries(options).map(([key, value]) => [value, key]));
  }

  switchSettingsDisabled(disabled: boolean, ...settings: (Setting | undefined)[]): void {
    settings.forEach((setting) => {
      setting?.setDisabled(disabled);
    });
  }

  createPickrSetting(container: HTMLElement, name: ColorName, defaultColor: string): Setting {
    const key: Record<ColorName, keyof ImgSettingIto> = {
      IMG_VIEW_BACKGROUND_COLOR_NAME: "imgViewBackgroundColor",
      GALLERY_NAVBAR_DEFAULT_COLOR_NAME: "galleryNavbarDefaultColor",
      GALLERY_NAVBAR_HOVER_COLOR_NAME: "galleryNavbarHoverColor",
      GALLERY_IMG_BORDER_ACTIVE_COLOR_NAME: "galleryImgBorderActiveColor",
    };
    const setting = new Setting(container).setName(t(name));
    let pickr: Pickr;
    setting.then((current) => {
      pickr = Pickr.create({
        el: current.controlEl.createDiv({cls: "picker"}), theme: "nano", position: "left-middle",
        lockOpacity: false, default: String(this.plugin.settings[key[name]]), swatches: [],
        components: {preview: true, hue: true, opacity: true, interaction: {
          hex: true, rgba: true, hsla: false, input: true, cancel: true, save: true,
        }},
      }).on("show", (_color: Pickr.HSVaColor) => {
        if (!this.plugin.settings.galleryNavbarToggle) pickr.hide();
        const result = (pickr.getRoot() as {interaction?: {result?: HTMLInputElement}}).interaction?.result;
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => result?.select()));
      }).on("save", (color: Pickr.HSVaColor, instance: Pickr) => {
        if (!color) return;
        instance.hide();
        const saved = color.toHEXA().toString();
        instance.addSwatch(saved);
        this.setAndSavePickrSetting(name, saved);
      }).on("cancel", (instance: Pickr) => instance.hide());
    });
    setting.addExtraButton((button) => button.setIcon("reset").setTooltip("Restore default color")
      .onClick(() => {
        pickr?.setColor(defaultColor);
        this.setAndSavePickrSetting(name, defaultColor);
      }));
    return setting;
  }

  setAndSavePickrSetting(name: ColorName, color: string): void {
    const keys: Record<ColorName, keyof ImgSettingIto> = {
      IMG_VIEW_BACKGROUND_COLOR_NAME: "imgViewBackgroundColor",
      GALLERY_NAVBAR_DEFAULT_COLOR_NAME: "galleryNavbarDefaultColor",
      GALLERY_NAVBAR_HOVER_COLOR_NAME: "galleryNavbarHoverColor",
      GALLERY_IMG_BORDER_ACTIVE_COLOR_NAME: "galleryImgBorderActiveColor",
    };
    void this.saveValue(keys[name], color);
    if (name === "IMG_VIEW_BACKGROUND_COLOR_NAME")
      this.plugin.containerView?.setImgViewDefaultBackgroundForImgList();
  }

  getDropdownOptions(): Record<string, string> {
    return Object.fromEntries(Object.keys(MODIFIER_HOTKEYS).map((key) => [key, t(key)]));
  }

  checkDropdownOptions(code: string, setting?: Setting): void {
    if (code !== MOVE_THE_IMAGE.CODE && code !== SWITCH_THE_IMAGE.CODE) return;
    const select = setting?.controlEl.querySelector("select");
    if (!select) return;
    const selected = code === MOVE_THE_IMAGE.CODE
      ? this.plugin.settings.moveTheImageHotkey : this.plugin.settings.switchTheImageHotkey;
    select.querySelectorAll("option").forEach((option) => { option.disabled = option.value === selected; });
  }
}
