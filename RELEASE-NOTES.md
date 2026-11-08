Little Higgy v1.1.0 — automated local Windows setup

Download Little-Higgy-Windows.zip and extract it. Double-click SETUP-LOCAL-REQUIREMENTS.bat once; later runs use START-LITTLE-HIGGY.bat.

The installer adds a private Node.js 24 LTS runtime, official ComfyUI portable, and a SHA256-verified SD 1.5 image checkpoint. It tests NVIDIA/CUDA and falls back to CPU. Existing global software and drivers are not changed. The first download is roughly 6–7 GB plus app dependencies; allow about 20 GB of free disk space.

No API credits, subscriptions or provider keys are needed. Local inference uses your own hardware and electricity. This setup enables Image/Cinema; video requires a separate local workflow and lip-sync-specific nodes are not bundled. Model license details are in MODEL-LICENSES.md.

Windows helper tests exercise parsing, checksums, download reuse, local port allocation and archive extraction. Full multi-gigabyte downloads and GPU inference have not been run on your PC by this chat.

Hosted interface: https://kakashi-sharingan.github.io/little-higgy/
