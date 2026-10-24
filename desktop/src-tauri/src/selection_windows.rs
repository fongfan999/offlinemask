//! Windows backend of the selection popover (decision 0096). A low-level mouse hook
//! (WH_MOUSE_LL) sees left-button presses and releases; after a drag or double click
//! the focused element is asked, through UI Automation's text pattern, for its
//! selection and that selection's screen rectangles. Password fields and this app's
//! own windows are skipped. The same look tells a quick action's paste whether it
//! landed (decision 0133). No permission is involved; applications running elevated
//! are shielded by Windows and simply give no popover. The circle only reads in an AI
//! place (decision 0135): a listed AI application, by its executable, or a page on a
//! listed AI host in a known browser; any other application is not asked anything.
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Runtime};
use windows::core::Interface;
use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM, LRESULT, POINT, WPARAM};
use windows::Win32::Graphics::Gdi::{MonitorFromPoint, MONITOR_DEFAULTTONEAREST};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
    COINIT_APARTMENTTHREADED, SAFEARRAY,
};
use windows::Win32::System::Ole::{
    SafeArrayAccessData, SafeArrayDestroy, SafeArrayGetUBound, SafeArrayUnaccessData,
};
use windows::Win32::System::Threading::{
    GetCurrentProcessId, OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
    PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::System::Variant::{VariantClear, VT_BOOL};
use windows::Win32::UI::Accessibility::{
    CUIAutomation, IUIAutomation, IUIAutomation2, IUIAutomationElement, IUIAutomationTextPattern,
    IUIAutomationTextRange, IUIAutomationValuePattern, UIA_DocumentControlTypeId,
    UIA_IsReadOnlyAttributeId, UIA_TextPatternId, UIA_ValuePatternId,
};
use windows::Win32::UI::HiDpi::{GetDpiForMonitor, MDT_EFFECTIVE_DPI};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, GetDoubleClickTime, VK_LBUTTON,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetAncestor, GetCursorPos, GetForegroundWindow, GetMessageW,
    GetWindowThreadProcessId, SetWindowsHookExW, TranslateMessage, WindowFromPoint, GA_ROOT, HHOOK,
    MSG, MSLLHOOKSTRUCT, WH_MOUSE_LL, WM_LBUTTONDOWN, WM_LBUTTONUP,
};

use crate::selection::{
    emit_cleared, emit_made, may_look, spot_for, usable, Gesture, Point, Probe, Read, Rect,
    Selection, SETTLE_MS,
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
        // The window under the pointer is WebView2's render child, owned by the
        // msedgewebview2 process; its top-level window is ours. Without the root, a
        // click on the circle counted as a click elsewhere and cleared the selection
        // just before the circle's command arrived (decision 0122).
        let hwnd: HWND = GetAncestor(WindowFromPoint(point), GA_ROOT);
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

/// Run `work` with UI Automation on this thread, COM initialised and uninitialised around it.
fn with_automation<T>(work: impl FnOnce(&IUIAutomation) -> Option<T>) -> Option<T> {
    // SAFETY: COM calls on a thread we initialise and uninitialise ourselves.
    unsafe {
        let init = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let result = CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER)
            .ok()
            .and_then(|automation: IUIAutomation| work(&automation));
        if init.is_ok() {
            CoUninitialize();
        }
        result
    }
}
/// The focused element of another application, or None for one of ours.
unsafe fn foreign_focus(automation: &IUIAutomation) -> Option<IUIAutomationElement> {
    let element = automation.GetFocusedElement().ok()?;
    (element.CurrentProcessId().ok()? as u32 != GetCurrentProcessId()).then_some(element)
}
/// The first selected range of the element's text pattern.
unsafe fn selected_range(element: &IUIAutomationElement) -> Option<IUIAutomationTextRange> {
    let pattern: IUIAutomationTextPattern = element.GetCurrentPatternAs(UIA_TextPatternId).ok()?;
    let ranges = pattern.GetSelection().ok()?;
    if ranges.Length().ok()? < 1 {
        return None;
    }
    ranges.GetElement(0).ok()
}
/// The text's own read-only attribute: Some(false) inside editable content (a web
/// editor, a Word document), Some(true) in read-only text, None when the application
/// does not say or the range is mixed.
unsafe fn range_read_only(range: &IUIAutomationTextRange) -> Option<bool> {
    let mut value = range.GetAttributeValue(UIA_IsReadOnlyAttributeId).ok()?;
    let inner = &value.Anonymous.Anonymous;
    let read_only = (inner.vt == VT_BOOL).then(|| inner.Anonymous.boolVal.as_bool());
    // Mixed and unsupported come back as an object, released here.
    let _ = VariantClear(&mut value);
    read_only
}

