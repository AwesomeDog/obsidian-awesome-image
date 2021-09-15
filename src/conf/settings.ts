import { App, PluginSettingTab, Setting } from 'obsidian';
import { t } from 'src/lang/helpers';
import type ImageToolkitPlugin from "src/main";
import { IMG_FULL_SCREEN_MODE } from './constants';

export interface ImageToolkitSettings {
    viewImageToggle: boolean,
    viewImageInCPB: boolean,
    viewImageWithALink: boolean
    imageMoveSpeed: number,
    imgFullScreenMode: string
    // imgActiveConflict: boolean,
}

export const DEFAULT_SETTINGS: ImageToolkitSettings = {
    viewImageToggle: true,
    viewImageInCPB: false,
    viewImageWithALink: false,
    imageMoveSpeed: 10,
    imgFullScreenMode: IMG_FULL_SCREEN_MODE.FIT
    // imgActiveConflict: false
}

export class ImageToolkitSettingTab extends PluginSettingTab {
    plugin: ImageToolkitPlugin;

    constructor(app: App, plugin: ImageToolkitPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        DEFAULT_SETTINGS.imageMoveSpeed = this.plugin.settings.imageMoveSpeed;
        DEFAULT_SETTINGS.imgFullScreenMode = this.plugin.settings.imgFullScreenMode;
    }

    display(): void {
        let { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: t("IMAGE_TOOLKIT_SETTINGS_TITLE") });

        new Setting(containerEl)
            .setName(t("VIEW_IMAGE_TOGGLE_NAME"))
            .setDesc(t("VIEW_IMAGE_TOGGLE_DESC"))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.viewImageToggle)
                .onChange(async (value) => {
                    this.plugin.settings.viewImageToggle = value;
                    this.plugin.toggleViewImage(value);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t("VIEW_IMAGE_IN_CPB_NAME"))
            .setDesc(t("VIEW_IMAGE_IN_CPB_DESC"))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.viewImageInCPB)
                .onChange(async (value) => {
                    this.plugin.settings.viewImageInCPB = value;
                    this.plugin.toggleViewImageInCPB(value);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t("VIEW_IMAGE_WITH_A_LINK_NAME"))
            .setDesc(t("VIEW_IMAGE_WITH_A_LINK_DESC"))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.viewImageWithALink)
                .onChange(async (value) => {
                    this.plugin.settings.viewImageWithALink = value;
                    await this.plugin.saveSettings();
                }));

        let scaleText: HTMLDivElement;

        new Setting(containerEl)
            .setName(t("IMAG_MOVE_SPEED_NAME"))
            .setDesc(t("IMAG_MOVE_SPEED_DESC"))
            .addSlider(slider => slider
                .setLimits(1, 30, 1)
                .setValue(this.plugin.settings.imageMoveSpeed)
                .onChange(async (value) => {
                    scaleText.innerText = " " + value.toString();
                    this.plugin.settings.imageMoveSpeed = value;
                    DEFAULT_SETTINGS.imageMoveSpeed = value;
                    this.plugin.saveSettings();
                }))
            .settingEl.createDiv('', (el) => {
                scaleText = el;
                el.style.minWidth = "2.3em";
                el.style.textAlign = "right";
                el.innerText = " " + this.plugin.settings.imageMoveSpeed.toString();
            });


        new Setting(containerEl)
            .setName(t("IMG_FULL_SCREEN_MODE_NAME"))
            .addDropdown(async (dropdown) => {
                for (const key in IMG_FULL_SCREEN_MODE) {
                    // @ts-ignore
                    dropdown.addOption(key, t(key));
                }
                dropdown.setValue(DEFAULT_SETTINGS.imgFullScreenMode);
                dropdown.onChange(async (option) => {
                    this.plugin.settings.imgFullScreenMode = option;
                    DEFAULT_SETTINGS.imgFullScreenMode = option;
                    await this.plugin.saveSettings();
                });
            });
    }

}