//! The pinned ONNX Runtime library for each qualified desktop target (decision 0077).
//! Bytes come from the lockfile-resolved `onnxruntime-node` 1.24.3 package; the release
//! scripts verify the same values before bundling (`scripts/native-runtimes.json`).
// Release builds check the signed bundle (macOS) or compiled-in resource hashes
// (Windows) instead of this pin, so only the library name is used there.
#![cfg_attr(feature = "recognition-native-release", allow(dead_code))]

#[cfg(target_os = "macos")]
pub const LIBRARY: &str = "libonnxruntime.1.24.3.dylib";
#[cfg(target_os = "macos")]
pub const BYTES: u64 = 35_937_208;
#[cfg(target_os = "macos")]
pub const SHA256: &str = "76831409ce6eded92b4cb343cf422c458a60c1ea1d5f3cfa69692ab7fcc67f0f";

#[cfg(target_os = "windows")]
pub const LIBRARY: &str = "onnxruntime.dll";
#[cfg(target_os = "windows")]
pub const BYTES: u64 = 23_850_016;
#[cfg(target_os = "windows")]
pub const SHA256: &str = "4bc168111012971ae1ffef36c1f29c06b026d17e9063bd17f6390359fbe32a84";

// Other targets keep the WASM backend; naming a library there would be a guess.
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub const LIBRARY: &str = "unsupported";
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub const BYTES: u64 = 0;
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub const SHA256: &str = "";
