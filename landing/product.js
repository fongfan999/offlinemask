import { gsap } from "gsap";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import introPoster from "./media/offlinemask-intro-poster.webp";

gsap.registerPlugin(ScrollTrigger, ScrambleTextPlugin);

const downloadLabels = {
  "mac-arm": "Tải cho máy Mac",
  "mac-intel": "Tải cho máy Mac",
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
 * A light text swap for the looping illustrations: the value fades out, the new text is set once,
 * and it fades back in. Unlike a scramble, which rewrites the text on every frame, this costs one
 * layout per swap, so loops stay cheap in browsers that struggle to keep 120 fps.
 */
function swapText(tl, el, text, at, onSwap) {
  tl.to(el, { opacity: 0, duration: 0.14, ease: "power1.in" }, at)
    .call(
      () => {
        el.textContent = text;
        onSwap?.();
      },
      [],
      at + 0.14,
    )
    .to(el, { opacity: 1, duration: 0.22, ease: "power1.out" }, at + 0.14);
}

/**
 * "Cách hoạt động" on wide screens: the step list is sticky and the illustrations scroll past
 * natively; the step whose illustration crosses the middle of the screen opens. Choosing a step
 * title scrolls its illustration into view. The illustrations' animation is setupSceneLoops.
 */
function setupHow(root, motion) {
  const how = root.querySelector("[data-om-how]");
  const steps = [...how.querySelectorAll("[data-om-step]")];
  const heads = steps.map((step) => step.querySelector("[data-om-step-head]"));
  const scenes = [...how.querySelectorAll("[data-om-scene]")];
  let current = -1;

  // The descriptions are padded to the tallest one's height, so the accordion trades exactly
  // equal space and the list keeps its height. Measured again whenever ScrollTrigger refreshes
  // (on resize).
  const texts = steps.map((step) => step.querySelector(".om-how-body p"));
  function equalize() {
    texts.forEach((text) => (text.style.paddingBottom = ""));
    const heights = texts.map((text) => text.scrollHeight);
    const tallest = Math.max(...heights);
    texts.forEach((text, k) => (text.style.paddingBottom = `${tallest - heights[k]}px`));
  }
  equalize();
  ScrollTrigger.addEventListener("refreshInit", equalize);
  // Opening a step is a class change; the CSS unfolds it (see "An accordion").
  function activate(index) {
    if (index === current) return;
    current = index;
    steps.forEach((step, k) => step.classList.toggle("om-active", k === index));
    heads.forEach((head, k) => head.setAttribute("aria-expanded", String(k === index)));
  }
  // Each illustration owns the stretch of scroll from its top to the next one's top passing
  // mid-screen; the last one owns until its bottom does.
  const triggers = scenes.map((scene, index) =>
    ScrollTrigger.create({
      trigger: scene,
      start: "top center",
      endTrigger: scenes[index + 1] ?? scene,
      end: scenes[index + 1] ? "top center" : "bottom center",
      onUpdate: (self) => self.isActive && activate(index),
      onToggle: (self) => self.isActive && activate(index),
    }),
  );
  function choose(event) {
    const index = heads.indexOf(event.target.closest("[data-om-step-head]"));
    if (index >= 0)
      scenes[index].scrollIntoView({ behavior: motion ? "smooth" : "auto", block: "center" });
  }
  activate(
    Math.max(
      0,
      triggers.findLastIndex((trigger) => trigger.progress > 0),
    ),
  );
  how.addEventListener("click", choose);
  return () => {
    ScrollTrigger.removeEventListener("refreshInit", equalize);
    texts.forEach((text) => (text.style.paddingBottom = ""));
    triggers.forEach((trigger) => trigger.kill());
    how.removeEventListener("click", choose);
    steps.forEach((step, k) => step.classList.toggle("om-active", k === 0));
    heads.forEach((head) => head.removeAttribute("aria-expanded"));
  };
}

/**
 * The three "Cách hoạt động" illustrations loop while on screen, on every width, so a visitor can
 * watch them again: step 1's highlights appear and turn into codes, step 2's AI reply arrives,
 * step 3's codes turn back into real values. Switching the example role rebuilds the loops,
 * because the content changes. Without motion the static markup shows each end state.
 */
function setupSceneLoops(root, motion) {
  if (!motion) return () => {};
  const how = root.querySelector("[data-om-how]");
  const scenes = [...how.querySelectorAll("[data-om-scene]")];
  // Step 1's card before and after masking: its pill and label follow the values.
  function setDocState(scene, count, masked) {
    const pill = scene.querySelector('[data-om-part="doc-count"]');
    pill.textContent = masked ? `Đã ẩn ${count} thông tin` : `Tìm thấy ${count} thông tin`;
    pill.classList.toggle("om-scene-pill-warm", !masked);
    pill.classList.toggle("om-scene-pill-cobalt", masked);
    scene.querySelector("[data-om-doc-kicker]").textContent = masked ? "Bản đã ẩn" : "Bản gốc";
  }
  // The "before" state of each illustration.
  function prime(index) {
    const scene = scenes[index];
    if (index === 0) {
      const values = [...scene.querySelectorAll(".om-v")];
      values.forEach((value) => {
        value.dataset.real ??= value.textContent;
        value.textContent = value.dataset.real;
        value.classList.remove("om-coded");
        value.classList.add("om-dim");
        gsap.set(value, { clearProps: "opacity" });
      });
      setDocState(scene, values.length, false);
    } else if (index === 1) gsap.set(scene.querySelector("[data-om-ai]"), { autoAlpha: 0, y: 12 });
    else
      scene.querySelectorAll("[data-om-restored] .om-r").forEach((value) => {
        value.dataset.real ??= value.textContent;
        value.textContent = value.dataset.code;
        gsap.set(value, { clearProps: "opacity" });
      });
  }
  // One pass of an illustration's animation, from its "before" state.
  function pass(index) {
    const scene = scenes[index];
    const tl = gsap.timeline();
    if (index === 0) {
      const values = [...scene.querySelectorAll(".om-v")];
      const button = scene.querySelector("[data-om-doc-button]");
      values.forEach((value, k) => tl.call(() => value.classList.remove("om-dim"), [], k * 0.14));
      const press = values.length * 0.14 + 0.7;
      tl.to(button, { scale: 0.94, duration: 0.12, yoyo: true, repeat: 1 }, press);
      values.forEach((value, k) =>
        swapText(tl, value, value.dataset.code, press + 0.2 + k * 0.1, () =>
          value.classList.add("om-coded"),
        ),
      );
      tl.call(() => setDocState(scene, values.length, true), [], press + 0.3);
    } else if (index === 1) {
      tl.to(scene.querySelector("[data-om-ai]"), {
        autoAlpha: 1,
        y: 0,
        duration: 0.6,
        delay: 0.6,
        ease: "expo.out",
      });
    } else {
      scene
        .querySelectorAll("[data-om-restored] .om-r")
        .forEach((value, k) => swapText(tl, value, value.dataset.real, 0.4 + k * 0.2));
    }
    return tl;
  }
  let loops = [];
  let watches = [];
  function build() {
    loops.forEach((loop) => loop.kill());
    watches.forEach((watch) => watch.kill());
    loops = scenes.map((scene, index) => {
      prime(index);
      const loop = gsap.timeline({ paused: true, repeat: -1 });
      loop.call(() => prime(index), [], 0).add(pass(index), 0.3);
      // Hold the finished state, then start again.
      loop.to({}, { duration: 2.6 });
      return loop;
    });
    watches = scenes.map((scene, index) =>
      ScrollTrigger.create({
        trigger: scene,
        start: "top bottom",
        end: "bottom top",
        onToggle: (self) => (self.isActive ? loops[index].play() : loops[index].pause()),
      }),
    );
  }
  build();
  how.addEventListener("om-role", build);
  return () => {
    loops.forEach((loop) => loop.kill());
    watches.forEach((watch) => watch.kill());
    how.removeEventListener("om-role", build);
    how.querySelectorAll(".om-v").forEach((value) => {
      value.classList.remove("om-dim", "om-coded");
      if (value.dataset.real) value.textContent = value.dataset.real;
    });
    setDocState(scenes[0], scenes[0].querySelectorAll(".om-v").length, false);
    gsap.set(scenes[0].querySelector("[data-om-doc-button]"), { clearProps: "all" });
    gsap.set(how.querySelector("[data-om-ai]"), { clearProps: "all" });
    how.querySelectorAll(".om-r").forEach((value) => {
      if (value.dataset.real) value.textContent = value.dataset.real;
    });
  };
}

/**
 * Ẩn nhanh illustration: text selected in another app, the round OfflineMask button, a click, and
 * the values turn into codes in place; then the AI reply is selected and its codes turn back into
 * real values. It loops while on screen. Without motion the static markup shows the moment
 * before the click.
 */
function setupQuick(root, motion) {
  if (!motion) return () => {};
  const quick = root.querySelector("[data-om-quick]");
  const [askSel, replySel] = quick.querySelectorAll("[data-om-sel]");
  const [askCircle, replyCircle] = quick.querySelectorAll("[data-om-circle]");
  const reply = quick.querySelector("[data-om-quick-reply]");
  const status = quick.querySelector("[data-om-quick-status]");
  const statusText = status.textContent;
  const askValues = [...askSel.querySelectorAll(".om-qv")];
  const replyValues = [...replySel.querySelectorAll(".om-qv")];
  askValues.forEach((value) => (value.dataset.real = value.textContent));
  replyValues.forEach((value) => (value.dataset.code = value.textContent));
  const say = (text, safe) => {
    status.textContent = text;
    status.classList.toggle("om-scene-safe", safe);
  };
  const reset = () => {
    gsap.set([...askValues, ...replyValues], { clearProps: "opacity" });
    askValues.forEach((value) => {
      value.textContent = value.dataset.real;
      value.classList.remove("om-coded");
    });
    replyValues.forEach((value) => {
      value.textContent = value.dataset.code;
      value.classList.remove("om-real");
    });
    gsap.set([askSel, replySel], { backgroundSize: "0% 100%" });
    gsap.set([askCircle, replyCircle], { scale: 0 });
    gsap.set(reply, { autoAlpha: 0, y: 10 });
    say("Bôi đen cả tin nhắn…", false);
  };
  const scramble = (values, key, className) => (tween, at) =>
    values.forEach((value, k) =>
      swapText(tween, value, value.dataset[key], at + k * 0.15, () =>
        value.classList.add(className),
      ),
    );
  const select = { backgroundSize: "100% 100%", duration: 0.7, ease: "power1.inOut" };
  const pop = { scale: 1, duration: 0.35, ease: "back.out(2.2)" };
  const press = { scale: 0.82, duration: 0.12, yoyo: true, repeat: 1 };
  const loop = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.6, onRepeat: reset });
  loop
    .call(reset, [], 0)
    .to(askSel, select, 0.6)
    .to(askCircle, pop, 1.4)
    .to(askCircle, press, 2.2)
    .to(askSel, { backgroundSize: "0% 100%", duration: 0.3 }, 2.5)
    .to(askCircle, { scale: 0, duration: 0.25 }, 2.5)
    .call(() => say("Đã ẩn 2 thông tin ngay tại chỗ", true), [], 2.6);
  scramble(askValues, "code", "om-coded")(loop, 2.5);
  loop
    .to(reply, { autoAlpha: 1, y: 0, duration: 0.5, ease: "expo.out" }, 3.9)
    .call(() => say("Bôi đen câu trả lời có mã…", false), [], 4.6)
    .to(replySel, select, 4.8)
    .to(replyCircle, pop, 5.6)
    .to(replyCircle, press, 6.4)
    .to(replySel, { backgroundSize: "0% 100%", duration: 0.3 }, 6.7)
    .to(replyCircle, { scale: 0, duration: 0.25 }, 6.7)
    .call(() => say("Đã khôi phục 2 mã ngay tại chỗ", true), [], 6.8);
  scramble(replyValues, "real", "om-real")(loop, 6.7);
  loop.to({}, { duration: 2.4 }, 7.6);
  const watch = ScrollTrigger.create({
    trigger: quick,
    start: "top bottom",
    end: "bottom top",
    onToggle: (self) => (self.isActive ? loop.play() : loop.pause()),
  });
  return () => {
    loop.kill();
    watch.kill();
    reset();
    gsap.set([askSel, replySel, askCircle, replyCircle, reply], { clearProps: "all" });
    say(statusText, true);
  };
}

