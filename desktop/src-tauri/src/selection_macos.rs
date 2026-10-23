//! macOS backend of the selection popover (decision 0096). A global NSEvent monitor
//! sees left-button presses and releases in other applications (never keys; macOS
//! delivers no events of this app itself). After a drag or multi-click the focused
//! element is asked, through the Accessibility API, for its selected text and the
//! selection's screen rectangle. Both calls fail without the Accessibility permission,
//! and nothing is read for secure (password) fields or this app. Chromium and
//! Electron applications build their accessibility tree only once a client asks for
//! it, so the application is asked first (decision 0125).
use std::collections::HashSet;
use std::ffi::c_void;
use std::ptr::NonNull;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use block2::RcBlock;
use core_foundation::base::{CFType, CFTypeRef, TCFType};
use core_foundation::boolean::CFBoolean;
use core_foundation::string::{CFString, CFStringRef};
use objc2::MainThreadMarker;
use objc2_app_kit::{NSEvent, NSEventMask, NSEventType, NSScreen, NSWorkspace};
use tauri::{AppHandle, Manager, Runtime};

use crate::selection::{
    emit_cleared, emit_made, usable, Gesture, Point, Probe, Read, Rect, Selection, SETTLE_MS,
};

#[repr(C)]
struct OpaqueAXUIElement {
    _private: [u8; 0],
}
type AXUIElementRef = *const OpaqueAXUIElement;
type AXError = i32;
const AX_SUCCESS: AXError = 0;
/// `kAXValueTypeCGRect`.
const AX_VALUE_CGPOINT: u32 = 1;
const AX_VALUE_CGSIZE: u32 = 2;
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
    fn AXUIElementSetAttributeValue(
        element: AXUIElementRef,
        attribute: CFStringRef,
        value: CFTypeRef,
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

/// Applications already asked for their accessibility tree in this launch.
static TREE_ASKED: Mutex<Option<HashSet<i32>>> = Mutex::new(None);
/// Chromium needs a moment to build the tree after the first request.
const TREE_WAIT_MS: u64 = 120;
const TREE_TRIES: u32 = 5;

/// Ask the application once to expose its accessibility tree. Chromium (Chrome, Dia,
/// Arc, Edge) and Electron (Slack, Zalo, VS Code) keep it off until an assistive client
/// sets `AXManualAccessibility`; until then they report no focused element. Native
/// applications reject the attribute, which is harmless. True on the first request.
fn ask_for_tree(application: AXUIElementRef, pid: i32) -> bool {
    let Ok(mut asked) = TREE_ASKED.lock() else {
        return false;
    };
    if !asked.get_or_insert_with(HashSet::new).insert(pid) {
        return false;
    }
    let name = CFString::new("AXManualAccessibility");
    // SAFETY: valid element; the attribute and value are borrowed for the call.
    let status = unsafe {
        AXUIElementSetAttributeValue(
            application,
            name.as_concrete_TypeRef(),
            CFBoolean::true_value().as_CFTypeRef(),
        )
    };
    status == AX_SUCCESS
}

fn read_selection(frontmost_pid: i32) -> Option<Read> {
    // SAFETY: plain query.
    if !unsafe { AXIsProcessTrusted() } || frontmost_pid as u32 == std::process::id() {
        return None;
    }
    // SAFETY: returns an owned element for that process.
    let application = unsafe {
        CFType::wrap_under_create_rule(AXUIElementCreateApplication(frontmost_pid) as CFTypeRef)
    };
    let application = application.as_CFTypeRef() as AXUIElementRef;
    let tries = if ask_for_tree(application, frontmost_pid) {
        TREE_TRIES
    } else {
        1
    };
    let focused = (0..tries).find_map(|try_| {
        if try_ > 0 {
            thread::sleep(Duration::from_millis(TREE_WAIT_MS));
        }
        attribute(application, "AXFocusedUIElement")
    })?;
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
    // Native text views answer AXSelectedText; web content (WebKit and Chromium web
    // areas: pages, an AI's answer) only answers through the text marker range.
    let text = attribute(element, "AXSelectedText")
        .as_ref()
        .and_then(string)
        .filter(|text| !text.is_empty())
        .or_else(|| {
            let range = attribute(element, "AXSelectedTextMarkerRange")?;
            string(&parameterized(
                element,
                "AXStringForTextMarkerRange",
                &range,
            )?)
        })?;
    if !usable(&text) {
        return None;
    }
    let bounds = selection_bounds(element);
    let editable = settable(element, "AXValue") || settable(element, "AXSelectedText");
    Some((text, bounds, editable))
}

/// An AXValue of one of the geometry types, read into `out`.
fn ax_value<T: Default>(value: &CFType, kind: u32) -> Option<T> {
    let mut out = T::default();
    // SAFETY: `kind` names the type `T` mirrors (CGPoint, CGSize or CGRect, all f64s).
    let ok = unsafe {
        AXValueGetValue(
            value.as_CFTypeRef(),
            kind,
            &mut out as *mut T as *mut c_void,
        )
    };
    ok.then_some(out)
}
fn usable_rect(rect: CGRectRaw) -> Option<Rect> {
    // A real rectangle on screen: some apps answer with an empty or origin rectangle.
    let real = rect.width > 0.0 && rect.height > 0.0 && (rect.x != 0.0 || rect.y != 0.0);
    real.then_some(Rect {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
    })
}
/// Where the selection is on screen, so the circle sits by the text rather than by the
/// pointer (decision 0096). Tried in order: the text range (native text views), the text
/// marker range (WebKit and Chromium: web pages and rich editors), and the frame of the
/// field or text area holding the selection, flagged as such. None leaves the pointer
/// as the anchor.
fn selection_bounds(element: AXUIElementRef) -> Option<(Rect, bool)> {
    let by_range = || {
        let range = attribute(element, "AXSelectedTextRange")?;
        let value = parameterized(element, "AXBoundsForRange", &range)?;
        usable_rect(ax_value::<CGRectRaw>(&value, AX_VALUE_CGRECT)?)
    };
    let by_marker = || {
        let range = attribute(element, "AXSelectedTextMarkerRange")?;
        let value = parameterized(element, "AXBoundsForTextMarkerRange", &range)?;
        usable_rect(ax_value::<CGRectRaw>(&value, AX_VALUE_CGRECT)?)
    };
    let by_frame = || {
        let position = ax_value::<[f64; 2]>(&attribute(element, "AXPosition")?, AX_VALUE_CGPOINT)?;
        let size = ax_value::<[f64; 2]>(&attribute(element, "AXSize")?, AX_VALUE_CGSIZE)?;
        usable_rect(CGRectRaw {
            x: position[0],
            y: position[1],
            width: size[0],
            height: size[1],
        })
    };
    by_range()
        .or_else(by_marker)
        .map(|rect| (rect, false))
        .or_else(|| by_frame().map(|rect| (rect, true)))
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
                                        field: bounds.as_ref().is_some_and(|(_, field)| *field),
                                        bounds: bounds.map(|(rect, _)| rect),
                                        mouse: true,
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

/// One look for the keyboard poller: the frontmost application, the pointer and the
/// mouse buttons are read on the main thread; the selection itself off it.
pub fn probe<R: Runtime>(app: &AppHandle<R>) -> Probe {
    let (sender, receiver) = std::sync::mpsc::channel();
    let posted = app.run_on_main_thread(move || {
        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        let down = NSEvent::pressedMouseButtons() & 1 != 0;
        let pid = NSWorkspace::sharedWorkspace()
            .frontmostApplication()
            .map(|front| front.processIdentifier());
        let _ = sender.send((down, pid, pointer_top_left(mtm)));
    });
    if posted.is_err() {
        return Probe::Nothing;
    }
    let Ok((down, pid, pointer)) = receiver.recv_timeout(Duration::from_secs(1)) else {
        return Probe::Nothing;
    };
    if down {
        return Probe::MouseDown;
    }
    match pid.and_then(read_selection) {
        Some((text, bounds, editable)) => Probe::Found(Selection {
            text,
            field: bounds.as_ref().is_some_and(|(_, field)| *field),
            bounds: bounds.map(|(rect, _)| rect),
            mouse: false,
            pointer,
            editable,
        }),
        None => Probe::Nothing,
    }
}
