# Little Higgy — Windows local edition

Little Higgy customizes the MIT-licensed Open Higgsfield AI interface into a personal local studio. It does not need a Higgsfield, Kie, or Muapi account or API credits. It does not unlock their proprietary models.

## Automatic setup on your Windows PC (recommended)

1. Download and extract the latest Windows source ZIP. Open the extracted `LittleHiggy` folder; do not run it inside the ZIP viewer.
2. Double-click **SETUP-LOCAL-REQUIREMENTS.bat**.
3. Leave the setup window open. It installs a private Node.js 24 LTS runtime, official ComfyUI portable, and a pinned SD 1.5 image checkpoint, installs the app's locked dependencies, builds the studio, starts both services, and opens your browser.
4. On later runs, double-click **START-LITTLE-HIGGY.bat**. Keep the ComfyUI and studio windows open while generating.

The first setup downloads approximately 6–7 GB plus app dependencies and needs about 20 GB free. It supports x64 Intel/AMD Windows 10/11, uses `%LOCALAPPDATA%\LittleHiggy` for runtimes/model files, and does not change global PATH, drivers, or an existing Python/Node installation. It verifies download SHA256 hashes. Windows' built-in tar extracts the ComfyUI archive; if your Windows tar cannot, setup asks for 7-Zip. No administrator privileges are requested by Little Higgy itself.

An actual CUDA allocation test selects NVIDIA GPU mode when usable; otherwise setup chooses CPU. CPU rendering can be very slow. The supplied SD 1.5 checkpoint covers Image/Cinema, not video or lip sync. See `MODEL-LICENSES.md` for the model license and exact checksum. No paid service, account, or provider key is installed.

If ComfyUI is already running on port 8188 with checkpoints, setup reuses it without changing its installation or models. Checkpoint compatibility remains your responsibility in that case. To force CPU mode during initial setup, run `powershell -NoProfile -ExecutionPolicy Bypass -File windows/Setup-Local.ps1 -CPU` from the extracted folder. `-NoLaunch` installs/builds without opening services.

If a large download is interrupted, rerun setup to resume it. Checksum mismatches are rejected. Existing installations are not upgraded in place; a corrupt/partial engine is retained for you to rename before retrying.

`localhost` means the computer running the apps. A cloud workspace cannot install these requirements onto your PC automatically; you must run the downloaded setup file on Windows once.

## Manual setup (optional)

Install Node.js LTS 22 or newer, run `npm ci`, `npm run build`, then `npm run start` in this folder. Run ComfyUI separately as described below. Open `http://localhost:3000/studio` on the same PC.

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
