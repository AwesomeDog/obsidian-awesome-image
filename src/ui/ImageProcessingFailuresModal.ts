import {App, Modal, Notice, Setting, TFile} from "obsidian";
import type {ImageProcessingFailure} from "../org/contentProcessor";

export class ImageProcessingFailuresModal extends Modal {
  constructor(app: App, private readonly failures: ImageProcessingFailure[]) {
    super(app);
  }

  override onOpen(): void {
    const {contentEl} = this;
    contentEl.empty();
    contentEl.addClass("awesome-image-processing-failures-modal");

    contentEl.createEl("h2", {text: "Image processing failures"});
    contentEl.createEl("p", {
      text: `${this.failures.length} image(s) failed to process.`,
    });

    const table = contentEl.createEl("table");
    table.addClass("awesome-image-processing-failures-table");

    const head = table.createEl("tr");
    head.createEl("th", {text: "Note"});
    head.createEl("th", {text: "Image link"});

    for (const failure of this.failures) {
      const row = table.createEl("tr");
      const noteCell = row.createEl("td");
      const noteLink = noteCell.createEl("a", {text: failure.notePath});
      noteLink.href = "#";
      noteLink.addEventListener("click", (event) => {
        event.preventDefault();
        void this.reveal(failure.notePath);
      });
      row.createEl("td", {text: failure.link});
    }

    new Setting(contentEl).addButton((button) =>
      button
        .setButtonText("Copy all failures")
        .onClick(() => {
          const text = this.failures
            .map(({notePath, link}) => notePath + "\t" + link)
            .join("\n");
          void navigator.clipboard
            .writeText(text)
            .then(() => new Notice("Failed image list copied to clipboard"))
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
    if (!(file instanceof TFile)) {
      new Notice(`File is not a regular file: ${path}`);
      return;
    }
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
    this.close();
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}
