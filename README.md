# Bloomfield Bouquet Calculator MVP

Internal React + Vite quoting tool for Bloomfield bouquets.

## What changed
- Catalog mode now shows one visible card only, for the currently selected bouquet in the dropdown.
- Catalog pricing presentation now centers Lagos and Abuja, with sample fallback messaging kept secondary.
- Custom flower pricing no longer uses the old seed values in `src/data/pricing.js`.
- Custom flower prices now come from the Google Sheet tab `Bloomfield Retail price list` where rows were confirmed.
- UI source notes now document both the old custom-price source and the new sheet-backed source.

## Original custom flower price source
The previous custom flower prices were hard-coded seed values inside:
- `src/data/pricing.js`

Those values were labeled:
- `Bloomfield component seed pricing retained for custom quotes until confirmed per-stem sheets are imported.`

Previous hard-coded values replaced in this update:
- Rose: Lagos `₦3,600`, Abuja `₦3,900`, retail `₦3,500`
- Spray Rose: Lagos `₦3,300`, Abuja `₦3,500`, retail `₦3,200`
- Lily: Lagos `₦5,000`, Abuja `₦5,300`, retail `₦4,800`
- Chrysanthemum: Lagos `₦2,200`, Abuja `₦2,400`, retail `₦2,100`
- Gypsophila: Lagos `₦1,850`, Abuja `₦2,000`, retail `₦1,800`

## New custom flower price source
Google Sheet workbook:
- `https://docs.google.com/spreadsheets/d/1dq_lMoO1k5rYt9hfk79GVn2F1P2dDFIi6eE2OtoaTMs/edit?usp=drivesdk`

Exact tab used:
- `Bloomfield Retail price list`

Exact extracted rows used:
- Roses, Lagos `₦7,000`, Abuja `₦8,000`
- Spray Roses, Lagos `₦7,500`, Abuja `₦8,000`
- Lilies, Lagos `₦13,000`, Abuja `₦15,000`
- Gypsophila (Gypso), Lagos `₦5,000`, Abuja `₦5,000`
- Chrysanthemum, Lagos `₦5,000`, Abuja `₦15,000`

## Catalog sources
### Sample catalog source
- `../bloomfield-flowers-site/src/main.js`

### City override source
- `src/data/sources/marketOverrides.import.json`

Current confirmed override values:
- Lagos
  - `BBF-CNT-ROS-100` → `₦700,000`
  - `BBF-PCL-S` → `₦70,000`
  - `BBF-BRB-DLX-M` → `₦250,000`
  - `BBF-RDG-L` → `₦300,000`
- Abuja
  - `BBF-CNT-ROS-100` → `₦800,000`
  - `BBF-PCL-S` → `₦120,000`
  - `BBF-BRB-DLX-M` → `₦300,000`
  - `BBF-RDG-L` → `₦300,000`

## Important notes
- Catalog bouquets still fall back to the local sample catalog when a Lagos or Abuja override is missing.
- `BBF-BFF-COL` still has no confirmed Lagos or Abuja override loaded, so it uses sample fallback visibly.
- Custom flower pricing now uses only confirmed sheet-derived values for the flowers currently included in the custom builder.
- No custom flower values were invented in this update.

## File structure
- `src/data/sources/bloomfieldRetailSamples.js` stores sample catalog bouquet records.
- `src/data/sources/marketOverrides.import.json` stores confirmed Lagos and Abuja bouquet overrides.
- `src/data/sources/customFlowerPrices.js` stores extracted custom flower per-stem prices from the Google Sheet.
- `src/data/pricing.js` exports the calculator catalog.
- `src/lib/pricing.js` resolves prices and totals.

## Run locally
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```
