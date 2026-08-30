import {App, Modal, Notice, Setting, TFile} from "obsidian";

/**
 * Shows images that no note links to while keeping the existing copy action
 * available inside the modal.
 */
export class OrphanImagesModal extends Modal {
  constructor(app: App, private readonly orphans: TFile[]) {
    super(app);
  }

  override onOpen(): void {
    const {contentEl} = this;
    contentEl.empty();
    contentEl.addClass("awesome-image-orphan-modal");

    contentEl.createEl("h2", {text: "Orphaned images"});

    if (this.orphans.length === 0) {
      contentEl.createEl("p", {text: "No orphaned images found."});
      return;
    }

    contentEl.createEl("p", {
      text: `${this.orphans.length} image(s) are not linked by any note.`,
    });

    const table = contentEl.createEl("table");
    table.addClass("awesome-image-orphan-table");

    const head = table.createEl("tr");
    head.createEl("th", {text: "Path"});
    head.createEl("th", {text: "Size"});

    for (const orphan of this.orphans) {
      const row = table.createEl("tr");
      const cell = row.createEl("td");
      const link = cell.createEl("a", {text: orphan.path});
      link.href = "#";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        void this.reveal(orphan.path);
      });
      row.createEl("td", {text: formatBytes(orphan.stat.size)});
    }

    new Setting(contentEl).addButton((button) =>
      button
        .setButtonText("Copy all paths")
        .onClick(() => {
          const paths = this.orphans.map(({path}) => path);
          const text = "----below are orphaned images----\n" +
            paths.join("\n") + "\n----end----";
          void navigator.clipboard
            .writeText(text)
            .then(() => new Notice("Orphaned image paths copied to clipboard"))
            .catch(() => new Notice("Failed to copy to clipboard"));
        })
    );
  }

  private async reveal(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) {
      new Notice(`File no longer exists: ${path}`);
      return;
    }
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file as TFile);
    this.close();
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
