import { gsap } from "gsap";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger, ScrambleTextPlugin);

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

/** Wraps each letter of the decorative wordmark so it can rise in; returns an undo. */
function splitWordmark(wordmark) {
  const original = [...wordmark.childNodes].map((node) => node.cloneNode(true));
  const letters = [];
  const split = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const spans = [...child.textContent].map((letter) => {
          const span = document.createElement("span");
          span.textContent = letter;
          letters.push(span);
          return span;
        });
        child.replaceWith(...spans);
      } else {
        split(child);
      }
    }
  };
  split(wordmark);
  return { letters, undo: () => wordmark.replaceChildren(...original) };
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

/** Mount on one page root; dispose before replacing that root (including Astro navigation). */
export function initOfflineMask(root) {
  if (!root) return () => {};
  const media = gsap.matchMedia();
  const hero = root.querySelector(".om-hero");
  const heroWindow = root.querySelector("[data-om-hero-window]");
  const wordmark = root.querySelector("[data-om-wordmark]");
  const dock = root.querySelector("[data-om-dock]");
  const navDownload = root.querySelector("[data-om-nav-download]");
  const steps = [...root.querySelectorAll("[data-om-step]")];
  const shots = [...root.querySelectorAll("[data-om-shot]")];
  const downloads = [...root.querySelectorAll("[data-om-download]")].map((link) => ({
    link,
    href: link.getAttribute("href"),
    label: link.querySelector("[data-om-download-label]"),
    text: link.querySelector("[data-om-download-label]").textContent,
  }));
  const detail = root.querySelector("[data-om-download-detail]");
  const detailText = detail.textContent;
  let disposed = false;

  root.classList.add("om-js");
  function activate(index) {
    steps.forEach((step, i) => step.classList.toggle("om-active", i === index));
    shots.forEach((shot, i) => shot.classList.toggle("om-shown", i === index));
  }
  activate(0);
  const triggers = [
    ...steps.map((step, index) =>
      ScrollTrigger.create({
        trigger: step,
        start: "top 60%",
        end: "bottom 60%",
        onToggle: (self) => self.isActive && activate(index),
      }),
    ),
    // The dock steps aside where the full download section is on screen.
    ScrollTrigger.create({
      trigger: "#om-download",
      start: "top 90%",
      end: "bottom top",
      onToggle: (self) => dock.classList.toggle("om-hidden", self.isActive),
    }),
    ScrollTrigger.create({
      trigger: hero,
      start: "55% top",
      onToggle: (self) => navDownload.classList.toggle("om-visible", self.isActive),
    }),
  ];

  // Without JavaScript, or on an undetected platform, the buttons open the release page.
  detectPlatform().then((platform) => {
    const link = platform && root.querySelector(`[data-om-platform="${platform}"]`);
    if (disposed || !link) return;
    for (const download of downloads) {
      download.link.href = link.href;
      download.label.textContent = downloadLabels[platform];
    }
    detail.textContent = `${link.textContent} · Máy khác? Xem tất cả bản tải về`;
  });

  media.add(
    "(prefers-reduced-motion: no-preference)",
    () => {
      const { letters, undo } = splitWordmark(wordmark);
      const intro = gsap.timeline({ defaults: { ease: "expo.out" } });
      intro
        .from(root.querySelectorAll(".om-hero [data-om-enter]"), {
          y: 18,
          autoAlpha: 0,
          duration: 1,
          stagger: 0.12,
        })
        .from(
          letters,
          { yPercent: 70, autoAlpha: 0, rotate: 6, duration: 1.2, stagger: 0.035 },
          0.1,
        )
        .from(
          heroWindow,
          {
            y: 160,
            rotateX: 16,
            scale: 0.92,
            autoAlpha: 0,
            transformPerspective: 1600,
            duration: 1.6,
            clearProps: "transform,opacity,visibility",
          },
          0.35,
        )
        .from(
          "[data-om-sticker]",
          { scale: 0, rotate: -80, duration: 0.9, ease: "back.out(2.2)" },
          1.1,
        )
        .from("[data-om-float]", { y: 24, autoAlpha: 0, duration: 0.8, stagger: 0.18 }, 1.25)
        .from(
          "[data-om-code]",
          {
            scrambleText: { text: "████████", chars: "█▓▒░", speed: 0.6 },
            duration: 1,
            stagger: 0.18,
          },
          1.35,
        );
      // Gentle idle drift so the hero never feels frozen.
      gsap.to("[data-om-sticker]", {
        rotate: 22,
        duration: 5,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        delay: 2,
      });
      gsap.utils.toArray(root.querySelectorAll("[data-om-float]")).forEach((float, index) =>
        gsap.to(float, {
          y: index ? 10 : -10,
          duration: 3.4 + index,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay: 2.2,
        }),
      );
      // Scroll: the wordmark sinks behind the window as the page moves on.
      gsap.to(wordmark, {
        yPercent: 35,
        autoAlpha: 0.25,
        ease: "none",
        scrollTrigger: { trigger: hero, start: "top top", end: "60% top", scrub: true },
      });
      root.querySelectorAll("[data-om-reveal]").forEach((element) =>
        gsap.from(element, {
          y: 30,
          autoAlpha: 0,
          duration: 0.9,
          ease: "expo.out",
          scrollTrigger: { trigger: element, start: "top 88%", once: true },
        }),
      );
      animateBoundary(root);
      return undo;
    },
    root,
  );
  return () => {
    disposed = true;
    triggers.forEach((trigger) => trigger.kill());
    media.revert();
    for (const download of downloads) {
      download.link.setAttribute("href", download.href);
      download.label.textContent = download.text;
    }
    detail.textContent = detailText;
    dock.classList.remove("om-hidden");
    navDownload.classList.remove("om-visible");
    steps.forEach((step) => step.classList.remove("om-active"));
    shots.forEach((shot) => shot.classList.remove("om-shown"));
    root.classList.remove("om-js");
  };
}
