//! Windows backend of the selection popover (decision 0096). A low-level mouse hook
//! (WH_MOUSE_LL) sees left-button presses and releases; after a drag or double click
//! the focused element is asked, through UI Automation's text pattern, for its
//! selection and that selection's screen rectangles. Password fields and this app's
//! own windows are skipped. No permission is involved; applications running elevated
//! are shielded by Windows and simply give no popover.
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Runtime};
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, WPARAM};
use windows::Win32::Graphics::Gdi::{MonitorFromPoint, MONITOR_DEFAULTTONEAREST};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
    COINIT_APARTMENTTHREADED, SAFEARRAY,
};
use windows::Win32::System::Ole::{
    SafeArrayAccessData, SafeArrayDestroy, SafeArrayGetUBound, SafeArrayUnaccessData,
};
use windows::Win32::System::Threading::GetCurrentProcessId;
use windows::Win32::UI::Accessibility::{
    CUIAutomation, IUIAutomation, IUIAutomationTextPattern, IUIAutomationValuePattern,
    UIA_TextPatternId, UIA_ValuePatternId,
};
use windows::Win32::UI::HiDpi::{GetDpiForMonitor, MDT_EFFECTIVE_DPI};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, GetDoubleClickTime, VK_LBUTTON,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetCursorPos, GetMessageW, GetWindowThreadProcessId,
    SetWindowsHookExW, TranslateMessage, WindowFromPoint, HHOOK, MSG, MSLLHOOKSTRUCT, WH_MOUSE_LL,
    WM_LBUTTONDOWN, WM_LBUTTONUP,
};

use crate::selection::{
    emit_cleared, emit_made, usable, Gesture, Point, Probe, Rect, Selection, SETTLE_MS,
};

/// What the hook procedure needs: it is a plain function with no context argument.
struct Shared {
    enabled: Arc<AtomicBool>,
    gesture: Mutex<Gesture>,
    last_up: Mutex<u64>,
    cleared: Box<dyn Fn() + Send + Sync>,
    made: Box<dyn Fn(Selection) + Send + Sync>,
}
static SHARED: OnceLock<Shared> = OnceLock::new();

pub fn supported() -> bool {
    true
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Logical points from physical pixels, per the monitor under the point.
fn scale_at(point: POINT) -> f64 {
    // SAFETY: plain queries on a screen coordinate.
    unsafe {
        let monitor = MonitorFromPoint(point, MONITOR_DEFAULTTONEAREST);
        let (mut dpi_x, mut dpi_y) = (96u32, 96u32);
        if GetDpiForMonitor(monitor, MDT_EFFECTIVE_DPI, &mut dpi_x, &mut dpi_y).is_ok() && dpi_x > 0
        {
            dpi_x as f64 / 96.0
        } else {
            1.0
        }
    }
}
fn own_window(point: POINT) -> bool {
    // SAFETY: plain queries; a null window yields process id 0.
    unsafe {
        let hwnd: HWND = WindowFromPoint(point);
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        pid == GetCurrentProcessId()
    }
}

/// First rectangle of the selection, in physical pixels, from UIA's SAFEARRAY of doubles.
unsafe fn first_rect(array: *mut SAFEARRAY) -> Option<Rect> {
    if array.is_null() {
        return None;
    }
    let count = SafeArrayGetUBound(array, 1)
        .map(|upper| upper + 1)
        .unwrap_or(0);
    let mut data: *mut core::ffi::c_void = std::ptr::null_mut();
    let rect = if count >= 4 && SafeArrayAccessData(array, &mut data).is_ok() {
        let values = std::slice::from_raw_parts(data as *const f64, count as usize);
        let rect = Rect {
            x: values[0],
            y: values[1],
            width: values[2],
            height: values[3],
        };
        let _ = SafeArrayUnaccessData(array);
        (rect.width > 0.0 && rect.height > 0.0).then_some(rect)
    } else {
        None
    };
    let _ = SafeArrayDestroy(array);
    rect
}

fn read_selection(at: POINT) -> Option<(String, Option<Rect>, bool)> {
    // SAFETY: COM calls on a thread we initialise and uninitialise ourselves.
    unsafe {
        let init = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let result = (|| {
            let automation: IUIAutomation =
                CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER).ok()?;
            let element = automation.GetFocusedElement().ok()?;
            if element.CurrentProcessId().ok()? as u32 == GetCurrentProcessId() {
                return None;
            }
            if element.CurrentIsPassword().ok()?.as_bool() {
                return None;
            }
            let pattern: IUIAutomationTextPattern =
                element.GetCurrentPatternAs(UIA_TextPatternId).ok()?;
            let ranges = pattern.GetSelection().ok()?;
            if ranges.Length().ok()? < 1 {
                return None;
            }
            let range = ranges.GetElement(0).ok()?;
            let text = range.GetText(-1).ok()?.to_string();
            if !usable(&text) {
                return None;
            }
            let scale = scale_at(at);
            // The selection's own rectangles, else the frame of the element holding it,
            // so the circle sits by the text rather than by the pointer (decision 0096).
            let bounds = range
                .GetBoundingRectangles()
                .ok()
                .and_then(|array| first_rect(array))
                .or_else(|| {
                    let frame = element.CurrentBoundingRectangle().ok()?;
                    let rect = Rect {
                        x: frame.left as f64,
                        y: frame.top as f64,
                        width: (frame.right - frame.left) as f64,
                        height: (frame.bottom - frame.top) as f64,
                    };
                    (rect.width > 0.0 && rect.height > 0.0).then_some(rect)
                })
                .map(|rect| Rect {
                    x: rect.x / scale,
                    y: rect.y / scale,
                    width: rect.width / scale,
                    height: rect.height / scale,
                });
            // An editable field exposes a value pattern that is not read-only; anything
            // else (documents, web pages, an AI's answer) counts as read-only.
            let editable = element
                .GetCurrentPatternAs::<IUIAutomationValuePattern>(UIA_ValuePatternId)
                .ok()
                .and_then(|value| value.CurrentIsReadOnly().ok())
                .is_some_and(|read_only| !read_only.as_bool());
            Some((text, bounds, editable))
        })();
        if init.is_ok() {
            CoUninitialize();
        }
        result
    }
}

