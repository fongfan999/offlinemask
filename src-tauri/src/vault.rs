//! Encrypted local store for private text sessions.
//!
//! One file, `sessions.vault`, holds the serialized private sessions the
//! frontend hands over. The content key is derived from the user's passcode
//! with Argon2id and the payload is sealed with XChaCha20-Poly1305; the file
//! header (format, Argon2 cost, salt, nonce) is authenticated as associated
//! data. The passcode is never stored: a forgotten passcode means the vault is
//! deleted and the user starts with an empty list, which is the documented
//! trade-off (PRD FR-06, decision 0062).

use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use zeroize::Zeroizing;

pub const FILE_NAME: &str = "sessions.vault";
const MAGIC: &[u8; 4] = b"OMV1";
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 24;
const HEADER_LEN: usize = 4 + 4 + 4 + SALT_LEN + NONCE_LEN;
/// Argon2id cost: 64 MiB, three passes, one lane. About a quarter of a second
/// on a 2020 laptop, which is fine for an unlock that happens once per launch.
const M_COST_KIB: u32 = 64 * 1024;
const T_COST: u32 = 3;
const MIN_PASSCODE_CHARS: usize = 4;

#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum VaultState {
    /// No vault file: sessions stay in memory until a passcode is set.
    None,
    /// A vault file exists and has not been opened in this launch.
    Locked,
    /// The content key is in memory; saves re-encrypt the file.
    Unlocked,
}

#[derive(Clone, Serialize)]
pub struct VaultStatus {
    pub state: VaultState,
}

/// Errors the frontend tells apart; everything else is reported as text.
#[derive(Debug, PartialEq, Eq)]
pub enum VaultError {
    WrongPasscode,
    PasscodeTooShort,
    Exists,
    Missing,
    Locked,
    Corrupt,
    Io(String),
}

impl VaultError {
    pub fn code(&self) -> String {
        match self {
            VaultError::WrongPasscode => "wrong-passcode".into(),
            VaultError::PasscodeTooShort => "passcode-too-short".into(),
            VaultError::Exists => "exists".into(),
            VaultError::Missing => "missing".into(),
            VaultError::Locked => "locked".into(),
            VaultError::Corrupt => "corrupt".into(),
            VaultError::Io(message) => format!("io:{message}"),
        }
    }
}

impl From<std::io::Error> for VaultError {
    fn from(error: std::io::Error) -> Self {
        VaultError::Io(error.to_string())
    }
}

type Key = Zeroizing<[u8; 32]>;

pub struct Vault {
    path: PathBuf,
    key: Mutex<Option<Key>>,
}

impl Vault {
    pub fn new(directory: PathBuf) -> Self {
        Self {
            path: directory.join(FILE_NAME),
            key: Mutex::new(None),
        }
    }

    pub fn status(&self) -> VaultStatus {
        let state = if self.key.lock().unwrap().is_some() {
            VaultState::Unlocked
        } else if self.path.exists() {
            VaultState::Locked
        } else {
            VaultState::None
        };
        VaultStatus { state }
    }

    /// Create the vault with `passcode` holding `data`, and keep it unlocked.
    pub fn create(&self, passcode: &str, data: &str) -> Result<(), VaultError> {
        if self.path.exists() {
            return Err(VaultError::Exists);
        }
        check_passcode(passcode)?;
        let salt = random::<SALT_LEN>()?;
        let key = derive_key(passcode, &salt)?;
        write_sealed(&self.path, &key, &salt, data.as_bytes())?;
        *self.key.lock().unwrap() = Some(key);
        Ok(())
    }

    /// Open the vault and return its content.
    pub fn unlock(&self, passcode: &str) -> Result<String, VaultError> {
        let bytes = match fs::read(&self.path) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return Err(VaultError::Missing)
            }
            Err(error) => return Err(error.into()),
        };
        let header = parse_header(&bytes)?;
        let key = derive_key_with(passcode, &header.salt, header.m_cost, header.t_cost)?;
        let plaintext = open_sealed(&bytes, &key)?;
        *self.key.lock().unwrap() = Some(key);
        String::from_utf8(plaintext).map_err(|_| VaultError::Corrupt)
    }

    /// Re-encrypt `data` with the current key under a fresh nonce.
    pub fn save(&self, data: &str) -> Result<(), VaultError> {
        let guard = self.key.lock().unwrap();
        let key = guard.as_ref().ok_or(VaultError::Locked)?;
        let salt = current_salt(&self.path)?;
        write_sealed(&self.path, key, &salt, data.as_bytes())
    }

    /// Prove the current passcode, then re-seal under a new salt and key.
    pub fn change_passcode(&self, current: &str, next: &str) -> Result<(), VaultError> {
        check_passcode(next)?;
        let bytes = fs::read(&self.path).map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                VaultError::Missing
            } else {
                error.into()
            }
        })?;
        let header = parse_header(&bytes)?;
        let old_key = derive_key_with(current, &header.salt, header.m_cost, header.t_cost)?;
        let plaintext = Zeroizing::new(open_sealed(&bytes, &old_key)?);
        let salt = random::<SALT_LEN>()?;
        let key = derive_key(next, &salt)?;
        write_sealed(&self.path, &key, &salt, &plaintext)?;
        *self.key.lock().unwrap() = Some(key);
        Ok(())
    }

    /// Delete the vault and forget the key. Used when the passcode is lost.
    pub fn reset(&self) -> Result<(), VaultError> {
        *self.key.lock().unwrap() = None;
        match fs::remove_file(&self.path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(error.into()),
        }
    }
}

