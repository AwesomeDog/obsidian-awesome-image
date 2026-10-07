import {App, Modal, Setting, TFile} from "obsidian";
import {formatBytes} from "../util/format";

const MAX_LISTED = 20;

/**
 * Last step before orphaned images are trashed. It is only shown for files that
 * survived the reference re-check, so nothing referenced can reach this dialog.
 */
export class DeleteConfirmModal extends Modal {
  constructor(
    app: App,
    private readonly files: TFile[],
    /** Selections dropped by the re-check because a note references them again. */
    private readonly skipped: number,
    private readonly onConfirm: (files: TFile[]) => Promise<void>,
  ) {
    super(app);
  }

  override onOpen(): void {
    const {contentEl} = this;
    contentEl.empty();
    contentEl.addClass("awesome-image-delete-modal");

    contentEl.createEl("h2", {text: "Delete orphaned images"});

    const total = this.files.reduce((sum, {stat}) => sum + stat.size, 0);
    contentEl.createEl("p", {
      text: `${this.files.length} image(s) (${formatBytes(total)}) will be moved to the trash.`,
    });

    if (this.skipped > 0) {
      contentEl.createEl("p", {
        cls: "awesome-image-delete-note",
        text: `${this.skipped} other selected image(s) are referenced by a note again and were left alone.`,
      });
    }

    contentEl.createEl("p", {
      cls: "awesome-image-delete-note",
      text: "Obsidian moves them to the trash you configured — the vault .trash folder or your system trash — so you can restore them from there.",
    });

    const list = contentEl.createEl("ul");
    list.addClass("awesome-image-delete-list");
    for (const file of this.files.slice(0, MAX_LISTED)) list.createEl("li", {text: file.path});
    const remaining = this.files.length - MAX_LISTED;
    if (remaining > 0) list.createEl("li", {text: `… and ${remaining} more`});

    new Setting(contentEl)
      .addButton((button) => button
        .setButtonText("Cancel")
        .onClick(() => this.close()))
      .addButton((button) => button
        .setButtonText(`Delete ${this.files.length} image(s)`)
        .setWarning()
        .onClick(() => {
          this.close();
          void this.onConfirm(this.files);
        }));
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}