/**
 * The files card's sample sheet loops while on screen: real (fictional) values, then each column
 * scrambles into codes, a pause, and again. Without motion the static markup shows the masked
 * sheet.
 */
function setupSheet(root, motion) {
  if (!motion) return () => {};
  const sheet = root.querySelector("[data-om-sheet]");
  const pill = sheet.querySelector("[data-om-sheet-pill]");
  const note = sheet.querySelector("[data-om-sheet-note]");
  const cells = [...sheet.querySelectorAll("code[data-real]")];
  const texts = { pill: pill.textContent, note: note.textContent };
  cells.forEach((cell) => (cell.dataset.code = cell.textContent));
  const prime = () => {
    gsap.set(cells, { clearProps: "opacity" });
    cells.forEach((cell) => {
      cell.textContent = cell.dataset.real;
      cell.classList.add("om-plain");
    });
    pill.textContent = "Tìm thấy 3 cột";
    pill.classList.replace("om-scene-pill-cobalt", "om-scene-pill-warm");
    note.textContent = "30 dòng · 90 thông tin riêng";
  };
  const maskPass = () => {
    const play = gsap.timeline();
    // Column by column: names, then phones, then accounts.
    for (let column = 0; column < 3; column++)
      cells
        .filter((_, k) => k % 3 === column)
        .forEach((cell, row) =>
          swapText(play, cell, cell.dataset.code, column * 0.45 + row * 0.08, () =>
            cell.classList.remove("om-plain"),
          ),
        );
    play.call(() => {
      pill.textContent = texts.pill;
      pill.classList.replace("om-scene-pill-warm", "om-scene-pill-cobalt");
      note.textContent = texts.note;
    });
    return play;
  };
  // Loop while on screen: real values, column by column into codes, hold, start again.
  const loop = gsap.timeline({ paused: true, repeat: -1 });
  loop.call(prime, [], 0).add(maskPass(), 0.8).to({}, { duration: 2.6 });
  prime();
  const watch = ScrollTrigger.create({
    trigger: sheet,
    start: "top bottom",
    end: "bottom top",
    onToggle: (self) => (self.isActive ? loop.play() : loop.pause()),
  });
  return () => {
    loop.kill();
    watch.kill();
    cells.forEach((cell) => {
      cell.textContent = cell.dataset.code;
      cell.classList.remove("om-plain");
    });
    pill.textContent = texts.pill;
    pill.classList.replace("om-scene-pill-warm", "om-scene-pill-cobalt");
    note.textContent = texts.note;
  };
}

