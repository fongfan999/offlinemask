import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** Mount on one page root; call the returned disposer before replacing that root. */
export function initOfflineMask(root) {
  if (!root) return () => {};
  const media = gsap.matchMedia();
  const controls = root.querySelector("[data-om-controls]");
  const values = [...root.querySelectorAll("[data-original]")];
  const status = root.querySelector("[data-om-status]");
  let mode = "masked";
  let feedback;
  controls.hidden = false;

  const changeMode = (event) => {
    const button = event.target.closest("[data-om-mode]");
    if (!button || !controls.contains(button) || button.dataset.omMode === mode) return;
    mode = button.dataset.omMode;
    feedback?.revert();
    for (const value of values) {
      value.textContent = mode === "masked" ? value.dataset.alias : value.dataset.original;
      value.classList.toggle("om-original", mode !== "masked");
    }
    controls.querySelectorAll("button").forEach((item) => {
      item.setAttribute("aria-pressed", String(item === button));
    });
    root.querySelector(".om-document-footnote").textContent =
      mode === "masked"
        ? "Nội dung vẫn rõ. Thông tin riêng đã ẩn."
        : "Ví dụ giả lập. Thông tin gốc đang hiển thị.";
    status.textContent = {
      original: "Bản gốc minh họa · 3 thông tin cần xem xét.",
      masked: "Đã ẩn 3 thông tin trong ví dụ.",
      restored: "Đã khôi phục 3 thông tin từ mã thay thế.",
    }[mode];
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      feedback = gsap.context(() => {
        gsap.fromTo(
          values,
          { y: 4 },
          { y: 0, duration: 0.3, stagger: 0.06, clearProps: "transform" },
        );
      }, root);
    }
  };
  controls.addEventListener("click", changeMode);
  media.add(
    "(prefers-reduced-motion: no-preference)",
    () => {
      gsap.from(root.querySelectorAll("[data-om-enter]"), {
        y: 25,
        duration: 0.85,
        stagger: 0.07,
        ease: "power3.out",
        clearProps: "transform",
      });
      root.querySelectorAll("[data-om-reveal]").forEach((element) => {
        gsap.from(element, {
          y: 30,
          duration: 0.75,
          ease: "power2.out",
          clearProps: "transform",
          scrollTrigger: { trigger: element, start: "top 92%", once: true },
        });
      });
      gsap.from(".om-demo-sticker", { rotation: 0, x: 15, duration: 1, ease: "power3.out" });
    },
    root,
  );
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const stopFeedback = () => {
    if (reduceMotion.matches) feedback?.revert();
  };
  reduceMotion.addEventListener("change", stopFeedback);
  return () => {
    media.revert();
    feedback?.revert();
    controls.removeEventListener("click", changeMode);
    reduceMotion.removeEventListener("change", stopFeedback);
    controls.hidden = true;
  };
}
