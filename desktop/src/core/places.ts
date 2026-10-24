import defaults from "./ai-places.json" with { type: "json" };

/** The platforms with AI places: application identifiers differ between them (bundle
 * identifiers on macOS, executable names on Windows); hosts are shared. */
export type PlacePlatform = "macos" | "windows" | "other";
export function detectPlatform(userAgent = globalThis.navigator?.userAgent ?? ""): PlacePlatform {
  if (/Mac|iPhone|iPad/.test(userAgent)) return "macos";
  if (/Windows/.test(userAgent)) return "windows";
  return "other";
}

/** Where the circle shows by itself (decision 0135): an AI desktop application, by its
 * identifier, or an AI site in a browser, by its host. */
export interface Place {
  kind: "app" | "host";
  /** The bundle identifier (macOS), the lowercase executable name (Windows) or the host. */
  id: string;
  name: string;
  /** Every identifier of a default application on this platform (ChatGPT has two on
   * macOS); `id` is the first. Added places have only `id`. */
  ids?: readonly string[];
}
/** What the user changed from the defaults. Only identifiers and names, never text, so a
 * longer default list in a later version still reaches someone who changed theirs. */
export interface PlaceChanges {
  added: Place[];
  removed: string[];
}
export const noChanges: PlaceChanges = { added: [], removed: [] };

const key = (place: Pick<Place, "kind" | "id">) => `${place.kind}:${place.id}`;
/** Whether `place` is the one named by `kind` and `id`, under any of its identifiers. */
const names = (place: Place, other: Pick<Place, "kind" | "id">) =>
  place.kind === other.kind && (place.id === other.id || !!place.ids?.includes(other.id));

/** The default places on a platform: its AI applications, then the AI sites. */
export function defaultPlaces(platform: PlacePlatform): Place[] {
  const apps =
    platform === "other"
      ? []
      : defaults.apps
          .filter((app) => app[platform].length > 0)
          .map((app) => ({
            kind: "app" as const,
            id: app[platform][0]!,
            name: app.name,
            ids: app[platform],
          }));
  return [...apps, ...defaults.hosts.map((host) => ({ kind: "host" as const, ...host }))];
}
/** Browsers whose page host is read; plumbing, not shown to the user. */
export function browsers(platform: PlacePlatform): string[] {
  return platform === "other" ? [] : [...defaults.browsers[platform]];
}

/** The list in effect: the defaults the user kept, then the places they added. */
export function effectivePlaces(changes: PlaceChanges, platform: PlacePlatform): Place[] {
  const removed = new Set(changes.removed);
  const kept = defaultPlaces(platform).filter((place) => !removed.has(key(place)));
  return [...kept, ...changes.added.filter((place) => !kept.some((known) => names(known, place)))];
}
export function addPlace(
  changes: PlaceChanges,
  place: Place,
  platform: PlacePlatform,
): PlaceChanges {
  const known = defaultPlaces(platform).find((candidate) => names(candidate, place));
  const id = key(known ?? place);
  return {
    added:
      known || changes.added.some((added) => names(added, place))
        ? changes.added
        : [...changes.added, { kind: place.kind, id: place.id, name: place.name }],
    removed: changes.removed.filter((removed) => removed !== id),
  };
}
export function removePlace(
  changes: PlaceChanges,
  place: Pick<Place, "kind" | "id">,
  platform: PlacePlatform,
): PlaceChanges {
  const known = defaultPlaces(platform).find((candidate) => names(candidate, place));
  const id = known && key(known);
  return {
    added: changes.added.filter((added) => !names(added, place)),
    removed: id && !changes.removed.includes(id) ? [...changes.removed, id] : changes.removed,
  };
}
/** Stored changes, read defensively: anything malformed counts as no change. */
export function parseChanges(stored: string | null | undefined): PlaceChanges {
  if (!stored) return noChanges;
  try {
    const value = JSON.parse(stored) as Partial<PlaceChanges>;
    const added = Array.isArray(value.added)
      ? value.added
          .filter(
            (place): place is Place =>
              !!place &&
              (place.kind === "app" || place.kind === "host") &&
              typeof place.id === "string" &&
              typeof place.name === "string",
          )
          .map(({ kind, id, name }) => ({ kind, id, name }))
      : [];
    const removed = Array.isArray(value.removed)
      ? value.removed.filter((id): id is string => typeof id === "string")
      : [];
    return { added, removed };
  } catch {
    return noChanges;
  }
}
/** What the native watcher needs: which applications, browsers and hosts count. */
export function nativePlaces(places: readonly Place[], platform: PlacePlatform) {
  return {
    apps: places
      .filter((place) => place.kind === "app")
      .flatMap((place) => place.ids ?? [place.id]),
    browsers: browsers(platform),
    hosts: places.filter((place) => place.kind === "host").map((place) => place.id),
  };
}
