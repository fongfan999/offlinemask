//! How much this machine can take on at once, for masking a folder (decision 0171): its
//! processor count and its installed memory. Both are read from the system, nothing is
//! stored or sent, and a figure the system does not give is `None`.

#[derive(serde::Serialize)]
pub struct Resources {
    cores: usize,
    memory: Option<u64>,
}

#[tauri::command]
pub fn machine_resources() -> Resources {
    Resources {
        cores: std::thread::available_parallelism().map_or(1, |n| n.get()),
        memory: installed_memory(),
    }
}

#[cfg(target_os = "macos")]
fn installed_memory() -> Option<u64> {
    use std::ffi::{c_char, c_int, c_void};
    extern "C" {
        fn sysctlbyname(
            name: *const c_char,
            old: *mut c_void,
            old_len: *mut usize,
            new: *mut c_void,
            new_len: usize,
        ) -> c_int;
    }
    let mut bytes: u64 = 0;
    let mut len = std::mem::size_of::<u64>();
    // SAFETY: the name is NUL-terminated and `bytes` is a u64 of the length passed.
    let status = unsafe {
        sysctlbyname(
            c"hw.memsize".as_ptr(),
            (&mut bytes as *mut u64).cast(),
            &mut len,
            std::ptr::null_mut(),
            0,
        )
    };
    (status == 0 && bytes > 0).then_some(bytes)
}

#[cfg(windows)]
fn installed_memory() -> Option<u64> {
    #[repr(C)]
    struct MemoryStatus {
        length: u32,
        load: u32,
        total_physical: u64,
        available_physical: u64,
        total_page_file: u64,
        available_page_file: u64,
        total_virtual: u64,
        available_virtual: u64,
        available_extended_virtual: u64,
    }
    #[link(name = "kernel32")]
    extern "system" {
        fn GlobalMemoryStatusEx(status: *mut MemoryStatus) -> i32;
    }
    // SAFETY: the struct is MEMORYSTATUSEX's layout with its length filled in.
    let mut status: MemoryStatus = unsafe { std::mem::zeroed() };
    status.length = std::mem::size_of::<MemoryStatus>() as u32;
    let ok = unsafe { GlobalMemoryStatusEx(&mut status) } != 0;
    (ok && status.total_physical > 0).then_some(status.total_physical)
}

#[cfg(not(any(target_os = "macos", windows)))]
fn installed_memory() -> Option<u64> {
    let info = std::fs::read_to_string("/proc/meminfo").ok()?;
    let line = info.lines().find(|line| line.starts_with("MemTotal:"))?;
    let kib: u64 = line.split_whitespace().nth(1)?.parse().ok()?;
    Some(kib * 1024)
}

#[cfg(test)]
mod tests {
    #[test]
    fn reports_this_machine() {
        let resources = super::machine_resources();
        assert!(resources.cores >= 1);
        assert!(resources.memory.is_some_and(|bytes| bytes >= 1 << 30));
    }
}
