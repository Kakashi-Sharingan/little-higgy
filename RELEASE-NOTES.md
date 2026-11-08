Little Higgy is a personal creative studio that uses local ComfyUI models without provider API credits.

- Hosted studio: https://kakashi-sharingan.github.io/little-higgy/
- Windows: download Little-Higgy-Windows.zip, extract it, install Node.js LTS, and run START-LITTLE-HIGGY.bat.
- Image/Cinema generation needs ComfyUI plus a compatible SD 1.5 or SDXL checkpoint on your PC. Video needs an imported supported local workflow; lip-sync-specific nodes are not bundled or generally supported yet.
- The hosted interface connects from your browser to local ComfyUI; GitHub Pages does not host GPU inference. Read the README for CORS and browser local-network settings.
- No models or GPU runtime are included in this source package. Hardware, electricity and model licensing requirements still apply.

Verified: 9 local adapter tests, Windows/server build, Pages static build, and browser protocol-fixture checks for submission, history, favorites and downloads. Real model inference and the Windows launcher have not been tested on a Windows GPU here.
