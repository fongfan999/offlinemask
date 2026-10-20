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

/**
 * The hero window shows the original screen and, behind a sweeping line, the masked one. It loops
 * while the hero is on screen; the toggle stops it and shows the chosen screen.
 */
function setupScan(root, motion) {
  const stage = root.querySelector("[data-om-scan]");
  const line = stage.querySelector(".om-scan-line");
  const toggle = root.querySelector("[data-om-view-toggle]");
  const buttons = [...toggle.querySelectorAll("[data-om-view]")];
  const press = (view) =>
    buttons.forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.omView === view)),
    );
  let loop;
  let watch;
  if (motion) {
    gsap.set(stage, { "--om-scan": "0%" });
    loop = gsap
      .timeline({ repeat: -1, delay: 1.6, defaults: { ease: "power2.inOut" } })
      .call(() => press("original"))
      .to(line, { opacity: 1, duration: 0.25 }, 0.9)
      .to(stage, { "--om-scan": "100%", duration: 2 }, 0.9)
      .call(() => press("masked"), [], 2.9)
      .to(line, { opacity: 0, duration: 0.3 }, 2.9)
      .to(line, { opacity: 1, duration: 0.2 }, 6)
      .to(stage, { "--om-scan": "0%", duration: 1.1 }, 6)
      .to(line, { opacity: 0, duration: 0.2 }, 7.1);
    watch = ScrollTrigger.create({
      trigger: stage,
      start: "top bottom",
      end: "bottom top",
      onToggle: (self) => (self.isActive ? loop?.play() : loop?.pause()),
    });
  }
  function choose(event) {
    const button = event.target.closest("[data-om-view]");
    if (!button) return;
    loop?.kill();
    loop = undefined;
    const view = button.dataset.omView;
    press(view);
    gsap.set(line, { opacity: 0 });
    gsap.to(stage, { "--om-scan": view === "masked" ? "100%" : "0%", duration: motion ? 0.6 : 0 });
  }
  toggle.hidden = false;
  toggle.addEventListener("click", choose);
  return () => {
    loop?.kill();
    watch?.kill();
    toggle.removeEventListener("click", choose);
    toggle.hidden = true;
    press("masked");
    gsap.set(stage, { clearProps: "--om-scan" });
    gsap.set(line, { clearProps: "opacity" });
  };
}

/**
 * "Cách hoạt động" on wide screens: the stage is pinned while the section scrolls, and the scroll
 * position picks the step. Choosing a step title scrolls to it. With motion, each card plays a
 * short entrance: highlights appear, the AI reply arrives, codes turn back into real values.
 */
function setupHow(root, motion) {
  const how = root.querySelector("[data-om-how]");
  const steps = [...how.querySelectorAll("[data-om-step]")];
  const heads = steps.map((step) => step.querySelector("[data-om-step-head]"));
  let current = -1;
  let play;

  // The illustrations' content changes with the example role, so look it up on each entrance.
  function enter(index) {
    play?.kill();
    if (!motion) return;
    if (index === 0) {
      const highlights = [...steps[0].querySelectorAll(".om-v")];
      highlights.forEach((value) => value.classList.add("om-dim"));
      play = gsap.timeline({ delay: 0.35 });
      highlights.forEach((value, k) =>
        play.call(() => value.classList.remove("om-dim"), [], k * 0.18),
      );
    } else if (index === 1) {
      play = gsap.fromTo(
        steps[1].querySelector("[data-om-ai]"),
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.6, delay: 0.7, ease: "expo.out" },
      );
    } else {
      const restored = [...steps[2].querySelectorAll("[data-om-restored] .om-r")];
      play = gsap.timeline({ delay: 0.45 });
      restored.forEach((value, k) => {
        value.dataset.real ??= value.textContent;
        value.textContent = value.dataset.code;
        play.to(
          value,
          {
            duration: 0.8,
            ease: "none",
            scrambleText: { text: value.dataset.real, chars: "█▓▒░", speed: 0.5 },
          },
          k * 0.2,
        );
      });
    }
  }
  function activate(index) {
    if (index === current) return;
    current = index;
    steps.forEach((step, k) => step.classList.toggle("om-active", k === index));
    heads.forEach((head, k) => head.setAttribute("aria-expanded", String(k === index)));
    enter(index);
  }
  const scroller = ScrollTrigger.create({
    trigger: how,
    start: "top top",
    end: "bottom bottom",
    onUpdate: (self) =>
      activate(Math.min(steps.length - 1, Math.floor(self.progress * steps.length))),
  });
  function choose(event) {
    const index = heads.indexOf(event.target.closest("[data-om-step-head]"));
    if (index < 0) return;
    const span = scroller.end - scroller.start;
    window.scrollTo({
      top: scroller.start + ((index + 0.5) / steps.length) * span,
      behavior: motion ? "smooth" : "auto",
    });
  }
  const replay = () => enter(current);
  activate(Math.min(steps.length - 1, Math.floor(scroller.progress * steps.length)));
  how.addEventListener("click", choose);
  how.addEventListener("om-role", replay);
  return () => {
    play?.kill();
    scroller.kill();
    how.removeEventListener("click", choose);
    how.removeEventListener("om-role", replay);
    steps.forEach((step, k) => step.classList.toggle("om-active", k === 0));
    heads.forEach((head) => head.removeAttribute("aria-expanded"));
    how.querySelectorAll(".om-v").forEach((value) => value.classList.remove("om-dim"));
    gsap.set(how.querySelector("[data-om-ai]"), { clearProps: "all" });
    how.querySelectorAll(".om-r").forEach((value) => {
      if (value.dataset.real) value.textContent = value.dataset.real;
    });
  };
}

