import type { Directive } from "vue";

/** The app's tooltip (decision 0172), in place of the browser's `title`: the same card as
 * the note beside "Gần đây", shown after a short pause under the pointer or at once on
 * keyboard focus. One element in the page serves every tip, so no scrolling box or card
 * edge clips it; it sits under its target, above when there is no room, inside the
 * window. Only for things that need saying: an icon without words, a shortcut, what a
 * choice covers. */
export type Tip = string | { title: string; text: string } | undefined;

const delay = 350;
const gap = 8;
const edge = 8;
let tip: HTMLDivElement | null = null;
let owner: HTMLElement | null = null;
let timer: number | undefined;
const tips = new WeakMap<HTMLElement, Tip>();

function element() {
  if (tip) return tip;
  tip = document.createElement("div");
  tip.id = "app-tip";
  tip.className = "app-tip";
  tip.setAttribute("role", "tooltip");
  document.body.append(tip);
  return tip;
}

function show(target: HTMLElement) {
  const value = tips.get(target);
  if (!value) return;
  const box = element();
  box.replaceChildren();
  if (typeof value === "string") box.textContent = value;
  else {
    const title = document.createElement("strong");
    title.textContent = value.title;
    box.append(title, value.text);
  }
  owner = target;
  target.setAttribute("aria-describedby", box.id);
  box.classList.add("is-shown");
  const anchor = target.getBoundingClientRect();
  const size = box.getBoundingClientRect();
  const below = anchor.bottom + gap + size.height <= innerHeight - edge;
  const top = below ? anchor.bottom + gap : anchor.top - gap - size.height;
  const centre = anchor.left + anchor.width / 2 - size.width / 2;
  const left = Math.min(Math.max(centre, edge), innerWidth - edge - size.width);
  box.style.translate = `${Math.round(left)}px ${Math.round(top)}px`;
  box.dataset.side = below ? "below" : "above";
}

function hide() {
  window.clearTimeout(timer);
  if (owner?.getAttribute("aria-describedby") === "app-tip")
    owner.removeAttribute("aria-describedby");
  owner = null;
  tip?.classList.remove("is-shown");
}

function enter(event: Event) {
  const target = event.currentTarget as HTMLElement;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => show(target), delay);
}
function focus(event: FocusEvent) {
  const target = event.currentTarget as HTMLElement;
  if (target.matches(":focus-visible, :has(:focus-visible)")) show(target);
}

addEventListener("scroll", hide, { capture: true, passive: true });
addEventListener("keydown", (event: KeyboardEvent) => event.key === "Escape" && hide());

export const vTip: Directive<HTMLElement, Tip> = {
  mounted(el, { value }) {
    tips.set(el, value);
    el.addEventListener("mouseenter", enter);
    el.addEventListener("mouseleave", hide);
    el.addEventListener("focusin", focus);
    el.addEventListener("focusout", hide);
    el.addEventListener("pointerdown", hide);
  },
  updated(el, { value }) {
    tips.set(el, value);
    if (!value && owner === el) hide();
  },
  beforeUnmount(el) {
    if (owner === el) hide();
    tips.delete(el);
    el.removeEventListener("mouseenter", enter);
    el.removeEventListener("mouseleave", hide);
    el.removeEventListener("focusin", focus);
    el.removeEventListener("focusout", hide);
    el.removeEventListener("pointerdown", hide);
  },
};
