import { gsap } from "gsap";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { demoStates, demoSteps } from "./demo.js";

gsap.registerPlugin(ScrollTrigger, ScrambleTextPlugin);

// Values pass through redaction blocks on their way to and from their aliases.
const redaction = "█▓▒░";
const morph = (text) => ({ text, chars: redaction, speed: 0.5 });

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

/**
 * Scroll-scrubbed journey across the "your machine / AI" boundary. The static markup shows the
 * masked copy beside the AI with the lookup table at home; this plays the whole round trip.
 */
function animateJourney(root) {
  const journey = root.querySelector("[data-om-journey]");
  const packet = journey.querySelector("[data-om-packet]");
  const local = journey.querySelector(".om-zone-local");
  const ai = journey.querySelector(".om-zone-ai");
  const values = [...packet.querySelectorAll("[data-om-real]")];
  const titles = [...packet.querySelectorAll("[data-om-packet-title]")];
  const steps = [...journey.querySelectorAll(".om-steps article")];
  const home = () => local.getBoundingClientRect().left - ai.getBoundingClientRect().left;
  const real = (value) => value.dataset.omReal;
  const alias = (value) => value.dataset.omAlias;
  const swapTitle = (from, to, position) =>
    timeline
      .to(titles[from], { autoAlpha: 0, y: -8, duration: 0.2 }, position)
      .fromTo(
        titles[to],
        { autoAlpha: 0, y: 8 },
        { autoAlpha: 1, y: 0, duration: 0.2, immediateRender: false },
        "<",
      );

  values.forEach((value) => (value.textContent = real(value)));
  journey.classList.add("om-journey-playing");
  steps[0].classList.add("om-active");
  gsap.set(titles, { autoAlpha: (index) => (index ? 0 : 1) });
  const timeline = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: journey,
      start: "top 14%",
      end: "+=1700",
      pin: true,
      scrub: 0.6,
      invalidateOnRefresh: true,
      onUpdate({ progress }) {
        const active = progress < 0.34 ? 0 : progress < 0.68 ? 1 : 2;
        steps.forEach((step, index) => step.classList.toggle("om-active", index === active));
      },
    },
  });
  timeline
    .fromTo(packet, { x: home }, { x: home, duration: 0.15 })
    .addLabel("mask")
    .to(values, {
      scrambleText: (index, value) => morph(alias(value)),
      stagger: 0.12,
      duration: 0.5,
    })
    .fromTo(
      "[data-om-vault]",
      { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 0.35 },
      "mask+=0.35",
    )
    .to(packet, { x: 0, duration: 0.8, ease: "power2.inOut" }, "+=0.15")
    .fromTo(ai, { "--om-zone-glow": 0 }, { "--om-zone-glow": 1, duration: 0.25 }, "-=0.2")
    .addLabel("reply", "+=0.1")
    .to(packet, { x: home, duration: 0.8, ease: "power2.inOut" }, "+=0.35")
    .to(ai, { "--om-zone-glow": 0, duration: 0.25 }, "<")
    .addLabel("restore")
    .to(values, {
      scrambleText: (index, value) => morph(real(value)),
      stagger: 0.12,
      duration: 0.5,
    })
    .to({}, { duration: 0.6 });
  swapTitle(0, 1, "mask+=0.3");
  swapTitle(1, 2, "reply");
  swapTitle(2, 3, "restore+=0.3");
  return () => {
    journey.classList.remove("om-journey-playing");
    steps.forEach((step) => step.classList.remove("om-active"));
    values.forEach((value) => (value.textContent = alias(value)));
  };
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
  let interacted = false;
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
    const morphing =
      animate &&
      !reduceMotion.matches &&
      demoStates[mode].aliases !== demoStates[destination].aliases;
    mode = destination;
    const state = demoStates[mode];
    const text = (value) => (state.aliases ? value.dataset.alias : value.dataset.original);
    demo.dataset.omStage = mode;
    for (const [field, attribute] of Object.entries(fields)) {
      root.querySelector(`[data-om-${attribute}]`).textContent = state[field];
    }
    for (const value of values) {
      if (!morphing) value.textContent = text(value);
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
        if (morphing)
          gsap.to(values, {
            scrambleText: (index, value) => morph(text(value)),
            duration: 0.7,
            stagger: 0.12,
            ease: "none",
          });
      }, root);
    }
  }
  function select(event) {
    const button = event.target.closest("[data-om-mode]");
    if (!button || !controls.contains(button)) return;
    interacted = true;
    stop();
    showMode(button.dataset.omMode);
  }
  function advance() {
    interacted = true;
    stop();
    showMode(demoSteps[(demoSteps.indexOf(mode) + 1) % demoSteps.length]);
  }
  function togglePlayback() {
    interacted = true;
    if (playback) {
      stop();
      return;
    }
    startPlayback();
  }
  // One finite sequence, started by the visitor or once on first view. Each stage can also be
  // selected directly, and any control stops it.
  function startPlayback() {
    showMode("original");
    play.textContent = "Ⅱ Dừng minh họa";
    play.setAttribute("aria-label", "Dừng quy trình minh họa");
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
    showMode(mode, false);
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
      ScrollTrigger.create({
        trigger: demo,
        start: "top 70%",
        once: true,
        onEnter: () => {
          if (!interacted && !playback && !document.hidden) gsap.delayedCall(0.9, autoplay);
        },
      });
      animateFormatPreviews(root);
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
  media.add(
    "(prefers-reduced-motion: no-preference) and (min-width: 850px)",
    () => animateJourney(root),
    root,
  );
  function autoplay() {
    if (!disposed && !interacted && !playback && !reduceMotion.matches) startPlayback();
  }
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
    next.removeEventListener("click", advance);
    document.removeEventListener("visibilitychange", stopOnHidden);
    reduceMotion.removeEventListener("change", stopForPreference);
    controls.hidden = play.hidden = next.hidden = true;
  };
}