struct Header {
    m_cost: u32,
    t_cost: u32,
    salt: [u8; SALT_LEN],
    nonce: [u8; NONCE_LEN],
}

fn check_passcode(passcode: &str) -> Result<(), VaultError> {
    if passcode.chars().count() < MIN_PASSCODE_CHARS {
        return Err(VaultError::PasscodeTooShort);
    }
    Ok(())
}

fn random<const N: usize>() -> Result<[u8; N], VaultError> {
    let mut bytes = [0u8; N];
    getrandom::fill(&mut bytes).map_err(|error| VaultError::Io(error.to_string()))?;
    Ok(bytes)
}

fn derive_key(passcode: &str, salt: &[u8; SALT_LEN]) -> Result<Key, VaultError> {
    derive_key_with(passcode, salt, M_COST_KIB, T_COST)
}

fn derive_key_with(
    passcode: &str,
    salt: &[u8; SALT_LEN],
    m_cost: u32,
    t_cost: u32,
) -> Result<Key, VaultError> {
    let params = Params::new(m_cost, t_cost, 1, Some(32)).map_err(|_| VaultError::Corrupt)?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = Zeroizing::new([0u8; 32]);
    argon
        .hash_password_into(passcode.as_bytes(), salt, key.as_mut())
        .map_err(|error| VaultError::Io(error.to_string()))?;
    Ok(key)
}

fn header_bytes(
    m_cost: u32,
    t_cost: u32,
    salt: &[u8; SALT_LEN],
    nonce: &[u8; NONCE_LEN],
) -> Vec<u8> {
    let mut header = Vec::with_capacity(HEADER_LEN);
    header.extend_from_slice(MAGIC);
    header.extend_from_slice(&m_cost.to_le_bytes());
    header.extend_from_slice(&t_cost.to_le_bytes());
    header.extend_from_slice(salt);
    header.extend_from_slice(nonce);
    header
}

fn parse_header(bytes: &[u8]) -> Result<Header, VaultError> {
    if bytes.len() < HEADER_LEN || &bytes[..4] != MAGIC {
        return Err(VaultError::Corrupt);
    }
    let m_cost = u32::from_le_bytes(bytes[4..8].try_into().unwrap());
    let t_cost = u32::from_le_bytes(bytes[8..12].try_into().unwrap());
    let mut salt = [0u8; SALT_LEN];
    salt.copy_from_slice(&bytes[12..12 + SALT_LEN]);
    let mut nonce = [0u8; NONCE_LEN];
    nonce.copy_from_slice(&bytes[12 + SALT_LEN..HEADER_LEN]);
    Ok(Header {
        m_cost,
        t_cost,
        salt,
        nonce,
    })
}

fn current_salt(path: &Path) -> Result<[u8; SALT_LEN], VaultError> {
    let mut head = [0u8; HEADER_LEN];
    let mut file = fs::File::open(path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            VaultError::Missing
        } else {
            error.into()
        }
    })?;
    std::io::Read::read_exact(&mut file, &mut head).map_err(|_| VaultError::Corrupt)?;
    Ok(parse_header(&head)?.salt)
}

/// Seal `plaintext` and replace the file atomically, so a crash mid-write
/// leaves the previous vault intact.
fn write_sealed(
    path: &Path,
    key: &Key,
    salt: &[u8; SALT_LEN],
    plaintext: &[u8],
) -> Result<(), VaultError> {
    let nonce = random::<NONCE_LEN>()?;
    let header = header_bytes(M_COST_KIB, T_COST, salt, &nonce);
    let cipher = XChaCha20Poly1305::new((&**key).into());
    let ciphertext = cipher
        .encrypt(
            &XNonce::from(nonce),
            Payload {
                msg: plaintext,
                aad: &header,
            },
        )
        .map_err(|_| VaultError::Io("encryption failed".into()))?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let temp = path.with_extension("vault.tmp");
    {
        let mut file = fs::File::create(&temp)?;
        file.write_all(&header)?;
        file.write_all(&ciphertext)?;
        file.sync_all()?;
    }
    fs::rename(&temp, path)?;
    Ok(())
}

