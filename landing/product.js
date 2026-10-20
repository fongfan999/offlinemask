import { gsap } from "gsap";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { demoStages, demoValues } from "./demo.js";

gsap.registerPlugin(ScrollTrigger, ScrambleTextPlugin);

// Values pass through redaction blocks on their way to and from their codes.
const redaction = "█▓▒░";
const morph = (text) => ({ text, chars: redaction, speed: 0.5 });
const stageHold = 3.6;

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

/** Builds a stage's document from trusted static parts; no HTML strings are parsed. */
function renderDocument(container, stage, aliases) {
  container.replaceChildren(
    ...stage.document.map((parts) => {
      const paragraph = document.createElement("p");
      for (const part of parts) {
        if (typeof part === "string") {
          paragraph.append(part);
        } else if (part.strong) {
          const strong = document.createElement("strong");
          strong.textContent = part.strong;
          paragraph.append(strong);
        } else {
          const { real, alias, kind } = demoValues[part.value];
          const value = document.createElement("span");
          value.className = "om-v";
          Object.assign(value.dataset, { real, alias, kind });
          value.textContent = aliases ? alias : real;
          paragraph.append(value);
        }
      }
      return paragraph;
    }),
  );
  return [...container.querySelectorAll(".om-v")];
}

/** Values cross the boundary as codes once the diagram scrolls into view. */
function animateBoundary(root) {
  const split = root.querySelector("[data-om-split]");
  gsap
    .timeline({ scrollTrigger: { trigger: split, start: "top 72%", once: true } })
    .from(split.querySelectorAll(".om-pairs li"), {
      x: -16,
      autoAlpha: 0,
      duration: 0.45,
      stagger: 0.08,
      ease: "power2.out",
    })
    .from(split.querySelector(".om-channel span"), { scale: 0.6, autoAlpha: 0, duration: 0.3 })
    .from(
      split.querySelectorAll(".om-ai-text code"),
      { x: -70, autoAlpha: 0, duration: 0.6, stagger: 0.12, ease: "power3.out" },
      "-=0.1",
    );
}

/** Each format preview sweeps its redaction marks in once it scrolls into view. */
function animateFormatPreviews(root) {
  root.querySelectorAll("[data-om-preview]").forEach((preview) =>
    gsap.from(preview.querySelectorAll("b"), {
      scaleX: 0,
      transformOrigin: "left center",
      duration: 0.45,
      stagger: 0.08,
      ease: "power2.out",
      delay: 0.2,
      scrollTrigger: { trigger: preview, start: "top 88%", once: true },
    }),
  );
}

