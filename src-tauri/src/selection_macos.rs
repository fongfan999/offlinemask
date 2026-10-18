//! macOS backend of the selection popover (decision 0096). A global NSEvent monitor
//! sees left-button presses and releases in other applications (never keys; macOS
//! delivers no events of this app itself). After a drag or multi-click the focused
//! element is asked, through the Accessibility API, for its selected text and the
//! selection's screen rectangle. Both calls fail without the Accessibility permission,
//! and nothing is read for secure (password) fields or this app.
use std::ffi::c_void;
use std::ptr::NonNull;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use block2::RcBlock;
use core_foundation::base::{CFType, CFTypeRef, TCFType};
use core_foundation::string::{CFString, CFStringRef};
use objc2::MainThreadMarker;
use objc2_app_kit::{NSEvent, NSEventMask, NSEventType, NSScreen, NSWorkspace};
use tauri::{AppHandle, Manager, Runtime};

use crate::selection::{
    emit_cleared, emit_made, usable, Gesture, Point, Rect, Selection, SETTLE_MS,
};

#[repr(C)]
struct OpaqueAXUIElement {
    _private: [u8; 0],
}
type AXUIElementRef = *const OpaqueAXUIElement;
type AXError = i32;
const AX_SUCCESS: AXError = 0;
/// `kAXValueTypeCGRect`.
const AX_VALUE_CGRECT: u32 = 3;
#[repr(C)]
#[derive(Clone, Copy, Default)]
struct CGRectRaw {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXUIElementCreateApplication(pid: i32) -> AXUIElementRef;
    fn AXUIElementCopyAttributeValue(
        element: AXUIElementRef,
        attribute: CFStringRef,
        value: *mut CFTypeRef,
    ) -> AXError;
    fn AXUIElementCopyParameterizedAttributeValue(
        element: AXUIElementRef,
        attribute: CFStringRef,
        parameter: CFTypeRef,
        value: *mut CFTypeRef,
    ) -> AXError;
    fn AXUIElementGetPid(element: AXUIElementRef, pid: *mut i32) -> AXError;
    fn AXUIElementIsAttributeSettable(
        element: AXUIElementRef,
        attribute: CFStringRef,
        settable: *mut u8,
    ) -> AXError;
    fn AXValueGetValue(value: CFTypeRef, value_type: u32, out: *mut c_void) -> bool;
    fn AXIsProcessTrusted() -> bool;
}

pub fn supported() -> bool {
    true
}

/// One attribute of an element, retained (+1) and owned by the returned CFType.
fn attribute(element: AXUIElementRef, name: &str) -> Option<CFType> {
    let key = CFString::new(name);
    let mut value: CFTypeRef = std::ptr::null();
    // SAFETY: valid element and key; the out pointer receives a +1 reference or stays null.
    let status =
        unsafe { AXUIElementCopyAttributeValue(element, key.as_concrete_TypeRef(), &mut value) };
    if status != AX_SUCCESS || value.is_null() {
        return None;
    }
    // SAFETY: AX copy functions return an owned reference.
    Some(unsafe { CFType::wrap_under_create_rule(value) })
}
fn parameterized(element: AXUIElementRef, name: &str, parameter: &CFType) -> Option<CFType> {
    let key = CFString::new(name);
    let mut value: CFTypeRef = std::ptr::null();
    // SAFETY: as above, with a borrowed parameter the call does not keep.
    let status = unsafe {
        AXUIElementCopyParameterizedAttributeValue(
            element,
            key.as_concrete_TypeRef(),
            parameter.as_CFTypeRef(),
            &mut value,
        )
    };
    if status != AX_SUCCESS || value.is_null() {
        return None;
    }
    // SAFETY: owned reference, see `attribute`.
    Some(unsafe { CFType::wrap_under_create_rule(value) })
}
fn string(value: &CFType) -> Option<String> {
    value.downcast::<CFString>().map(|text| text.to_string())
}

/// The frontmost application's focused element and its selection, or None when there
/// is nothing usable. The application is addressed by process id: asking the
/// system-wide element for the focused element answers "cannot complete" from a
/// process like this one, while the per-application element answers.
/// Whether an attribute of the element can be written, which is how Accessibility tells
/// an editable field from read-only text.
fn settable(element: AXUIElementRef, name: &str) -> bool {
    let key = CFString::new(name);
    let mut value: u8 = 0;
    // SAFETY: valid element and key; the flag is written on success.
    let status =
        unsafe { AXUIElementIsAttributeSettable(element, key.as_concrete_TypeRef(), &mut value) };
    status == AX_SUCCESS && value != 0
}