fn open_sealed(bytes: &[u8], key: &Key) -> Result<Vec<u8>, VaultError> {
    let header = parse_header(bytes)?;
    let aad = header_bytes(header.m_cost, header.t_cost, &header.salt, &header.nonce);
    let cipher = XChaCha20Poly1305::new((&**key).into());
    cipher
        .decrypt(
            &XNonce::from(header.nonce),
            Payload {
                msg: &bytes[HEADER_LEN..],
                aad: &aad,
            },
        )
        .map_err(|_| VaultError::WrongPasscode)
}

#[tauri::command]
pub fn vault_status(vault: tauri::State<'_, Vault>) -> VaultStatus {
    vault.status()
}

#[tauri::command]
pub fn vault_create(
    vault: tauri::State<'_, Vault>,
    passcode: String,
    data: String,
) -> Result<(), String> {
    vault.create(&passcode, &data).map_err(|error| error.code())
}

#[tauri::command]
pub fn vault_unlock(vault: tauri::State<'_, Vault>, passcode: String) -> Result<String, String> {
    vault.unlock(&passcode).map_err(|error| error.code())
}

#[tauri::command]
pub fn vault_save(vault: tauri::State<'_, Vault>, data: String) -> Result<(), String> {
    vault.save(&data).map_err(|error| error.code())
}

#[tauri::command]
pub fn vault_change_passcode(
    vault: tauri::State<'_, Vault>,
    current: String,
    next: String,
) -> Result<(), String> {
    vault
        .change_passcode(&current, &next)
        .map_err(|error| error.code())
}

#[tauri::command]
pub fn vault_reset(vault: tauri::State<'_, Vault>) -> Result<(), String> {
    vault.reset().map_err(|error| error.code())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static SEQUENCE: AtomicUsize = AtomicUsize::new(0);

    struct TempDir(PathBuf);
    impl TempDir {
        fn new() -> Self {
            let id = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let dir = std::env::temp_dir().join(format!(
                "offlinemask-vault-{}-{id}-{}",
                std::process::id(),
                SEQUENCE.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir(&dir).unwrap();
            Self(dir)
        }
    }
    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn create_unlock_save_and_change_passcode_round_trip() {
        let dir = TempDir::new();
        let vault = Vault::new(dir.0.clone());
        assert_eq!(vault.status().state, VaultState::None);
        vault
            .create("1234", r#"{"version":1,"sessions":[]}"#)
            .unwrap();
        assert_eq!(vault.status().state, VaultState::Unlocked);
        vault.save(r#"{"version":1,"sessions":["a"]}"#).unwrap();

        let reopened = Vault::new(dir.0.clone());
        assert_eq!(reopened.status().state, VaultState::Locked);
        assert_eq!(
            reopened.unlock("0000").unwrap_err(),
            VaultError::WrongPasscode
        );
        assert_eq!(reopened.status().state, VaultState::Locked);
        assert_eq!(
            reopened.unlock("1234").unwrap(),
            r#"{"version":1,"sessions":["a"]}"#
        );
        reopened.change_passcode("1234", "mật mã mới").unwrap();

        let again = Vault::new(dir.0.clone());
        assert_eq!(again.unlock("1234").unwrap_err(), VaultError::WrongPasscode);
        assert_eq!(
            again.unlock("mật mã mới").unwrap(),
            r#"{"version":1,"sessions":["a"]}"#
        );
        assert!(!dir.0.join("sessions.vault.tmp").exists());
    }

    #[test]
    fn guards_short_passcodes_duplicates_locked_saves_and_tampering() {
        let dir = TempDir::new();
        let vault = Vault::new(dir.0.clone());
        assert_eq!(
            vault.create("123", "{}").unwrap_err(),
            VaultError::PasscodeTooShort
        );
        assert_eq!(vault.save("{}").unwrap_err(), VaultError::Locked);
        vault.create("abcd", "{}").unwrap();
        assert_eq!(vault.create("abcd", "{}").unwrap_err(), VaultError::Exists);

        // Flip a byte in the ciphertext: the authenticated header and tag reject it.
        let path = dir.0.join(FILE_NAME);
        let mut bytes = fs::read(&path).unwrap();
        let last = bytes.len() - 1;
        bytes[last] ^= 0x01;
        fs::write(&path, &bytes).unwrap();
        let reopened = Vault::new(dir.0.clone());
        assert_eq!(
            reopened.unlock("abcd").unwrap_err(),
            VaultError::WrongPasscode
        );
        fs::write(&path, b"nope").unwrap();
        assert_eq!(reopened.unlock("abcd").unwrap_err(), VaultError::Corrupt);
    }

    #[test]
    fn reset_removes_the_file_and_the_key() {
        let dir = TempDir::new();
        let vault = Vault::new(dir.0.clone());
        vault.create("passcode", "{}").unwrap();
        vault.reset().unwrap();
        assert_eq!(vault.status().state, VaultState::None);
        assert!(!dir.0.join(FILE_NAME).exists());
        assert_eq!(vault.unlock("passcode").unwrap_err(), VaultError::Missing);
        vault.reset().unwrap();
    }
}
