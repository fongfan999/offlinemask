/** The vocabulary the detection rules read, compiled from the data files under
 * `vocabulary/` (decision 0161). Rules import from here and never hold word lists of
 * their own. Entries are written as documents print them; `folded` variants serve the
 * readers that compare without tone marks (the legal-prefix walker, labelled fields). */
import places from "./vocabulary/places.json" with { type: "json" };
import bodies from "./vocabulary/public-bodies.json" with { type: "json" };
import people from "./vocabulary/people.json" with { type: "json" };
import organizations from "./vocabulary/organizations.json" with { type: "json" };
import wording from "./vocabulary/document-wording.json" with { type: "json" };
import labels from "./vocabulary/field-labels.json" with { type: "json" };
import units from "./vocabulary/units.json" with { type: "json" };

const ws = "[^\\S\\r\\n]+";
/** Without tone marks, "đ" as "d", in lower case: how the folded readers see text. */
export const fold = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase();
const nfc = (text: string) => text.normalize("NFC");
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A regex source matching any entry, longest first, a space matching any run of blanks.
 * `folded` compares without tone marks; `raw` keeps entries that are patterns. */
export function alternation(
  entries: readonly string[],
  { folded = false, raw = false }: { folded?: boolean; raw?: boolean } = {},
): string {
  const seen = new Set<string>();
  const parts = entries
    .map((entry) => (folded ? fold(entry) : nfc(entry).toLowerCase()))
    .filter((entry) => entry && !seen.has(entry) && seen.add(entry))
    .sort((a, b) => b.length - a.length)
    .map((entry) => (raw ? entry : escape(entry).replace(/ /g, ws)));
  return `(?:${parts.join("|")})`;
}
/** A set that answers for a word with its tone marks ("tải" yes, "tại" no) and, for a
 * word written without any ("tai" in a bank statement), for its folded form. */
function accentedOrFolded(entries: readonly string[]) {
  const accented = lowerSet(entries);
  const folded = lowerSet(entries, true);
  return {
    has: (word: string) => {
      const lower = word.normalize("NFC").toLowerCase();
      return accented.has(lower) || (fold(lower) === lower && folded.has(lower));
    },
  };
}
const lowerSet = (entries: readonly string[], folded = false) =>
  new Set(entries.map((entry) => (folded ? fold(entry) : nfc(entry).toLowerCase())));
const numbered = (words: readonly string[]) =>
  words.map((word) => `${escape(nfc(word)).replace(/ /g, ws)}${ws}\\d+(?:/\\d+)?`);

// Places
const provinceNames = [
  ...places.provinces.map((p) => p.name),
  ...places.formerProvinces.map((p) => p.name),
  ...places.provinceAliases,
];
export const vocabulary = {
  places: {
    /** Province and city names, current and former, lower case NFC. */
    provinces: accentedOrFolded(provinceNames),
    provinceAlternation: alternation(provinceNames),
    /** "thành phố", "tỉnh", "tp", "t": the kinds before a province's name. */
    kinds: units.placeKinds,
    kindAlternation: alternation(units.placeKinds),
    countries: lowerSet(places.countries),
  },
  bodies: {
    /** State bodies and public services, with provincial departments and agencies. */
    termAlternation: `(?:${[
      alternation(bodies.kinds),
      `${alternation(bodies.departmentKinds)}${ws}${alternation([...bodies.departments.current, ...bodies.departments.former])}`,
      `${alternation(bodies.agencyKinds)}${ws}${alternation(bodies.agencies)}`,
    ].join("|")})`,
  },
  people: {
    familyNames: lowerSet(people.familyNames, true),
    /** Syllables names are made of: the given and middle names, and the family names. */
    nameSyllables: lowerSet([...people.nameSyllables, ...people.familyNames]),
    formsOfAddress: people.formsOfAddress,
    formOfAddressAlternation: alternation(people.formsOfAddress),
    ranks: people.ranks,
    roles: people.roles,
  },
  organizations: {
    legalPrefixAlternation: alternation(organizations.legalForms, { folded: true }),
    kindAlternation: alternation(organizations.kinds),
    kindAlone: new RegExp(`^${alternation(organizations.kindAlone)}$`, "iu"),
    unitKinds: organizations.units.kinds,
    unitInPlaces: organizations.units.inPlaces,
    notUnits: organizations.units.notUnits as Record<string, readonly string[]>,
    tradeSyllables: accentedOrFolded(organizations.tradeSyllables),
    compounds: accentedOrFolded(organizations.compounds),
    nameStopAlternation: alternation(organizations.nameStops),
    nameStopNumberedAlternation: alternation(organizations.nameStopNumbered),
    nameUnitStopAlternation: alternation(organizations.nameUnitStops),
    partyLabelAlternation: alternation(organizations.partyLabels, { folded: true }),
  },
  wording: {
    /** Every phrase a model reads as a name, place or organization, as one alternation:
     * boilerplate by document kind, roles, ranks, and words before a number. */
    phraseAlternation: `(?:${[
      // "Lưu: VT, TTDVVL": the units that file an official document, as initials. First,
      // so the run takes the initials with the word.
      `${escape(nfc(wording.filing))}(?:${ws}[\\p{Lu}][\\p{Lu}.]*,?)*`,
      ...numbered(wording.numbered),
      `(?:${alternation(wording.amountWords)}${ws})+${alternation(wording.amountUnits)}`,
      alternation([
        ...Object.values(wording.boilerplate).flat(),
        ...people.roles,
        ...people.ranks,
        ...wording.codeLabels,
      ]),
    ].join("|")})`,
    headingAlternation: alternation(wording.wordingHeadings),
    sexLabelAlternation: alternation(wording.sexLabels),
    sexes: lowerSet(wording.sexes),
    currencies: new RegExp(`^${alternation(wording.currencies)}$`, "iu"),
    party: new RegExp(
      `^(?:${alternation(wording.partyWords)}\\s+)?bên(?:\\s+(?:${wording.partyRoles.join("|")}))?$`,
      "iu",
    ),
  },
  labels: {
    name: alternation(labels.name, { folded: true }),
    address: alternation(labels.address, { folded: true }),
    other: alternation(labels.other, { folded: true }),
    addressStops: alternation(labels.addressStops, { folded: true }),
    birthDate: alternation(labels.birthDate, { folded: true }),
    operationalDates: alternation(labels.operationalDates, { folded: true }),
    account: alternation(labels.account),
    identifier: alternation(labels.identifier),
    transaction: alternation(labels.transaction),
    customer: alternation(labels.customer),
    personalCode: alternation(labels.personalCode),
    taxSuffixes: alternation(labels.taxSuffixes, { folded: true }),
    addressContext: alternation(labels.addressContext, { folded: true }),
    factWords: alternation(labels.factWords, { folded: true }),
  },
  units: {
    measureAlternation: alternation(units.measures),
    packAlternation: alternation(units.packs),
    unitCell: new RegExp(`^${alternation(units.unitCells)}$`, "iu"),
    addressWordAlternation: alternation(units.addressWords),
    addressUnitAlternation: alternation(units.addressUnits, { folded: true }),
    addressUnitOrRoadAlternation: alternation([...units.addressUnits, ...units.roads], {
      folded: true,
    }),
    addressAbbreviationAlternation: alternation(units.addressAbbreviations),
    roadAlternation: alternation(units.roads, { folded: true }),
    placeGapAlternation: alternation(units.placeGap),
  },
};