/// A process's executable, lowercased ("chrome.exe"), and its name as shown ("Zalo"), or
/// None when Windows does not say (an elevated process, one that just ended).
fn process_app(pid: u32) -> Option<(String, String)> {
    // SAFETY: a handle opened for a limited query and closed before returning.
    unsafe {
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buffer = [0u16; 1024];
        let mut length = buffer.len() as u32;
        let read = QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_WIN32,
            windows::core::PWSTR(buffer.as_mut_ptr()),
            &mut length,
        );
        let _ = CloseHandle(process);
        read.ok()?;
        let path = String::from_utf16_lossy(&buffer[..length as usize]);
        let file = path.rsplit(['\\', '/']).next()?.to_string();
        let name = file
            .rsplit_once('.')
            .map_or(file.as_str(), |(stem, _)| stem)
            .to_string();
        Some((file.to_lowercase(), name))
    }
}
/// The application owning the foreground window.
fn foreground_app() -> Option<(String, String)> {
    // SAFETY: plain queries; a null window yields process id 0.
    unsafe {
        let mut pid = 0u32;
        GetWindowThreadProcessId(GetForegroundWindow(), Some(&mut pid));
        (pid != 0).then_some(pid).and_then(process_app)
    }
}
/// Far enough for the deepest composer seen on macOS (25 levels in Dia).
const MAX_ANCESTORS: usize = 80;
/// The common dialog class: open, save and the folder picker (decision 0135).
const DIALOG_CLASS: &str = "#32770";
/// What lies above the focused element: the address of the outermost document holding
/// it (the tab's own page; Chromium gives a document's address as its value), and
/// whether it sits in a common dialog, where files are named and saved.
unsafe fn surroundings(
    automation: &IUIAutomation,
    element: &IUIAutomationElement,
) -> (Option<String>, bool) {
    let mut page = None;
    let mut dialog = false;
    let Ok(walker) = automation.ControlViewWalker() else {
        return (None, false);
    };
    let mut node = Some(element.clone());
    for _ in 0..MAX_ANCESTORS {
        let Some(current) = node.take() else {
            break;
        };
        if current.CurrentControlType().ok() == Some(UIA_DocumentControlTypeId) {
            if let Some(address) = current
                .GetCurrentPatternAs::<IUIAutomationValuePattern>(UIA_ValuePatternId)
                .ok()
                .and_then(|value| value.CurrentValue().ok())
                .map(|value| value.to_string())
                .filter(|value| value.starts_with("http"))
            {
                page = Some(address);
            }
        }
        dialog |= current
            .CurrentClassName()
            .is_ok_and(|class| class == DIALOG_CLASS);
        node = walker.GetParentElement(&current).ok();
    }
    (page, dialog)
}