/** Mount on one page root; dispose before replacing that root (including Astro navigation). */
export function initOfflineMask(root) {
  if (!root) return () => {};
  const media = gsap.matchMedia();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const controls = root.querySelector("[data-om-controls]");
  const tabs = [...controls.querySelectorAll("[data-om-mode]")];
  const bars = tabs.map((tab) => tab.querySelector("i"));
  const play = root.querySelector("[data-om-play]");
  const sheet = root.querySelector("[data-om-stage]");
  const documentBody = sheet.querySelector("[data-om-document]");
  const where = sheet.querySelector("[data-om-where]");
  const file = sheet.querySelector("[data-om-file]");
  const note = sheet.querySelector("[data-om-note]");
  const staticDocument = [...documentBody.childNodes];
  const download = root.querySelector("[data-om-download]");
  const downloadLabel = root.querySelector("[data-om-download-label]");
  const downloadDetail = root.querySelector("[data-om-download-detail]");
  const downloadFallback = [
    download.getAttribute("href"),
    downloadLabel.textContent,
    downloadDetail.textContent,
  ];
  let disposed = false;
  let current = demoStages.find((stage) => stage.id === "masked");
  let feedback;
  let playback;
  let interacted = false;
  controls.hidden = play.hidden = false;

  function stop() {
    playback?.kill();
    playback = undefined;
    gsap.set(bars, { scaleX: 0 });
    play.textContent = "↻ Xem lại";
    play.setAttribute("aria-label", "Xem lại toàn bộ ví dụ");
  }
  function showStage(destination, animate = true) {
    const stage = demoStages.find(({ id }) => id === destination);
    if (!stage) return;
    feedback?.revert();
    const previous = current;
    const motion = animate && !reduceMotion.matches;
    current = stage;
    sheet.dataset.omStage = stage.id;
    where.textContent = stage.where;
    file.textContent = stage.file;
    note.textContent = stage.note;
    tabs.forEach((tab) =>
      tab.setAttribute("aria-pressed", String(tab.dataset.omMode === stage.id)),
    );

    // Masking and unmasking happen in place; a reply arrives in codes and is then restored.
    const inPlace = motion && previous.document === stage.document && previous !== stage;
    const restoring = motion && !inPlace && stage.id === "restored";
    const values = inPlace
      ? [...documentBody.querySelectorAll(".om-v")]
      : renderDocument(documentBody, stage, stage.masked || restoring);
    values.forEach((value) => {
      value.classList.toggle("om-masked", restoring);
      value.classList.toggle("om-restored", stage.id === "restored" && !restoring);
    });
    if (!motion) return;
    feedback = gsap.context(() => {
      gsap.fromTo(
        sheet,
        { y: 6 },
        { y: 0, duration: 0.4, ease: "power3.out", clearProps: "transform" },
      );
      if (inPlace || restoring)
        gsap.to(values, {
          scrambleText: (index, value) =>
            morph(stage.masked ? value.dataset.alias : value.dataset.real),
          duration: 0.75,
          stagger: 0.1,
          delay: restoring ? 0.7 : 0,
          ease: "none",
          onComplete() {
            if (restoring)
              values.forEach((value) => value.classList.replace("om-masked", "om-restored"));
          },
        });
    }, root);
  }
  // One finite sequence, started by the visitor or once on first view. Each stage can also be
  // selected directly, and any control stops it.
  function startPlayback() {
    showStage("original");
    play.textContent = "❚❚ Dừng";
    play.setAttribute("aria-label", "Dừng ví dụ");
    playback = gsap.timeline({ onComplete: stop });
    demoStages.forEach((stage, index) => {
      const start = index * stageHold;
      if (index) playback.call(() => showStage(stage.id), [], start);
      playback
        .fromTo(bars[index], { scaleX: 0 }, { scaleX: 1, duration: stageHold, ease: "none" }, start)
        .set(bars[index], { scaleX: 0 }, start + stageHold);
    });
  }
  function select(event) {
    const tab = event.target.closest("[data-om-mode]");
    if (!tab) return;
    interacted = true;
    stop();
    showStage(tab.dataset.omMode);
  }
  function togglePlayback() {
    interacted = true;
    if (playback) stop();
    else startPlayback();
  }
  function autoplay() {
    if (!disposed && !interacted && !playback && !reduceMotion.matches && !document.hidden)
      startPlayback();
  }
  function stopOnHidden() {
    if (document.hidden) stop();
  }
  function stopForPreference() {
    stop();
    feedback?.revert();
    showStage(current.id, false);
  }
  controls.addEventListener("click", select);
  play.addEventListener("click", togglePlayback);
  document.addEventListener("visibilitychange", stopOnHidden);
  reduceMotion.addEventListener("change", stopForPreference);
  stop();
  showStage(current.id, false);
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
      gsap.from(root.querySelectorAll("[data-om-enter]"), {
        y: 24,
        autoAlpha: 0,
        duration: 0.9,
        stagger: 0.08,
        ease: "power3.out",
        clearProps: "transform,opacity,visibility",
      });
      ScrollTrigger.create({
        trigger: sheet,
        start: "top 85%",
        once: true,
        onEnter: () => gsap.delayedCall(0.8, autoplay),
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
      animateBoundary(root);
      animateFormatPreviews(root);
    },
    root,
  );
  return () => {
    disposed = true;
    gsap.killTweensOf(autoplay);
    download.setAttribute("href", downloadFallback[0]);
    [downloadLabel.textContent, downloadDetail.textContent] = downloadFallback.slice(1);
    stop();
    feedback?.revert();
    media.revert();
    controls.removeEventListener("click", select);
    play.removeEventListener("click", togglePlayback);
    document.removeEventListener("visibilitychange", stopOnHidden);
    reduceMotion.removeEventListener("change", stopForPreference);
    sheet.dataset.omStage = "masked";
    documentBody.replaceChildren(...staticDocument);
    controls.hidden = play.hidden = true;
  };
}
