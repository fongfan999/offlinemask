//! macOS Services (decision 0094): "Ẩn thông tin bằng OfflineMask" on selected text in
//! any application, and "Ẩn thông tin tệp bằng OfflineMask" on files in Finder. The
//! provider only hands the text or the paths to the main window; nothing is written
//! back to the calling application, and no other pasteboard is read.
use objc2::rc::Retained;
use objc2::runtime::AnyObject;
use objc2::{define_class, msg_send, ClassType, DefinedClass, MainThreadMarker, MainThreadOnly};
use objc2_app_kit::{NSApplication, NSPasteboard, NSPasteboardTypeString};
use objc2_foundation::{NSArray, NSObject, NSObjectProtocol, NSString, NSURL};
use tauri::{AppHandle, Emitter, Manager, Wry};

use crate::background::{self, ServiceFiles, ServiceRequest, MAIN_WINDOW, SERVICE_EVENT};

struct Ivars {
    app: AppHandle<Wry>,
}

define_class!(
    // SAFETY: NSObject has no subclassing requirements; the provider lives for the process.
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "OfflineMaskServicesProvider"]
    #[ivars = Ivars]
    struct ServicesProvider;

    impl ServicesProvider {
        #[unsafe(method(maskText:userData:error:))]
        fn mask_text(
            &self,
            pasteboard: &NSPasteboard,
            _user_data: *const NSString,
            _error: *mut *mut NSString,
        ) {
            // SAFETY: reading an AppKit-provided static.
            let Some(text) = pasteboard.stringForType(unsafe { NSPasteboardTypeString }) else {
                return;
            };
            let _ = self.ivars().app.emit_to(
                MAIN_WINDOW,
                SERVICE_EVENT,
                ServiceRequest::Text {
                    text: text.to_string(),
                },
            );
        }

        #[unsafe(method(maskFiles:userData:error:))]
        fn mask_files(
            &self,
            pasteboard: &NSPasteboard,
            _user_data: *const NSString,
            _error: *mut *mut NSString,
        ) {
            let paths = file_paths(pasteboard);
            if paths.is_empty() {
                return;
            }
            let app = &self.ivars().app;
            app.state::<ServiceFiles>().offer(&paths);
            background::show_main(app);
            let _ = app.emit_to(MAIN_WINDOW, SERVICE_EVENT, ServiceRequest::Files { paths });
        }
    }

    unsafe impl NSObjectProtocol for ServicesProvider {}
);

fn file_paths(pasteboard: &NSPasteboard) -> Vec<String> {
    let classes = NSArray::from_slice(&[NSURL::class()]);
    // SAFETY: the class list names NSURL, so every object read back is an NSURL.
    let Some(items) = (unsafe { pasteboard.readObjectsForClasses_options(&classes, None) }) else {
        return Vec::new();
    };
    items
        .to_vec()
        .into_iter()
        .filter_map(|item: Retained<AnyObject>| item.downcast::<NSURL>().ok())
        .filter_map(|url| url.path().map(|path| path.to_string()))
        .collect()
}

/// Register the provider with the running application. The provider is kept for the
/// whole process; AppKit calls it on the main thread when a service is chosen.
pub fn install(app: &AppHandle<Wry>) {
    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };
    let provider = ServicesProvider::alloc(mtm).set_ivars(Ivars { app: app.clone() });
    // SAFETY: plain NSObject init on a freshly allocated instance with ivars set.
    let provider: Retained<ServicesProvider> = unsafe { msg_send![super(provider), init] };
    // SAFETY: the provider implements the selectors named in Info.plist's NSServices.
    unsafe { NSApplication::sharedApplication(mtm).setServicesProvider(Some(&provider)) };
    std::mem::forget(provider);
}
