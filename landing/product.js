import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { demoStates, demoSteps } from "./demo.js";

gsap.registerPlugin(ScrollTrigger);

const downloadLabels = {
  "mac-arm": "Tải cho macOS",
  "mac-intel": "Tải cho macOS",
  windows: "Tải cho Windows",
};

/** The visitor's desktop build, or undefined where one button cannot choose (Linux, phones). */
async function detectPlatform() {
  const hints = navigator.userAgentData;
  const platform = hints?.platform ?? navigator.platform ?? "";
  if (/^win/i.test(platform)) return "windows";
  // iPadOS reports a Mac platform but has touch input.
  if (!/^mac/i.test(platform) || navigator.maxTouchPoints > 1) return undefined;
  try {
    const { architecture } = (await hints?.getHighEntropyValues(["architecture"])) ?? {};
    return architecture === "x86" ? "mac-intel" : "mac-arm";
  } catch {
    return "mac-arm";
  }
}

/** Mount on one page root; dispose before replacing that root (including Astro navigation). */
export function initOfflineMask(root) {
  if (!root) return () => {};
  const media = gsap.matchMedia();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const controls = root.querySelector("[data-om-controls]");
  const play = root.querySelector("[data-om-play]");
  const next = root.querySelector("[data-om-next]");
  const demo = root.querySelector("[data-om-stage]");
  const output = root.querySelector(".om-output-sheet");
  const values = [...root.querySelectorAll("[data-original]")];
  const fields = {
    kicker: "kicker",
    title: "demo-title",
    label: "output-label",
    tag: "output-tag",
    prompt: "prompt",
    prefix: "prefix",
    verb: "verb",
    accountPrefix: "account-prefix",
    contactPrefix: "contact-prefix",
    detail: "detail",
    status: "status",
    next: "next",
  };
  const download = root.querySelector("[data-om-download]");
  const downloadLabel = root.querySelector("[data-om-download-label]");
  const downloadDetail = root.querySelector("[data-om-download-detail]");
  const downloadFallback = [
    download.getAttribute("href"),
    downloadLabel.textContent,
    downloadDetail.textContent,
  ];
  let disposed = false;
  let mode = "masked";
  let feedback;
  let playback;
  controls.hidden = play.hidden = next.hidden = false;

  function stop() {
    playback?.kill();
    playback = undefined;
    play.textContent = "▷ Xem trọn quy trình";
    play.setAttribute("aria-label", "Xem trọn quy trình minh họa");
  }
  function showMode(destination, animate = true) {
    if (!demoStates[destination]) return;
    feedback?.revert();
    mode = destination;
    const state = demoStates[mode];
    demo.dataset.omStage = mode;
    for (const [field, attribute] of Object.entries(fields)) {
      root.querySelector(`[data-om-${attribute}]`).textContent = state[field];
    }
    for (const value of values) {
      value.textContent = state.aliases ? value.dataset.alias : value.dataset.original;
      value.classList.toggle("om-original", !state.aliases);
    }
    controls
      .querySelectorAll("button")
      .forEach((button) =>
        button.setAttribute("aria-pressed", String(button.dataset.omMode === mode)),
      );
    if (animate && !reduceMotion.matches) {
      feedback = gsap.context(() => {
        gsap.fromTo(
          output,
          { y: 9 },
          { y: 0, duration: 0.45, ease: "power3.out", clearProps: "transform" },
        );
        gsap.fromTo(
          values,
          { backgroundColor: "transparent" },
          {
            backgroundColor: state.aliases ? "var(--accent-soft)" : "var(--paper-sunk)",
            duration: 0.65,
            stagger: 0.1,
            clearProps: "backgroundColor",
          },
        );
      }, root);
    }
  }
  function select(event) {
    const button = event.target.closest("[data-om-mode]");
    if (!button || !controls.contains(button)) return;
    stop();
    showMode(button.dataset.omMode);
  }
  function advance() {
    stop();
    showMode(demoSteps[(demoSteps.indexOf(mode) + 1) % demoSteps.length]);
  }
  function togglePlayback() {
    if (playback) {
      stop();
      return;
    }
    showMode("original");
    play.textContent = "Ⅱ Dừng minh họa";
    play.setAttribute("aria-label", "Dừng quy trình minh họa");
    // One finite, user-started sequence. Each stage can also be selected directly.
    playback = gsap.timeline({ onComplete: stop });
    playback
      .call(() => showMode("masked"), [], 3.5)
      .call(() => showMode("reply"), [], 7)
      .call(() => showMode("restored"), [], 10.5)
      .call(() => {}, [], 14);
  }
  function stopOnHidden() {
    if (document.hidden) stop();
  }
  function stopForPreference() {
    stop();
    feedback?.revert();
  }
  controls.addEventListener("click", select);
  play.addEventListener("click", togglePlayback);
  next.addEventListener("click", advance);
  document.addEventListener("visibilitychange", stopOnHidden);
  reduceMotion.addEventListener("change", stopForPreference);
  showMode("masked", false);
  // Without JavaScript, or on an undetected platform, the button opens the release page.
  detectPlatform().then((platform) => {
    const link = platform && root.querySelector(`[data-om-platform="${platform}"]`);
    if (disposed || !link) return;
    download.href = link.href;
    downloadLabel.textContent = downloadLabels[platform];
    downloadDetail.textContent = `${link.textContent} · Máy khác? Xem tất cả bản tải về`;
  });

  media.add(
    "(prefers-reduced-motion: no-preference)",
    () => {
      gsap.from(root.querySelectorAll(".om-hero-copy [data-om-enter]"), {
        y: 22,
        duration: 0.85,
        stagger: 0.08,
        ease: "power3.out",
        clearProps: "transform",
      });
      gsap.from(demo, {
        y: 45,
        rotateX: 3,
        transformPerspective: 1200,
        duration: 1,
        ease: "power3.out",
        clearProps: "transform",
        scrollTrigger: { trigger: demo, start: "top 95%", once: true },
      });
      root.querySelectorAll("[data-om-reveal]").forEach((element) =>
        gsap.from(element, {
          y: 24,
          duration: 0.7,
          ease: "power2.out",
          clearProps: "transform",
          scrollTrigger: { trigger: element, start: "top 92%", once: true },
        }),
      );
    },
    root,
  );
  return () => {
    disposed = true;
    download.setAttribute("href", downloadFallback[0]);
    [downloadLabel.textContent, downloadDetail.textContent] = downloadFallback.slice(1);
    stop();
    feedback?.revert();
    media.revert();
    controls.removeEventListener("click", select);
    play.removeEventListener("click", togglePlayback);
    next.removeEventListener("click", advance);
    document.removeEventListener("visibilitychange", stopOnHidden);
    reduceMotion.removeEventListener("change", stopForPreference);
    controls.hidden = play.hidden = next.hidden = true;
  };
}
