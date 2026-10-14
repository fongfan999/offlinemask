# Contract review — 14 October 2026

A real Word contract masked by the app (collaborator agreement, 140 paragraphs with letters, 3 detector batches) was compared with its original, paragraph by paragraph. The findings led to [decision 0080](../decisions/0080-contract-parties-and-boilerplate.md). The contract is the owner's; no sentence of it is stored here, only counts. The installed pack `vietnamese-pii-v1` (Underthesea INT8 + OpenMed mSuperClinical INT8, both `minScore` 0.3) ran on the Node CPU runtime with the native tokenizer harness and network access disabled; a scratch harness reproduced the app's document path (paragraph batches of 8 000 characters, shared detector, document alias book) and reproduced the owner's file exactly (231 replacements, 63 aliases) before any change.

## The masked copy before and after

| | Owner's file (before) | After decision 0080 |
| --- | ---: | ---: |
| Replacements | 231 | 21 |
| Distinct aliases | 63 | 20 |
| Name aliases | 29 | 4 |
| Address aliases | 18 | 6 |
| Organization aliases | 9 | 3 |
| Structured values (tax code, phone ×2, birth date, ID number, account, email) | 7 | 7 |
| Private values leaked | 2 (company name; second signatory on the last line) | 0 |
| Party designators hidden ("Bên A", "Bên B", "Các Bên"…) | 19 aliases, 180 places | 0 |

After the change the 20 aliases are: the company (organization), the two people (each under its two spellings: uppercase header and signature, title case account name), the two addresses, the issuing authority, the bank, the city of signing, the court's city, the country in "pháp luật Việt Nam", one word of a project name, and the seven structured values. The one wrong alias is the project-name word; the three place names are places. Every heading, the title, the amounts in words and every "Bên A / Bên B" survive.

## Raw model evidence on the contract (threshold 0, before the policy)

| Model | Contextual spans | Of which "Bên A/B/…" | Real names, places, organizations | Score range of real entities | Score range of "Bên A/B" |
| --- | ---: | ---: | ---: | --- | --- |
| Underthesea INT8 | 308 | 235 | 19 distinct | 0.78–1.00 | 0.23–0.91 (median 0.5–0.6) |
| mSuperClinical INT8 | 259 (mostly FIRST_NAME/LAST_NAME fragments: "ên", "háng") | 68 | 2 partial name pieces | 0.30–0.55 | 0.13–0.49 |

No global score threshold separates the parties from the people (decision 0079 C had reached the same conclusion on the annotated corpora); a role list does.

## Regression checks

| Check | Before | After |
| --- | --- | --- |
| Pack gate, 14 committed fixtures | 13/14, 1 known miss | 13/14, same known miss |
| Four new contract fixtures (synthetic) | 2/4 | 4/4 |
| Annotated corpora, 232 cases, 299 entities, at `minScore` 0.3 (release-challenge-v1, text-reliability holdout and final, address holdout, model-decision) | 299/299 fully covered; names 90/90; addresses 77/77 | 299/299; 90/90; 77/77 |
| Over-masked lexical characters on those corpora | 186 (0.59 %) | 184 (0.59 %) |
| Unit tests | 233 | 240 |

An intermediate version of the address joiner lost the comma inside "12 Lê Duẩn, Đà Nẵng" (76/77); the corpora caught it before it shipped, which is what they are for. The one changed over-masking segment is an uppercase heading that is now cut at its sentence end into two segments of the same letters.

## Models

The search for newer Vietnamese token-classification checkpoints found none with a declared license and an ONNX graph beyond those screened in September. OpenMed's other Vietnamese PII models (SuperClinical-Base 184M DeBERTa-v3, SuperMedical-Large 355M, SnowflakeMed-Large 568M; Apache-2.0; `model_int8.onnx`; FIRSTNAME/MIDDLENAME/LASTNAME, STREET/CITY/STATE, ORGANIZATION) have not been scored. On this contract the shipped OpenMed model added nothing usable, so its replacement by a smaller OpenMed model is the next model experiment worth a protocol; this review changed no model.
