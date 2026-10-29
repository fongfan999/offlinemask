/** The logo's move when the sidebar folds (decision 0172): the mark is a ninja's mask, so it
 * moves like one. It crouches, its name vanishes in a puff of smoke, the mask leaps along
 * an arc in one somersault with two fading afterimages, and lands in a second puff with a
 * small squash. Only transform and opacity are animated, on a handful of elements the
 * compositor moves without layout or paint: a copy of the logo, two copies of its tile for
 * the afterimages, and six dots per puff. */

const leap = 18;
const puffDots = 6;
const puffMs = 420;
/** When the mark lands, as a share of the flight: the rest is the squash. */
const touchdown = 0.86;

type Box = Pick<DOMRect, "left" | "top" | "width" | "height">;
const centre = (box: Box) => ({ x: box.left + box.width / 2, y: box.top + box.height / 2 });

/** The mark's own path: crouch, leap with a full turn, land, settle. `turn` is +1 or -1,
 * the way it travels. */
function markFrames(turn: number): Keyframe[] {
  const r = (deg: number) => `${deg * turn}deg`;
  return [
    { offset: 0, transform: `translateY(0) rotate(0deg) scale(1, 1)` },
    {
      offset: 0.12,
      transform: `translateY(2px) rotate(0deg) scale(1.1, 0.86)`,
      easing: "ease-out",
    },
    {
      offset: 0.5,
      transform: `translateY(${-leap}px) rotate(${r(180)}) scale(1, 1)`,
      easing: "ease-in",
    },
    { offset: touchdown, transform: `translateY(0) rotate(${r(360)}) scale(1, 1)` },
    { offset: 0.93, transform: `translateY(1px) rotate(${r(360)}) scale(1.12, 0.86)` },
    { offset: 1, transform: `translateY(0) rotate(${r(360)}) scale(1, 1)` },
  ];
}

/** A ring of soft dots that swell and fade around a point. */
function puff(at: { x: number; y: number }, delay: number): Promise<void> {
  const cloud = document.createElement("div");
  cloud.className = "brand-puff";
  cloud.setAttribute("aria-hidden", "true");
  cloud.style.translate = `${Math.round(at.x)}px ${Math.round(at.y)}px`;
  const runs: Animation[] = [];
  for (let i = 0; i < puffDots; i++) {
    const dot = document.createElement("span");
    cloud.append(dot);
    const angle = (i / puffDots) * Math.PI * 2 + 0.4;
    const reach = 15 + (i % 3) * 5;
    const x = Math.cos(angle) * reach;
    const y = Math.sin(angle) * reach * 0.7 - 4;
    runs.push(
      dot.animate(
        [
          { transform: "translate(0, 0) scale(0.3)", opacity: 0.7 },
          { transform: `translate(${x}px, ${y}px) scale(1.25)`, opacity: 0 },
        ],
        { duration: puffMs, delay, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" },
      ),
    );
  }
  document.body.append(cloud);
  const done = Promise.all(runs.map((run) => run.finished.catch(() => undefined)));
  // A window that stops painting never finishes the dots: clear them on time anyway.
  const timeout = new Promise((resolve) => setTimeout(resolve, delay + puffMs + 150));
  return Promise.race([done, timeout]).then(() => cloud.remove());
}

/** Flies `from`'s logo from `first` to `last` over `duration`, on `easing`, and resolves
 * when it has landed (on time even if the window stops painting). `mark` is where the
 * tile lands, for the second puff. */
export async function flyBrand(
  from: HTMLElement,
  first: Box,
  last: Box,
  mark: Box,
  duration: number,
  easing: string,
): Promise<void> {
  const dx = first.left - last.left;
  const dy = first.top - last.top;
  const turn = dx <= 0 ? 1 : -1;
  const startMark = from.querySelector(".brand-mark")?.getBoundingClientRect() ?? first;

  const copies: HTMLElement[] = [];
  const flights: Animation[] = [];
  // The logo, then two afterimages of its tile that trail it a little later and fainter.
  for (const [lag, ghost] of [
    [0, 0],
    [45, 0.32],
    [90, 0.14],
  ] as const) {
    const copy = from.cloneNode(true) as HTMLElement;
    copy.className = ghost ? "brand brand-flight brand-ghost" : "brand brand-flight";
    copy.setAttribute("aria-hidden", "true");
    copy.tabIndex = -1;
    Object.assign(copy.style, {
      left: `${last.left}px`,
      top: `${last.top}px`,
      width: `${last.width}px`,
      height: `${last.height}px`,
    });
    document.body.append(copy);
    copies.push(copy);
    const timing = { duration, easing, delay: lag, fill: "backwards" as const };
    const path: Keyframe[] = ghost
      ? [
          { transform: `translate(${dx}px, ${dy}px)`, opacity: ghost },
          { opacity: ghost, offset: 0.7 },
          { transform: "translate(0, 0)", opacity: 0 },
        ]
      : [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }];
    flights.push(copy.animate(path, timing));
    copy
      .querySelector(".brand-mark")
      ?.animate(markFrames(turn), { duration, delay: lag, fill: "backwards" });
    // The name vanishes with the smoke and is back as the mask lands: only the mask leaps.
    if (!ghost)
      copy
        .querySelector(".brand-name")
        ?.animate(
          [
            { opacity: 1 },
            { opacity: 0, offset: 0.14 },
            { opacity: 0, offset: touchdown - 0.06 },
            { opacity: 1 },
          ],
          { duration },
        );
  }
  // The afterimages have faded out by the time the logo lands.
  const puffs = [puff(centre(startMark), 40), puff(centre(mark), duration * touchdown - 20)];
  await Promise.race([
    flights[0]?.finished.catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, duration + 150)),
  ]);
  for (const copy of copies) copy.remove();
  void Promise.all(puffs);
}
