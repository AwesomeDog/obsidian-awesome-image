import {addIcon, MarkdownView, Notice, Plugin, TFile, TFolder} from "obsidian";
import {DEFAULT_SETTINGS, ImageToolkitSettingTab} from "./conf/settings";
import {ICONS, VIEW_IMG_SELECTOR} from "./conf/constants";
import {findOrphanImages, processAllPages, processPage} from "./org/pageProcessor";
import {ensureFolderExists, isLocalImage, pathDirname} from "./org/utils";
import {OB_PASTED_IMAGE_PREFIX} from "./org/constants";
import {getNewFileName} from "./org/contentProcessor";
import {ContainerView} from "./ui/containerView";
import {MainContainerView} from "./ui/mainContainerView";
import {PinContainerView} from "./ui/pinContainerView";
import {ImgSettingIto} from "./to/imgTo";
import {OrphanImagesModal} from "./ui/OrphanImagesModal";
import {ImageProcessingFailuresModal} from "./ui/ImageProcessingFailuresModal";
import {exportSelection} from "./org/exporter";

function confirmImageProcessing(scope: string, mediaRootDirectory: string): boolean {
  const message = [
    "Awesome Image is about to process images.",
    `Scope: ${scope}`,
    "",
    "What will happen:",
    "1. Read Markdown image links in the selected notes.",
    "2. Download external image URLs when needed.",
    "3. Create or reuse files below the configured Media folder:",
    `   ${mediaRootDirectory}`,
    "   using a SHA-256 filename and three nested hash folders.",
    "   This nested layout is an intentional storage best practice.",
    "4. Rewrite the matching image links in those notes.",
    "",
    "Existing source images are not deleted.",
    "There is no plugin-level bulk undo or rollback for changed links.",
    "If anything is unclear, cancel and back up your vault first.",
    "",
    "Continue?",
  ].join("\n");
  return window.confirm(message);
}

export default class ImageToolkitPlugin extends Plugin {
  override settings: ImgSettingIto = {} as ImgSettingIto;
  containerView: ContainerView | null = null;
  imgSelector = "";
  exportRootInProgress: string | null = null;