/** FAQ: one answer open at a time; the CSS unfolds it like the step list. */
function setupFaq(root) {
  const list = root.querySelector("[data-om-faq]");
  const items = [...list.querySelectorAll("[data-om-q]")];
  const set = (item, open) => {
    item.classList.toggle("om-open", open);
    item.querySelector("button").setAttribute("aria-expanded", String(open));
  };
  function toggle(event) {
    const item = event.target.closest("[data-om-q]");
    if (!item || !event.target.closest("button")) return;
    const open = !item.classList.contains("om-open");
    items.forEach((other) => set(other, other === item && open));
  }
  list.addEventListener("click", toggle);
  return () => {
    list.removeEventListener("click", toggle);
    items.forEach((item) => set(item, false));
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

/** Mount on one page root; dispose before replacing that root (including Astro navigation). */
export function initOfflineMask(root) {
  if (!root) return () => {};
  const media = gsap.matchMedia();
  const hero = root.querySelector(".om-hero");
  const wordmark = root.querySelector("[data-om-wordmark]");
  const dock = root.querySelector("[data-om-dock]");
  const downloads = [...root.querySelectorAll("[data-om-download]")].map((link) => ({
    link,
    href: link.getAttribute("href"),
    label: link.querySelector("[data-om-download-label]"),
    text: link.querySelector("[data-om-download-label]").textContent,
  }));
  const detail = root.querySelector("[data-om-download-detail]");
  const detailText = detail.textContent;
  const platforms = root.querySelector("[data-om-platforms]");
  // The main button points at the choices until the visitor's own download is known.
  const showPlatforms = (event) => {
    if (event.target.closest('a[href="#om-platforms"]')) platforms.open = true;
  };
  root.addEventListener("click", showPlatforms);
  let disposed = false;

  root.classList.add("om-js");
  // Looping CSS animations (the washes' blots, the privacy pills) run only while on screen.
  const washWatch = new IntersectionObserver((entries) =>
    entries.forEach((entry) => entry.target.classList.toggle("om-idle", !entry.isIntersecting)),
  );
  root.querySelectorAll(".om-wash, .om-marquee").forEach((element) => washWatch.observe(element));
  // Intro video: opens in a native modal and plays; closing pauses it.
  const videoOpen = root.querySelector("[data-om-video-open]");
  const videoDialog = root.querySelector("[data-om-video]");
  const video = videoDialog.querySelector("video");
  // The poster is set on first open, so a closed dialog downloads nothing.
  const openVideo = () => {
    video.poster ||= introPoster;
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
  ];

  // Without JavaScript, or on an undetected platform (Linux, phones), the buttons lead to the
  // list of downloads, which then starts open; never to GitHub's release page.
  detectPlatform().then((platform) => {
    if (disposed) return;
    const link = platform && root.querySelector(`[data-om-platform="${platform}"]`);
    if (!link) {
      platforms.open = true;
      return;
    }
    for (const download of downloads) {
      download.link.href = link.href;
      download.label.textContent = link.dataset.omLabel ?? downloadLabels[platform];
    }
    const kind = link.closest("div").querySelector("dt").textContent;
    detail.textContent = `${kind} · ${link.textContent} · Miễn phí, không cần tài khoản`;
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
      const undoFaq = setupFaq(root);
      const undoQuick = setupQuick(root, context.conditions.motion);
      const undoSheet = setupSheet(root, context.conditions.motion);
      const undoLoops = setupSceneLoops(root, context.conditions.motion);
      return () => {
        undoScan();
        undoHow();
        undoRoles();
        undoFaq();
        undoQuick();
        undoSheet();
        undoLoops();
      };
    },
  );
  media.add(
    "(prefers-reduced-motion: no-preference)",
    () => {
      // The intro itself is CSS (see "Hero intro" in product.css). The chips' codes are redacted
      // as they land, if the script is here in time to catch them.
      const landing = 1.35 - performance.now() / 1000;
      if (landing > 0)
        gsap.from("[data-om-code]", {
          scrambleText: { text: "████████", chars: "█▓▒░", speed: 0.6 },
          duration: 1,
          stagger: 0.18,
          delay: landing,
        });
      // Gentle idle drift so the hero never feels frozen. It runs only while the hero is on
      // screen: an animation that never stops keeps the page producing frames, and some
      // Chromium-based browsers (Dia) then stall on every frame, which makes other motion jerky.
      const drifts = [
        gsap.to("[data-om-sticker]", {
          rotate: 22,
          duration: 5,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay: 2,
        }),
        ...gsap.utils.toArray(root.querySelectorAll("[data-om-float]")).map((float, index) =>
          gsap.to(float, {
            y: index ? 10 : -10,
            duration: 3.4 + index,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
            delay: 2.2,
          }),
        ),
      ];
      ScrollTrigger.create({
        trigger: hero,
        start: "top bottom",
        end: "bottom top",
        onToggle: (self) =>
          drifts.forEach((tween) => (self.isActive ? tween.resume() : tween.pause())),
      });
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
    root.removeEventListener("click", showPlatforms);
    dock.classList.remove("om-hidden");
    root.classList.remove("om-js");
    washWatch.disconnect();
    root
      .querySelectorAll(".om-wash, .om-marquee")
      .forEach((element) => element.classList.remove("om-idle"));
    videoOpen.hidden = true;
    videoOpen.removeEventListener("click", openVideo);
    videoDialog.removeEventListener("click", backdropClose);
    videoClose.removeEventListener("click", closeVideo);
    videoDialog.removeEventListener("close", pauseVideo);
    if (videoDialog.open) closeVideo();
  };
}