/**
 * Example roles for "Cách hoạt động": each tab swaps the content of all three illustrations
 * (from the <template data-om-scenes> blocks; the default role is what the page ships with).
 * Works on every width and with reduced motion.
 */
function setupRoles(root) {
  const how = root.querySelector("[data-om-how]");
  const roles = how.querySelector("[data-om-roles]");
  const tabs = [...roles.querySelectorAll("[data-om-role]")];
  const slots = [...how.querySelectorAll("[data-om-part]")];
  const scenes = {
    [tabs[0].dataset.omRole]: Object.fromEntries(
      slots.map((slot) => [slot.dataset.omPart, slot.innerHTML]),
    ),
  };
  root.querySelectorAll("template[data-om-scenes]").forEach((template) => {
    scenes[template.dataset.omScenes] = Object.fromEntries(
      [...template.content.querySelectorAll("[data-om-part]")].map((part) => [
        part.dataset.omPart,
        part.innerHTML,
      ]),
    );
  });
  function show(role) {
    tabs.forEach((tab) => {
      tab.setAttribute("aria-selected", String(tab.dataset.omRole === role));
      tab.tabIndex = tab.dataset.omRole === role ? 0 : -1;
    });
    slots.forEach((slot) => (slot.innerHTML = scenes[role][slot.dataset.omPart]));
    how.dispatchEvent(new CustomEvent("om-role"));
  }
  function choose(event) {
    const tab = event.target.closest("[data-om-role]");
    if (tab) show(tab.dataset.omRole);
  }
  function arrows(event) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    const current = tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
    const next = tabs[(current + step + tabs.length) % tabs.length];
    next.focus();
    show(next.dataset.omRole);
  }
  roles.hidden = false;
  roles.addEventListener("click", choose);
  roles.addEventListener("keydown", arrows);
  return () => {
    show(tabs[0].dataset.omRole);
    tabs.forEach((tab) => tab.removeAttribute("tabindex"));
    roles.hidden = true;
    roles.removeEventListener("click", choose);
    roles.removeEventListener("keydown", arrows);
  };
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
  // Intro video: opens in a native modal and plays; closing pauses it.
  const videoOpen = root.querySelector("[data-om-video-open]");
  const videoDialog = root.querySelector("[data-om-video]");
  const video = videoDialog.querySelector("video");
  const openVideo = () => {
    videoDialog.showModal();
    video.play().catch(() => {});
  };
  const closeVideo = () => videoDialog.close();
  const pauseVideo = () => video.pause();
  const backdropClose = (event) => event.target === videoDialog && closeVideo();
  videoOpen.hidden = false;
  videoOpen.addEventListener("click", openVideo);
  const videoClose = videoDialog.querySelector("[data-om-video-close]");
  videoClose.addEventListener("click", closeVideo);
  videoDialog.addEventListener("click", backdropClose);
  videoDialog.addEventListener("close", pauseVideo);
  const triggers = [
    // The dock steps aside from the full download section to the end of the page.
    ScrollTrigger.create({
      trigger: "#om-download",
      start: "top 90%",
      end: () => ScrollTrigger.maxScroll(window) + 1,
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
      download.label.textContent = link.dataset.omLabel ?? downloadLabels[platform];
    }
    detail.textContent = `${link.textContent} · Máy khác? Xem tất cả bản tải về`;
  });

  media.add(
    {
      motion: "(prefers-reduced-motion: no-preference)",
      reduce: "(prefers-reduced-motion: reduce)",
      wide: "(min-width: 861px)",
    },
    (context) => {
      const undoScan = setupScan(root, context.conditions.motion);
      const undoHow = context.conditions.wide
        ? setupHow(root, context.conditions.motion)
        : () => {};
      const undoRoles = setupRoles(root);
      return () => {
        undoScan();
        undoHow();
        undoRoles();
      };
    },
  );
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
    root.classList.remove("om-js");
    videoOpen.hidden = true;
    videoOpen.removeEventListener("click", openVideo);
    videoDialog.removeEventListener("click", backdropClose);
    videoClose.removeEventListener("click", closeVideo);
    videoDialog.removeEventListener("close", pauseVideo);
    if (videoDialog.open) closeVideo();
  };
}
