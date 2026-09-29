# ONNX Runtime 1.24.3 provenance

Runtime: the macOS arm64 dylib in the lockfile-resolved `onnxruntime-node@1.24.3` package, used by pinned Transformers.js 4.2.0. Its exact size and SHA-256 are in `scripts/native-prototype/runtime-manifest.json`; the desktop preparation script verifies them before staging. No developer-machine absolute path is required.

Unmodified notices were retrieved from the matching upstream tag on 21 September 2026:

- https://github.com/microsoft/onnxruntime/blob/v1.24.3/LICENSE
- https://github.com/microsoft/onnxruntime/blob/v1.24.3/ThirdPartyNotices.txt

The full upstream third-party notice is retained rather than guessing which portions to delete. These files are bundled locally under `Contents/Resources/licenses/onnxruntime-1.24.3`. `ort` and `ort-sys` 2.0.0-rc.10 license files alongside this directory come from the Cargo.lock-resolved crates. This is provenance for the added runtime; it does not settle the project's outstanding license/public distribution decisions or constitute a completed audit of all application dependencies.
