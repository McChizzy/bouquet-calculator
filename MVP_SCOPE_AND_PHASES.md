# Bouquet Calculator MVP Scope and Phased Plan

## Recommended MVP
Build an internal-first quote calculator for Bloomfield that supports:
- Lagos and Abuja pricing selection
- retail catalog bouquet pricing
- custom bouquet per-stem pricing
- mixed bouquet pricing
- customer-ready quote generation
- manual adjustments and overrides

## Why this MVP first
- It solves a real quoting pain immediately.
- It does not depend on missing wholesale cost data.
- It creates the data structure needed for later margin/profit analysis.
- It can be used manually by the team before any public rollout.

## MVP user flow
1. Open calculator
2. Select city
3. Pick either catalog bouquet or custom bouquet
4. Add bouquet items/components
5. Apply wrap, arrangement, delivery, or discount adjustments
6. Preview total
7. Copy and send quote

## Range pricing rule options
Because some current prices are ranges, use one of these V1 rules:

### Recommended default
- operator selects one of three bands: low, standard, premium
- system maps that to min, midpoint, or max price

### Alternative
- system defaults to midpoint and allows manual override

Recommended choice: low/standard/premium banding, because it is more explainable in live sales.

## Mixed bouquet pricing rule
Recommended V1 formula:
- sum of each flower component subtotal
- plus wrap/packaging fee
- plus arrangement/design fee
- plus optional delivery fee
- minus optional discount

## Phase plan
### Phase 1, pricing cleanup
- consolidate Bloomfield retail, Lagos, Abuja lists
- normalize names and SKUs
- define city fallback behavior
- define range-price band behavior

### Phase 2, calculator MVP
- internal quote builder
- catalog bouquet pricing
- custom bouquet builder
- quote output/copy flow

### Phase 3, operator quality-of-life
- saved quotes
- reusable templates
- admin editing for prices
- quote history

### Phase 4, business intelligence
- wholesale cost input
- margin, markup, profit
- best-price recommendations
- reporting

### Phase 5, customer-facing expansion
- customer self-serve quote builder
- order capture
- payment and fulfillment hooks

## Suggested tech direction
- lightweight web app
- mobile-first layout
- pricing tables in JSON or Airtable/Notion/Sheet-backed admin layer initially
- later migrate to proper database once quoting volume grows

## Immediate next steps
1. extract all price lists into one normalized table
2. define exact field schema
3. choose range-price handling rule
4. identify which flowers already have trustworthy per-stem pricing
5. convert PRD into build tickets
