import {App, ButtonComponent, Modal, Notice, Setting, TFile} from "obsidian";
import {filterStillUnreferenced} from "../org/pageProcessor";
import {errorMessage, formatBytes, formatTimestamp} from "../util/format";
import {DeleteConfirmModal} from "./DeleteConfirmModal";

/**
 * Shows images that no note links to. Deleting is opt-in per row, and the
 * reference check is repeated at delete time so an image that became referenced
 * while this dialog was open is never trashed.
 */
export class OrphanImagesModal extends Modal {
  private readonly selected = new Set<TFile>();
  private checkboxes: HTMLInputElement[] = [];
  private deleteButton: ButtonComponent | null = null;
  private busy = false;

  constructor(
    app: App,
    private orphans: TFile[],
    private readonly indexSummary = "",
  ) {
    super(app);
  }

  override onOpen(): void {
    this.render();
  }

  private render(): void {
    const {contentEl} = this;
    contentEl.empty();
    contentEl.addClass("awesome-image-orphan-modal");
    this.checkboxes = [];
    this.deleteButton = null;

    contentEl.createEl("h2", {text: "Orphaned images"});

    if (this.orphans.length === 0) {
      contentEl.createEl("p", {text: "No orphaned images found."});
      this.addSummary(contentEl);
      return;
    }

    contentEl.createEl("p", {
      text: `${this.orphans.length} image(s) are not linked by any note.`,
    });

    const table = contentEl.createEl("table");
    table.addClass("awesome-image-orphan-table");

    const head = table.createEl("tr");
    const selectAll = head.createEl("th").createEl("input", {type: "checkbox"});
    selectAll.setAttribute("aria-label", "Select all orphaned images");
    selectAll.addEventListener("change", () => {
      for (const file of this.orphans) {
        if (selectAll.checked) this.selected.add(file);
        else this.selected.delete(file);
      }
      for (const checkbox of this.checkboxes) checkbox.checked = selectAll.checked;
      this.updateSelectionUi();
    });
    head.createEl("th", {text: "Path"});
    head.createEl("th", {text: "Size"});
    head.createEl("th", {text: "Modified"});

    for (const orphan of this.orphans) {
      const row = table.createEl("tr");
      const checkbox = row.createEl("td").createEl("input", {type: "checkbox"});
      checkbox.checked = this.selected.has(orphan);
      checkbox.setAttribute("aria-label", "Select " + orphan.path);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) this.selected.add(orphan);
        else this.selected.delete(orphan);
        selectAll.checked = this.orphans.every((file) => this.selected.has(file));
        this.updateSelectionUi();
      });
      this.checkboxes.push(checkbox);

      const cell = row.createEl("td");
      const link = cell.createEl("a", {text: orphan.path});
      link.href = "#";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        void this.reveal(orphan.path);
      });
      row.createEl("td", {text: formatBytes(orphan.stat.size)});
      row.createEl("td", {text: formatTimestamp(orphan.stat.mtime)});
    }

    this.addSummary(contentEl);
    contentEl.createEl("p", {
      cls: "awesome-image-orphan-summary",
      text: "Deleting moves files to the trash you configured (vault .trash folder or system trash), so they stay recoverable.",
    });

    new Setting(contentEl)
      .addButton((button) => button
        .setButtonText("Copy all paths")
        .onClick(() => {
          const paths = this.orphans.map(({path}) => path);
          const text = "----below are orphaned images----\n" +
            paths.join("\n") + "\n----end----";
          void navigator.clipboard
            .writeText(text)
            .then(() => new Notice("Orphaned image paths copied to clipboard"))
            .catch(() => new Notice("Failed to copy to clipboard"));
        }))
      .addButton((button) => {
        this.deleteButton = button;
        button.setWarning().onClick(() => void this.deleteSelected());
        this.updateSelectionUi();
      });
  }

  /** Reports what the reference index covered, so the result can be trusted. */
  private addSummary(contentEl: HTMLElement): void {
    if (!this.indexSummary) return;
    contentEl.createEl("p", {cls: "awesome-image-orphan-summary", text: this.indexSummary});
  }

  private updateSelectionUi(): void {
    const count = this.selected.size;
    this.deleteButton?.setButtonText(count ? `Delete selected (${count})` : "Delete selected");
    this.deleteButton?.setDisabled(count === 0 || this.busy);
  }

  private async deleteSelected(): Promise<void> {
    const selected = [...this.selected];
    if (!selected.length || this.busy) return;

    this.busy = true;
    this.deleteButton?.setButtonText("Re-checking references…");
    this.deleteButton?.setDisabled(true);
    try {
      // A note may have started referencing an image after this dialog opened,
      // so the vault is scanned again instead of trusting the earlier snapshot.
      const unreferenced = await filterStillUnreferenced(this.app, selected);
      const skipped = selected.length - unreferenced.length;

      if (!unreferenced.length) {
        new Notice("Nothing was deleted: every selected image is referenced by a note again.");
        this.selected.clear();
        this.render();
        return;
      }
      new DeleteConfirmModal(this.app, unreferenced, skipped, (files) => this.trashFiles(files)).open();
    } finally {
      this.busy = false;
      this.updateSelectionUi();
    }
  }

  private async trashFiles(files: TFile[]): Promise<void> {
    const trashed: TFile[] = [];
    const failures: string[] = [];
    for (const file of files) {
      try {
        await this.app.fileManager.trashFile(file);
        trashed.push(file);
      } catch (error) {
        failures.push(`${file.path}: ${errorMessage(error)}`);
      }
    }

    const trashedPaths = new Set(trashed.map(({path}) => path));
    this.orphans = this.orphans.filter(({path}) => !trashedPaths.has(path));
    for (const file of trashed) this.selected.delete(file);

    if (failures.length) {
      console.warn("Awesome Image: failed to move images to the trash\n" + failures.join("\n"));
      new Notice(`Moved ${trashed.length} image(s) to the trash, ${failures.length} failed. See the console for details.`);
    } else {
      new Notice(`Moved ${trashed.length} image(s) to the trash.`);
    }
    this.render();
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