/// The selection of the front application. With `gate` (the circle), only in an AI
/// place; without it (⌘⇧M, which the user asked for), anywhere.
fn read_selection(at: POINT, gate: bool) -> Option<Read> {
    if gate && !foreground_app().is_some_and(|(app, _)| may_look(&app)) {
        return None;
    }
    with_automation(|automation| {
        // SAFETY: COM calls on the thread `with_automation` initialised.
        unsafe {
            let element = foreign_focus(automation)?;
            if element.CurrentIsPassword().ok()?.as_bool() {
                return None;
            }
            let app = element
                .CurrentProcessId()
                .ok()
                .and_then(|pid| process_app(pid as u32));
            let (page, dialog) = surroundings(automation, &element);
            let spot = spot_for(
                app.as_ref().map(|(app, _)| app.as_str()),
                app.as_ref().map(|(_, name)| name.as_str()),
                page.as_deref(),
                dialog,
            );
            if gate && !spot.listed {
                return None;
            }
            let range = selected_range(&element)?;
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
                .map(|rect| (rect, false))
                .or_else(|| {
                    let frame = element.CurrentBoundingRectangle().ok()?;
                    let rect = Rect {
                        x: frame.left as f64,
                        y: frame.top as f64,
                        width: (frame.right - frame.left) as f64,
                        height: (frame.bottom - frame.top) as f64,
                    };
                    (rect.width > 0.0 && rect.height > 0.0).then_some((rect, true))
                })
                .map(|(rect, field)| {
                    let rect = Rect {
                        x: rect.x / scale,
                        y: rect.y / scale,
                        width: rect.width / scale,
                        height: rect.height / scale,
                    };
                    (rect, field)
                });
            // An editable field exposes a value pattern that is not read-only. A web
            // editor or a Word document may not (decision 0132's Zalo box has none on
            // macOS), but its text says it is not read-only (decision 0133). Anything
            // else (web pages, an AI's answer) counts as read-only.
            let editable = element
                .GetCurrentPatternAs::<IUIAutomationValuePattern>(UIA_ValuePatternId)
                .ok()
                .and_then(|value| value.CurrentIsReadOnly().ok())
                .is_some_and(|read_only| !read_only.as_bool())
                || range_read_only(&range) == Some(false);
            Some((text, bounds, editable, spot))
        }
    })
}

/// The focused element's value (where it has a value pattern) and selected text, to
/// see whether a paste changed anything (decisions 0131, 0133). None when the element
/// is ours or offers neither, so nothing can be seen.
pub fn focused_state<R: Runtime>(_app: &AppHandle<R>) -> Option<(Option<String>, Option<String>)> {
    with_automation(|automation| {
        // SAFETY: COM calls on the thread `with_automation` initialised.
        unsafe {
            // A hung application must not hold up the paste for UIA's default 20 s.
            if let Ok(automation) = automation.cast::<IUIAutomation2>() {
                let _ = automation.SetTransactionTimeout(200);
            }
            let element = foreign_focus(automation)?;
            let value = element
                .GetCurrentPatternAs::<IUIAutomationValuePattern>(UIA_ValuePatternId)
                .ok()
                .and_then(|pattern| pattern.CurrentValue().ok())
                .map(|value| value.to_string());
            let selection =
                match element.GetCurrentPatternAs::<IUIAutomationTextPattern>(UIA_TextPatternId) {
                    // A collapsed selection is an empty range, or no range at all.
                    Ok(_) => Some(
                        selected_range(&element)
                            .and_then(|range| range.GetText(-1).ok())
                            .map(|text| text.to_string())
                            .unwrap_or_default(),
                    ),
                    Err(_) => None,
                };
            (value.is_some() || selection.is_some()).then_some((value, selection))
        }
    })
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
                            if let (Some(shared), Some((text, bounds, editable, spot))) =
                                (SHARED.get(), read_selection(physical, true))
                            {
                                (shared.made)(Selection {
                                    text,
                                    field: bounds.as_ref().is_some_and(|(_, field)| *field),
                                    bounds: bounds.map(|(rect, _)| rect),
                                    mouse: true,
                                    pointer: at,
                                    editable,
                                    place: spot.place,
                                    listed: spot.listed,
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

/// One look for the keyboard poller (`gate`: AI places only) or ⌘⇧M; no permission is
/// involved on Windows.
pub fn probe<R: Runtime>(_app: &AppHandle<R>, gate: bool) -> Probe {
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
        match read_selection(physical, gate) {
            Some((text, bounds, editable, spot)) => Probe::Found(Selection {
                text,
                field: bounds.as_ref().is_some_and(|(_, field)| *field),
                bounds: bounds.map(|(rect, _)| rect),
                mouse: false,
                pointer,
                editable,
                place: spot.place,
                listed: spot.listed,
            }),
            None => Probe::Nothing,
        }
    }
}