fn read_selection(frontmost_pid: i32) -> Option<(String, Option<Rect>, bool)> {
    // SAFETY: plain query.
    if !unsafe { AXIsProcessTrusted() } || frontmost_pid as u32 == std::process::id() {
        return None;
    }
    // SAFETY: returns an owned element for that process.
    let application = unsafe {
        CFType::wrap_under_create_rule(AXUIElementCreateApplication(frontmost_pid) as CFTypeRef)
    };
    let focused = attribute(
        application.as_CFTypeRef() as AXUIElementRef,
        "AXFocusedUIElement",
    )?;
    let element = focused.as_CFTypeRef() as AXUIElementRef;
    let mut pid = 0;
    // SAFETY: valid element; pid is written on success.
    if unsafe { AXUIElementGetPid(element, &mut pid) } == AX_SUCCESS
        && pid as u32 == std::process::id()
    {
        return None;
    }
    if attribute(element, "AXRole")
        .as_ref()
        .and_then(string)
        .as_deref()
        == Some("AXSecureTextField")
    {
        return None;
    }
    let text = attribute(element, "AXSelectedText")
        .as_ref()
        .and_then(string)?;
    if !usable(&text) {
        return None;
    }
    let bounds = attribute(element, "AXSelectedTextRange")
        .and_then(|range| parameterized(element, "AXBoundsForRange", &range))
        .and_then(|value| {
            let mut rect = CGRectRaw::default();
            // SAFETY: an AXValue of CGRect type writes 4 f64 into `rect`.
            let ok = unsafe {
                AXValueGetValue(
                    value.as_CFTypeRef(),
                    AX_VALUE_CGRECT,
                    &mut rect as *mut _ as *mut c_void,
                )
            };
            (ok && rect.width > 0.0 && rect.height > 0.0).then_some(Rect {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
            })
        });
    let editable = settable(element, "AXValue") || settable(element, "AXSelectedText");
    Some((text, bounds, editable))
}

/// Cocoa mouse locations have a bottom-left origin; the rest of the app uses top-left.
fn pointer_top_left(mtm: MainThreadMarker) -> Point {
    let location = NSEvent::mouseLocation();
    let height = NSScreen::screens(mtm)
        .firstObject()
        .map(|screen| screen.frame().size.height)
        .unwrap_or(0.0);
    Point {
        x: location.x,
        y: height - location.y,
    }
}

/// Install the monitor on the main thread; it lives for the process. `enabled`
/// gates everything observable: while off, only the press position is remembered.
pub fn start<R: Runtime>(app: AppHandle<R>, enabled: Arc<AtomicBool>) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        let gesture = Arc::new(Mutex::new(Gesture::default()));
        let mask = NSEventMask::LeftMouseDown | NSEventMask::LeftMouseUp;
        let block = RcBlock::new(move |event: NonNull<NSEvent>| {
            // SAFETY: AppKit hands a valid event for the duration of the call.
            let event = unsafe { event.as_ref() };
            let at = pointer_top_left(mtm);
            let Ok(mut gesture) = gesture.lock() else {
                return;
            };
            match event.r#type() {
                NSEventType::LeftMouseDown => {
                    gesture.pressed(at);
                    if enabled.load(Ordering::Relaxed) {
                        emit_cleared(&handle);
                    }
                }
                NSEventType::LeftMouseUp => {
                    let clicks = event.clickCount().max(0) as u32;
                    if gesture.released(at, clicks) && enabled.load(Ordering::Relaxed) {
                        // The application under the gesture, read here on the main thread.
                        let Some(front) = NSWorkspace::sharedWorkspace().frontmostApplication()
                        else {
                            return;
                        };
                        let pid = front.processIdentifier();
                        let handle = handle.clone();
                        let enabled = enabled.clone();
                        thread::spawn(move || {
                            thread::sleep(Duration::from_millis(SETTLE_MS));
                            if !enabled.load(Ordering::Relaxed) {
                                return;
                            }
                            if let Some((text, bounds, editable)) = read_selection(pid) {
                                emit_made(
                                    &handle,
                                    Selection {
                                        text,
                                        bounds,
                                        pointer: at,
                                        editable,
                                    },
                                );
                            }
                        });
                    }
                }
                _ => {}
            }
        });
        if let Some(monitor) = NSEvent::addGlobalMonitorForEventsMatchingMask_handler(mask, &block)
        {
            std::mem::forget(monitor);
        }
        std::mem::forget(block);
    });
    let _ = app.app_handle();
}
