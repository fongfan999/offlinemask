# 0180 — An enterprise code is a tax code, not a phone number

Date: 31 October 2026. Status: committed. Follows [0177](0177-recogniser-trained-on-copier-print.md) ("the enterprise code is masked, under a phone's alias").

## Problem

On the owner's business registration, the line "Mã số doanh nghiệp: …" was masked, but as a phone number: the code is ten digits from 0, the shape of a Vietnamese mobile number, and no rule knew its label, so only the phone rule found it. The review list then named it "Số điện thoại", which is wrong, and the code would not be masked at all with phone numbers switched off.

## Decision

- **"Mã số doanh nghiệp" and "Mã doanh nghiệp" label a tax code** (`detection/structured-values.ts`): an enterprise's code is also its tax code (Law on Enterprises 2020, art. 29), so the value after it is read as "Mã số thuế" is (ten digits, with a branch's "-001", or twelve or thirteen) and hidden as `GIAY_TO`, labelled "Mã số doanh nghiệp". The labelled value outranks the phone rule's guess, as every labelled value does; a phone number elsewhere on the line stays a phone number.

## Measured

The synthetic documents do not print this label, so they cannot move: the text set is 0 / 0 / 0 / 0 as before, and the scanned sets read no new label. On the owner's registration the code is now hidden under "Mã số doanh nghiệp" and nothing else on the page changes.

## Dependencies

None.

## Not decided here

Other registration labels (the enterprise's former names, its charter capital) are not personal data and stay as the rules and models already treat them.
