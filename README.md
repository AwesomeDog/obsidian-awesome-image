# Awesome Image

A one-stop solution for image management together
with [Obsidian Image Toolkit](https://github.com/sissilab/obsidian-image-toolkit)'s marvelous image view experience.

## Design philosophy

- **Always available**. No internet? No problem. Your images live completely offline, internet or service issues will
  never be your problem.
- **Center management**. Images no more scatter around, which leads to outdated links and useless files.
- **Just enough automation**. Auto process pasted image, but let you know all that happened.

## Features

- 💾 Command to copy images to a user-defined folder with a uniform name, and update links in your notes.
- 🔗 Auto download internet images.
- ⚡ Auto process image the second you paste it, whether it's from internet or is binary format.
- 🔎 Command to list all images that are not linked by your notes, which can be deleted manually.

## How to use

**IMPORTANT NOTE** Since the plugin can modify your notes, please back up your vault for the first time, to ensure the
plugin is acting the way you want.

The best way to use this plugin is toggle on `On paste processing` in settings and then
run `Awesome Image: Process images for all your notes` once.
After that, all your images will be in good hands.

You may also want to toggle *OFF* `Use [[Wikilinks]]` under `Files & Links` since only Markdown links is supported now.

Below are all commands it offers:

1. Press `Ctrl+P` (or `Cmd+P` on macOS) to open the Command palette.
2. Type the name (or partial name) of the command you want to run.
3. Navigate to the command using the arrow keys.
4. Press Enter.

The command names are:

1. `Awesome Image: Process images for active file`
2. `Awesome Image: Process images for all your notes`
3. `Awesome Image: List images that are not linked by your notes`

To see results of `List images that are not linked by your notes`, you may want to open Developer Tools by pressing
Ctrl+Shift+I in Windows and Linux, or Cmd-Option-I on macOS.

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

Keep the version in `manifest.json`, `package.json`, and `versions.json` synchronized, commit the changes, and push an
annotated tag with the same version. Pushing the tag starts the GitHub Actions release workflow, which builds the
plugin and creates a draft release with `main.js`, `manifest.json`, and `styles.css` attached.

```shell
git tag -a 0.1.4 -m "0.1.4"
git push origin 0.1.4
```

Review the draft release and publish it manually after adding release notes.

## How it works

When Process images:

1. Locate the image using regex in notes.
2. Get image from binary data or from internet(if it is an url), calc the SHA256 hash of the image.
3. Copy image file to user-defined folder, image file name is derived from SHA256 to avoid conflict.
4. Change the image path in note to direct to the new image file.
5. The old image will NOT be deleted for data security reasons, you can find them using the command below.

When List images:
Compare image files and links in your notes, and display images that are not linked by your notes in Developer Tools
console.

When Paste image:
Acts just like Process images for pasted content but automated (ensure `On paste processing` is toggled on in settings).

## Attribution

Special thanks to sissilab's marvelous [Obsidian Image Toolkit](https://github.com/sissilab/obsidian-image-toolkit),
the plugin is based on this great work.
