# Little Higgy — Windows local edition

Little Higgy customizes the MIT-licensed Open Higgsfield AI interface into a personal local studio. It does not need a Higgsfield, Kie, or Muapi account or API credits. It does not unlock their proprietary models.

## Start on your Windows PC

1. Install the current **Node.js LTS** from https://nodejs.org/ (version 22 or newer recommended).
2. Extract this folder somewhere writable, such as `Documents\LittleHiggy`. Do not run it inside the ZIP file.
3. Double-click **START-LITTLE-HIGGY.bat**. On the first run it installs the locked dependencies and builds the app. No Electron binary is downloaded.
4. When the terminal says Ready, open **http://localhost:3000/studio**. Keep the terminal open.

You can open the interface without an AI engine or key. To generate, complete the ComfyUI setup below. `localhost` on your PC means your PC: a cloud-workspace server cannot reach a ComfyUI installation on your Windows PC through localhost.

## Enable local image generation

1. Install **ComfyUI** using its official Windows guide: https://docs.comfy.org/installation/desktop/windows . The portable version is another option: https://docs.comfy.org/installation/comfyui_portable_windows . Choose a distribution appropriate for your hardware; some desktop distributions require NVIDIA hardware.
2. Add a compatible **SD 1.5 or SDXL checkpoint** (`.safetensors`) to `ComfyUI/models/checkpoints`. ComfyUI does not ship with every model. Obtain a model from its official source and follow its license. Start with SD 1.5 on hardware with less memory. Video models require substantially more resources.
3. Run ComfyUI at **http://127.0.0.1:8188** on the same PC. If it uses another local port, change `COMFYUI_URL` in the BAT file to that loopback HTTP address.
4. Open Little Higgy → **Engine settings** → **Test connection**. Select the detected checkpoint in Image Studio.
5. Enter a prompt and generate. Reference-image editing, image creation, Cinema prompt controls, seed/steps, local job history, favorites, and original-file downloads are supported.

The built-in image workflow targets standard SD 1.5 and SDXL checkpoint loaders. Flux, SD3 and diffusion-only models require a different graph and are not supported by the built-in image form. Generated assets remain in ComfyUI's output directory. Little Higgy stores job metadata and imported workflows in `little-higgy-data/`. Back up both directories; moving or deleting ComfyUI outputs breaks their history previews.

## Video and lip sync

No video or lip-sync model is bundled. These tools are **not ready for inference by default**. Video can submit an imported compatible ComfyUI API workflow using supported local nodes (including core Wan/LTX/Hunyuan nodes and local video output nodes). Node/model installation and workflow compatibility depend on your ComfyUI setup. Lip-sync-specific custom nodes are not bundled or generally supported by this initial local allowlist; that studio is a setup surface, not a working lip-sync engine out of the box.

Export your workflow in ComfyUI's **API format**. Canvas JSON (`nodes` / `links`) is not accepted. The workflow must save its output using a supported output node. In **Engine settings**, choose the workflow type and import the JSON. Import validates structure; submitting additionally checks that each node is installed and is not marked as a paid API node.

Supported placeholders in node inputs:

- `{{prompt}}`, `{{negative_prompt}}`
- `{{seed}}`, `{{width}}`, `{{height}}`, `{{frames}}`, `{{fps}}`
- `{{image}}` — the attached image's local ComfyUI input filename

A standalone placeholder preserves its numeric type where relevant. Unsupported node types, credentials, API endpoints and network URLs are rejected. Only import local workflows that you understand. No automatic fallback to a hosted paid API exists.

## What “no credits” means

The app makes generation requests only to the loopback ComfyUI server. It does not submit paid API jobs. Local inference still needs capable hardware, storage, electricity, models and time. It does not make Kling, Sora, Veo or other proprietary hosted services free. There is no subscription or inference billing in Little Higgy itself.

## Troubleshooting

- **Can't be reached:** run the BAT file on the same Windows PC where you open the browser. Wait for Ready. `http://localhost:3000/studio` does not work on another machine automatically.
- **ComfyUI not connected:** start it first, verify `http://127.0.0.1:8188` opens, and use Test connection. Check that ComfyUI and Little Higgy use the same PC and port.
- **No checkpoints:** add a compatible SD 1.5/SDXL checkpoint, restart ComfyUI, then reconnect.
- **CUDA out of memory:** start at 512×512, close other GPU applications, or choose a smaller model. CPU inference may be very slow.
- **Port 3000 in use:** stop the other app or run `npm run start -- --port 3001`, then open that port.
- **Workflow failed:** inspect the error in Little Higgy and ComfyUI's terminal. Imported workflows require their own models and supported local nodes.
- **Missing preview:** keep the original files in ComfyUI's output folder.

## Development and verification

```
npm ci
npm run test:local
npm run build
npm run start
```

The local bridge uses server-side routes. It restricts its engine URL to loopback HTTP, rejects cross-origin mutations, validates generated graphs and limits file uploads. Serve locally; no public deployment or authentication service is configured.

## GitHub Pages version

The hosted interface is at https://kakashi-sharingan.github.io/little-higgy/ . It connects directly from your browser to local ComfyUI, so it still uses your own GPU/CPU and models. Start ComfyUI with `--enable-cors-header https://kakashi-sharingan.github.io` and approve local-network access if your browser asks. Some browsers block this connection; the Windows local edition avoids that cross-origin boundary. Never expose ComfyUI to the public internet.

The hosted version stores metadata in browser localStorage rather than the Windows server's `little-higgy-data` directory. These histories are separate. Clearing browser site data removes hosted history metadata; output files remain in ComfyUI.
