/** With Tauri's own drag-drop off, a file dropped where no drop zone listens falls to
 * WebKit, which opens it in place of the app and leaves no way back. Drop zones cancel
 * the events they take; anything that reaches the window still uncancelled is refused
 * here, with the "no drop" cursor. Dragged text keeps the browser's behaviour. */
export function refuseStrayFileDrops(target: Window = window) {
  const carriesFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;
  target.addEventListener("dragover", (event) => {
    if (event.defaultPrevented || !carriesFiles(event)) return;
    event.preventDefault();
    event.dataTransfer!.dropEffect = "none";
  });
  target.addEventListener("drop", (event) => {
    if (carriesFiles(event)) event.preventDefault();
  });
}
