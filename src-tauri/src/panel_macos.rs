//! The floating panel as a non-activating panel (decision 0096 follow-up). On macOS a
//! click on any window of an inactive app activates that app: the AI chat lost focus,
//! OfflineMask's main window came forward and the paste landed in OfflineMask instead
//! of over the user's selection. An `NSPanel` with the non-activating style takes
//! clicks without activating its app, the way Spotlight-style panels do.
//!
//! Tauri creates the window as tao's `TaoWindow` (an `NSWindow` subclass); its class
//! is swapped for a small `NSPanel` subclass that never becomes key or main. The swap
//! is skipped when the new class would need more memory than the existing instance.
use objc2::rc::Retained;
use objc2::runtime::{AnyClass, AnyObject};
use objc2::{define_class, ClassType, MainThreadOnly};
use objc2_app_kit::{
    NSPanel, NSResponder, NSWindow, NSWindowCollectionBehavior, NSWindowStyleMask,
};
use objc2_foundation::NSObject;
use tauri::{Manager, Runtime, WebviewWindow};

define_class!(
    // SAFETY: NSPanel has no subclassing requirements; no ivars and no Drop here.
    #[unsafe(super(NSPanel, NSWindow, NSResponder, NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "OfflineMaskQuickPanel"]
    struct QuickPanel;

    impl QuickPanel {
        // Never key and never main: the front application keeps its focus and selection.
        #[unsafe(method(canBecomeKeyWindow))]
        fn can_become_key(&self) -> bool {
            false
        }
        #[unsafe(method(canBecomeMainWindow))]
        fn can_become_main(&self) -> bool {
            false
        }
    }
);

/// Turn the panel window into a non-activating panel. Must run on the main thread.
pub fn make_non_activating<R: Runtime>(window: &WebviewWindow<R>) -> bool {
    let Ok(pointer) = window.ns_window() else {
        return false;
    };
    if pointer.is_null() {
        return false;
    }
    // SAFETY: Tauri hands out its live NSWindow; it outlives this call.
    let object: &AnyObject = unsafe { &*(pointer as *const AnyObject) };
    let current: &AnyClass = object.class();
    let target: &AnyClass = QuickPanel::class();
    // A class swap reinterprets the instance's memory; never grow it.
    if target.instance_size() > current.instance_size() {
        return false;
    }
    // SAFETY: QuickPanel is an NSWindow subclass that adds no instance variables and
    // fits within the existing instance (checked above).
    unsafe { AnyObject::set_class(object, target) };
    // SAFETY: the object is now an instance of QuickPanel, an NSPanel subclass.
    let panel: Retained<NSPanel> =
        unsafe { Retained::retain(pointer as *mut NSPanel) }.expect("panel pointer");
    panel.setStyleMask(panel.styleMask() | NSWindowStyleMask::NonactivatingPanel);
    panel.setFloatingPanel(true);
    panel.setBecomesKeyOnlyIfNeeded(true);
    panel.setWorksWhenModal(true);
    // NSPanel hides itself whenever its app is inactive, which is all of the time here.
    panel.setHidesOnDeactivate(false);
    panel.setCollectionBehavior(
        panel.collectionBehavior()
            | NSWindowCollectionBehavior::CanJoinAllSpaces
            | NSWindowCollectionBehavior::FullScreenAuxiliary,
    );
    let _ = window.app_handle();
    true
}
