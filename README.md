# Awesome Image

A one-stop solution for image management together
with [Obsidian Image Toolkit](https://github.com/sissilab/obsidian-image-toolkit)'s marvelous image view experience.

## Design philosophy

- **Always available**. No internet? No problem. Your images live completely offline, internet or service issues will
  never be your problem.
- **Center management**. Images no more scatter around, which leads to outdated links and useless files.
- **Just enough automation**. Auto process pasted image, but let you know all that happened.

## Features

- Zoom in or out an image by mouse wheel or clicking toolbar zoom icons
- Move an image by dragging mouse cursor or pressing keyboard arrow keys
- Preview an image in full-screen mode
- Rotate or flip an image by clicking footer toolbar icons
- Invert the color of an image
- Copy an image
- Process local and internet images into a single, content-addressed media folder and update Markdown links.
- Export a note or folder with its referenced local images while preserving vault-relative paths and leaving originals unchanged.
- 🔗 Auto download internet images.
- ⚡ Auto process image the second you paste it, whether it's from internet or is binary format.
- 🔎 Command to list all images that are not linked by your notes; review the list before deleting anything manually.

## Normal Mode

When you turn off 'Pin an image' on the settings page, it's in **Normal Mode**.

![normal_mode_screenshot](./example/normal_mode_screenshot.png)

**Rule**:
- After clicking the image, the image will be popped up with transparent mask layer on the background
- You can only click and preview one image at a time
- You cannot edit and look through your notes, or other operations except to view and operate the image in the Normal Mode

**Gallery Navbar**:
- All the images in the current note will be displayed at the bottom, and you can switch these thumbs to view any image
- To be able to use this functionality, you need to turn on 'display gallery navbar' on the plugin settings page
- The background color of the gallery navbar and the border color the selected image can be set on the plugin settings page

**Exit**:
- Click the outside of the image
- Press Esc
> If it's in full-screen mode, you need to exit full-screen mode firstly, then exit the image preview page and close popup layer.

## Image processing

Image processing is the part of the plugin that normalizes image links and stores image bytes in the configured
`Media folder` (the default is `assets/img`). It is separate from the image preview controls described above.

> **Back up first.** Processing changes Markdown note text and creates files and folders in the vault. There is no
> plugin-level undo. If this is your first run, or you are unsure what a setting does, cancel the confirmation and make
> a copy or snapshot of the entire vault (for example with Git, a filesystem backup, or Obsidian Sync/version history).

### What processing does

For each supported Markdown image link (`![alt text](image.png)`) in the selected scope, the plugin:

1. Reads the local image bytes, or downloads the image when the link is an HTTP(S) URL.
2. Calculates a SHA-256 hash of those bytes. The hash becomes the stable filename, with an extension detected from the
   image content.
3. Creates or reuses the file under the `Media folder`.
4. Rewrites that image link in the processed note to point to the new file.

The source file for an existing local image is copied, not deleted. If the same bytes are encountered again, the
existing hash-named file is reused. Unsupported or unresolved links are left unchanged. Errors encountered while
reading, downloading, or saving an image are shown in the processing-failures dialog when applicable.

### Storage layout

The output is deliberately sharded by the first three characters of the hash. This nested layout is an intentional
storage best practice: it keeps a large media collection manageable while giving every image a predictable location.
The layout is:

```text
<Media folder>/<first hash character>/<second>/<third>/<full 64-character SHA-256>.<extension>
```

For example, an image whose hash starts with `74c` may be stored as:

```text
assets/img/7/4/c/74c2e1...9ab3.png
```

Here `...` only abbreviates the middle of the complete 64-character hash.

### Before and after

The following text example is illustrative. The exact hash and extension depend on the image bytes and your `Media
folder`.

**Before processing**

```text
My vault/
|-- Notes/
|   `-- Travel.md
`-- Photos/
    |-- sunset.jpg
    `-- map.png

Notes/Travel.md
----------------
![](../Photos/sunset.jpg)
![](https://example.com/map.png)
```

The note points at an image in its original folder and at an external URL.

**After processing**

```text
My vault/
|-- Notes/
|   `-- Travel.md
|-- Photos/
|   `-- sunset.jpg                 (original is kept)
`-- assets/img/
    |-- 7/4/c/74c2e1...png         (local image copy)
    `-- d/2/a/d2a91f...png         (downloaded URL)

Notes/Travel.md
----------------
![](assets/img/7/4/c/74c2e1...png)
![](assets/img/d/2/a/d2a91f...png)
```

The local image is copied into the hash layout, the external image is downloaded there, and the note links are updated.
The original local image remains in its original folder.

### Scope and settings

- `Process images for active file` processes the active Markdown note only. Canvas and other file types are skipped.
- `Process images for all your notes` processes Markdown files matching `Include` and skips notes below `Ignore folders`.
- `Media folder` is the root of the generated hash layout. Changing it affects future processing; it does not move old
  files automatically.
- `On paste processing` automatically moves and renames newly pasted `Pasted image ...` files in the active Markdown
  note. This automatic path does not show the batch confirmation, so make the backup before enabling it.
- The processing commands currently recognize Markdown image links. Wikilinks such as `![[image.png]]` are not
  rewritten by these commands.

To run a command, open the Command palette with `Ctrl+P` (or `Cmd+P` on macOS), search for `Awesome Image`, and press
Enter. The available commands are:

1. `Awesome Image: Process images for active file`
2. `Awesome Image: Process images for all your notes`
3. `Awesome Image: List images that are not linked by your notes`

`List images that are not linked by your notes` only reports candidates. It opens a dialog with paths and sizes, lets
you open an item or copy all paths, and does not delete anything.

### Export without rewriting

Enable `Show export menu` in the plugin settings to right-click a Markdown file or folder in the File Explorer and
choose `Export notes with referenced images`. Enter a vault-relative destination folder when prompted. This separate
export action recursively copies the selected notes and their referenced local images while preserving each file's
original vault path. It leaves the source notes, links, and images unchanged, and never overwrites an existing
destination file.

### Reverting a run

There is no automatic reverse operation. The safest way to revert is to restore the affected notes from the vault copy,
Git history, or another version-history system. Because original local images are retained, do not delete the generated
media folder until you have restored links and confirmed that no notes still reference those files. The orphan-image
command is a report, not a cleanup or rollback command.

For a cautious first run:

1. Back up or snapshot the vault.
2. Set and note the desired `Media folder`.
3. Process one small test note and inspect both the note link and the created folders.
4. Run the all-notes command only after the result is what you expect.

## Development

Development requires Node.js 22 or newer. Install dependencies, run the checks and build the plugin, then deploy the
generated files directly to a local vault:

```shell
npm install
npm test
npm run build
npm run deploy -- "C:/path/to/your/vault"
```

The vault path can also be provided through the `OBSIDIAN_VAULT` environment variable. The deploy command installs
`main.js`, `manifest.json`, and `styles.css` under `.obsidian/plugins/awesome-image/`. Enable **Awesome Image** in
Obsidian's community plugins after the first deployment. Restart Obsidian after changing `manifest.json`; for source
changes, rebuild and reload the plugin.

## Release

Use npm's version command to update `package.json`, `package-lock.json`,
`manifest.json`, and `versions.json`, then push the generated commit and tag
(tags intentionally have no `v` prefix):

```bash
npm version patch
git push origin master --follow-tags
```

The release branch for this repository is `master`.

Pushing the tag starts the release workflow. It checks the version, builds the
plugin, and creates a draft GitHub release containing `main.js`,
`manifest.json`, and `styles.css` for review and publication.

## Attribution

Special thanks to sissilab's marvelous [Obsidian Image Toolkit](https://github.com/sissilab/obsidian-image-toolkit),
the plugin is based on this great work.