  override async onload(): Promise<void> {
    console.log("loading " + this.manifest.id + " plugin v" + this.manifest.version + " ...");
    await this.loadSettings();
    this.registerDomEvent(activeDocument, "click", this.nativeClickImage, true);
    this.addCommand({
      id: "process-images-active",
      name: "Process images for active file",
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return;
        const extension = file.extension.toLowerCase();
        if (extension === "canvas") {
          new Notice('Canvas file "' + file.path + '" is not supported for image processing.');
          return;
        }
        if (extension !== "md") return;
        if (!confirmImageProcessing(
          `the active note ("${file.path}")`, this.settings.mediaRootDirectory,
        )) return;
        const failures = await processPage(this, file);
        if (failures.length) new ImageProcessingFailuresModal(this.app, failures).open();
      },
    });
    this.addCommand({
      id: "process-images-all",
      name: "Process images for all your notes",
      callback: async () => {
        if (!confirmImageProcessing(
          "all your notes (subject to Include and Ignore folders settings)",
          this.settings.mediaRootDirectory,
        )) return;
        const failures = await processAllPages(this);
        if (failures.length) new ImageProcessingFailuresModal(this.app, failures).open();
      },
    });
    this.addCommand({
      id: "list-orphan-images",
      name: "List images that are not linked by your notes",
      callback: async () => {
        const orphans = await findOrphanImages(this);
        new OrphanImagesModal(this.app, orphans).open();
      },
    });
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file, source) => {
      if (!this.settings.showExportMenu ||
          (source !== "file-explorer-context-menu" && source !== "file-explorer") ||
          (!(file instanceof TFolder) && !(file instanceof TFile))) return;
      if (file instanceof TFile && file.extension.toLowerCase() !== "md") return;
      menu.addSeparator();
      menu.addItem((item) => item
        .setTitle("Export notes with referenced images")
        .setIcon("images")
        .onClick(() => void exportSelection(this, file)));
    }));

    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(this.app.vault.on("create", async (file) => {
        const exportRoot = this.exportRootInProgress;
        if ((exportRoot && (file.path === exportRoot || file.path.startsWith(exportRoot + "/"))) ||
            !this.settings.realTimeUpdate || !(file instanceof TFile) ||
            Date.now() - file.stat.ctime > 1000 ||
            !isLocalImage(file.name) || !file.name.startsWith(OB_PASTED_IMAGE_PREFIX)) return;

        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension.toLowerCase() !== "md") return;

        const oldFileName = file.path;
        const fileData = await this.app.vault.readBinary(file);
        const {newFileName, isDuplicated} = await getNewFileName(
          this.app, this.settings.mediaRootDirectory, fileData,
        );
        if (isDuplicated) {
          const message = "IMAGE Duplicated! OPEN CONSOLE! FROM |" + file.path +
            "| TO |" + newFileName + "|, please edit manually";
          new Notice(message);
          console.warn(message);
          return;
        }

        const linkText = this.app.fileManager.generateMarkdownLink(file, activeFile.path);
        await ensureFolderExists(this.app, pathDirname(newFileName));
        await this.app.fileManager.renameFile(file, newFileName);

        const newLinkText = this.app.fileManager.generateMarkdownLink(file, activeFile.path);
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view?.file || view.file.path !== activeFile.path) {
          new Notice("Failed to rename " + newFileName + ": no active editor");
          return;
        }
        const editor = view.editor;
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        editor.transaction({
          changes: [{
            from: {...cursor, ch: 0},
            to: {...cursor, ch: line.length},
            text: line.replace(linkText, newLinkText),
          }],
        });
        new Notice("Renamed " + oldFileName + " to " + newFileName);
      }));
    });

    this.addSettingTab(new ImageToolkitSettingTab(this.app, this));
    this.initContainerView(this.settings.pinMode);
    this.toggleViewImage();
  }

  override onunload(): void {
    console.log("unloading obsidian-image-toolkit plugin...");
    this.containerView?.removeOitContainerView();
    if (this.imgSelector) {
      document.off("click", this.imgSelector, this.clickImage);
      document.off("mouseover", this.imgSelector, this.mouseoverImg);
      document.off("mouseout", this.imgSelector, this.mouseoutImg);
    }
    this.containerView = null;
    this.imgSelector = "";
  }

  async loadSettings(): Promise<void> {
    this.settings = {...DEFAULT_SETTINGS, ...(await this.loadData() ?? {})};
    const configDir = this.app.vault.configDir.replace(/\/+$/, "") + "/";
    this.settings.excludedFolders = [...new Set([...this.settings.excludedFolders, configDir])];
    this.addIcons();
  }

  saveSettings(): Promise<void> {
    return this.saveData(this.settings);
  }

  private addIcons(): void {
    ICONS.forEach(({id, svg}) => addIcon(id, svg));
  }

  private initContainerView(pinMode: boolean): void {
    this.containerView = pinMode
      ? new PinContainerView(this, "PIN")
      : new MainContainerView(this, "MAIN");
  }

  togglePinMode(pinMode: boolean): void {
    this.containerView?.removeOitContainerView();
    this.initContainerView(pinMode);
  }

  private clickImage = (event: MouseEvent): void => {
    const target = event.target as HTMLImageElement | null;
    if (!target || target.tagName !== "IMG" || !this.containerView ||
        !this.containerView.checkHotkeySettings(event, this.settings.viewTriggerHotkey)) return;
    this.containerView.renderContainerView(target);
  };

  private nativeClickImage = (event: MouseEvent): void => {
    const target = event.target as HTMLImageElement | null;
    if (!target || target.tagName !== "IMG" || !this.imgSelector ||
        target.closest?.(".oit-main-container-view, .oit-pin-container-view")) return;
    try {
      if (!target.matches?.(this.imgSelector)) return;
    } catch {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    this.clickImage(event);
  };

  private mouseoverImg = (event: MouseEvent): void => {
    const target = event.target as HTMLImageElement | null;
    if (!target || target.tagName !== "IMG") return;
    if (target.getAttribute("data-oit-default-cursor") === null)
      target.setAttribute("data-oit-default-cursor", target.style.cursor);
    target.setCssProps({cursor: "zoom-in"});
  };

  private mouseoutImg = (event: MouseEvent): void => {
    const target = event.target as HTMLImageElement | null;
    if (!target || target.tagName !== "IMG") return;
    target.setCssProps({cursor: target.getAttribute("data-oit-default-cursor") ?? ""});
  };

  toggleViewImage(): void {
    if (this.imgSelector) {
      document.off("click", this.imgSelector, this.clickImage);
      document.off("mouseover", this.imgSelector, this.mouseoverImg);
      document.off("mouseout", this.imgSelector, this.mouseoutImg);
      this.imgSelector = "";
    }
    const {viewImageEditor, viewImageInCPB, viewImageWithALink, viewImageOther} = this.settings;
    if (!viewImageEditor && !viewImageInCPB && !viewImageOther) return;
    const selector = [
      viewImageEditor && (viewImageWithALink ? VIEW_IMG_SELECTOR.EDITOR_AREAS : VIEW_IMG_SELECTOR.EDITOR_AREAS_NO_LINK),
      viewImageInCPB && (viewImageWithALink ? VIEW_IMG_SELECTOR.CPB : VIEW_IMG_SELECTOR.CPB_NO_LINK),
      viewImageOther && (viewImageWithALink ? VIEW_IMG_SELECTOR.OTHER : VIEW_IMG_SELECTOR.OTHER_NO_LINK),
    ].filter(Boolean).join(",");
    if (!selector) return;
    this.imgSelector = selector;
    activeDocument.on("click", selector, this.clickImage);
    activeDocument.on("mouseover", selector, this.mouseoverImg);
    activeDocument.on("mouseout", selector, this.mouseoutImg);
  }
}