unsafe extern "system" fn hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 {
        if let Some(shared) = SHARED.get() {
            // SAFETY: for WH_MOUSE_LL, lparam points at an MSLLHOOKSTRUCT.
            let info = &*(lparam.0 as *const MSLLHOOKSTRUCT);
            let physical = info.pt;
            let scale = scale_at(physical);
            let at = Point {
                x: physical.x as f64 / scale,
                y: physical.y as f64 / scale,
            };
            let enabled = shared.enabled.load(Ordering::Relaxed);
            let ours = own_window(physical);
            match wparam.0 as u32 {
                WM_LBUTTONDOWN => {
                    if let Ok(mut gesture) = shared.gesture.lock() {
                        gesture.pressed(at);
                    }
                    if enabled && !ours {
                        (shared.cleared)();
                    }
                }
                WM_LBUTTONUP => {
                    let now = now_ms();
                    let clicks = match shared.last_up.lock() {
                        Ok(mut last) => {
                            let double =
                                now.saturating_sub(*last) <= u64::from(GetDoubleClickTime());
                            *last = now;
                            if double {
                                2
                            } else {
                                1
                            }
                        }
                        Err(_) => 1,
                    };
                    let gesture = shared
                        .gesture
                        .lock()
                        .map(|mut gesture| gesture.released(at, clicks))
                        .unwrap_or(false);
                    if gesture && enabled && !ours {
                        let enabled = shared.enabled.clone();
                        thread::spawn(move || {
                            thread::sleep(Duration::from_millis(SETTLE_MS));
                            if !enabled.load(Ordering::Relaxed) {
                                return;
                            }
                            if let (Some(shared), Some((text, bounds, editable))) =
                                (SHARED.get(), read_selection(physical))
                            {
                                (shared.made)(Selection {
                                    text,
                                    bounds,
                                    pointer: at,
                                    editable,
                                });
                            }
                        });
                    }
                }
                _ => {}
            }
        }
    }
    CallNextHookEx(None, code, wparam, lparam)
}

/// Install the hook on its own thread with a message loop; it lives for the process.
pub fn start<R: Runtime>(app: AppHandle<R>, enabled: Arc<AtomicBool>) {
    let cleared_app = app.clone();
    let made_app = app;
    let shared = Shared {
        enabled,
        gesture: Mutex::new(Gesture::default()),
        last_up: Mutex::new(0),
        cleared: Box::new(move || emit_cleared(&cleared_app)),
        made: Box::new(move |selection| emit_made(&made_app, selection)),
    };
    if SHARED.set(shared).is_err() {
        return;
    }
    thread::spawn(|| {
        // SAFETY: a global low-level hook with our own procedure, pumped on this thread.
        unsafe {
            let Ok(_hook): Result<HHOOK, _> = SetWindowsHookExW(WH_MOUSE_LL, Some(hook), None, 0)
            else {
                return;
            };
            let mut message = MSG::default();
            while GetMessageW(&mut message, None, 0, 0).as_bool() {
                let _ = TranslateMessage(&message);
                DispatchMessageW(&message);
            }
        }
    });
}

/// One look for the keyboard poller (no permission involved on Windows).
pub fn probe<R: Runtime>(_app: &AppHandle<R>) -> Probe {
    // SAFETY: plain queries of the mouse button and the cursor.
    unsafe {
        if GetAsyncKeyState(i32::from(VK_LBUTTON.0)) as u16 & 0x8000 != 0 {
            return Probe::MouseDown;
        }
        let mut physical = POINT::default();
        if GetCursorPos(&mut physical).is_err() {
            return Probe::Nothing;
        }
        let scale = scale_at(physical);
        let pointer = Point {
            x: physical.x as f64 / scale,
            y: physical.y as f64 / scale,
        };
        match read_selection(physical) {
            Some((text, bounds, editable)) => Probe::Found(Selection {
                text,
                bounds,
                pointer,
                editable,
            }),
            None => Probe::Nothing,
        }
    }
}
