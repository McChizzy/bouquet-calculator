# Bouquet Calculator Execution Backlog

## Current state snapshot
The internal MVP already has a working React/Vite quote tool with:
- Lagos / Abuja city selection
- catalog bouquet quoting
- custom bouquet per-stem quoting
- fallback handling when city override is missing
- quote copy output for internal and customer use
- delivery fee and discount adjustments
- manual override with reason
- wholesale preview for custom flower items

Build status:
- `npm run build` ✅

## Product decisions to lock now

### 1. City pricing rule
**Decision:** City-specific price wins. If missing, fall back to retail sample price and visibly flag the quote.

**Why:** This keeps quoting fast without hiding pricing uncertainty.

### 2. Range pricing rule
**Decision:** Keep `low / standard / premium` banding for range-priced catalog bouquets.

**Why:** It is easier for operators to explain than silent midpoint logic.

### 3. Mixed bouquet pricing rule
**Decision:** For custom bouquets, use:
`sum(component subtotals) + packaging fee + arrangement premium + delivery - discount`

**Why:** This is the cleanest V1 logic and matches how operators think about handmade bouquets.

### 4. Per-stem pricing rule
**Decision:** Only use confirmed city prices for flowers inside the custom builder. If a flower has no confirmed city price, disable it from quoting rather than inventing a number.

**Why:** Better to block than fake precision.

### 5. Quote output rule
**Decision:** Customer quote stays short and sendable. Internal quote keeps audit detail, fallback notes, and override reason.

---

## PRD coverage vs current build

### Implemented now
- [x] Lagos / Abuja selection
- [x] Catalog bouquet quote path
- [x] Custom bouquet quote path
- [x] Per-stem custom pricing
- [x] Copyable customer quote
- [x] Copyable internal quote
- [x] Delivery adjustment
- [x] Discount adjustment
- [x] Manual override with reason
- [x] Fallback flagging for missing city overrides

### Partially implemented
- [~] Mixed bouquet pricing
  - Current state: component subtotaling works
  - Gap: packaging fee and arrangement premium are not yet first-class controls
- [~] Range handling
  - Current state: supported for catalog pricing
  - Gap: operator guidance for when to use low vs standard vs premium is not documented in-product
- [~] Quote status / confidence
  - Current state: fallback and missing-price states are surfaced
  - Gap: no explicit quote validity selector beyond fixed copy text

### Not implemented yet
- [ ] Packaging fee control
- [ ] Arrangement/design premium control
- [ ] Saved quotes
- [ ] Quote history / search
- [ ] Admin pricing editor
- [ ] Reusable bouquet templates
- [ ] Delivery profile presets by city/zone
- [ ] Customer self-serve flow

---

## Recommended next build sequence

### Ticket 1 — Add packaging fee
**Goal:** Let operators add bouquet packaging as a first-class adjustment.

**Scope**
- Add packaging fee input/select
- Include it in summary totals
- Include it in internal and customer quote output

**Acceptance criteria**
- Operator can add packaging without using manual override
- Packaging appears as its own line item in quote output

### Ticket 2 — Add arrangement premium
**Goal:** Support labor / design complexity as a visible pricing control.

**Scope**
- Add arrangement premium input
- Support either flat amount or percentage
- Show premium clearly in quote summary

**Recommendation:** Start with flat amount for MVP. It is simpler and easier to explain.

**Acceptance criteria**
- Operator can add arrangement premium without editing base stem counts
- Quote shows arrangement premium as a separate adjustment

### Ticket 3 — Improve mixed bouquet operator flow
**Goal:** Make custom bouquet building feel more like a real florist quoting workflow.

**Scope**
- Group flowers by type visually
- Show live bouquet composition summary
- Show total stems and component mix more prominently
- Add empty-state guidance for unavailable flowers

**Acceptance criteria**
- Operator can understand bouquet composition at a glance
- Disabled flowers explain why they cannot be quoted

### Ticket 4 — Add quote validity control
**Goal:** Make quote validity explicit instead of hard-coded.

**Scope**
- Add validity presets like 24h / 48h / custom note
- Reflect selected validity in customer quote output

**Acceptance criteria**
- Operator can change validity window before copying quote

### Ticket 5 — Add saved quotes (local/internal)
**Goal:** Avoid losing quotes between conversations.

**Scope**
- Save quote draft locally first
- Store quote metadata: quote ID, city, customer, total, type, created date
- Add simple quote list / reopen flow

**Acceptance criteria**
- Operator can reopen at least the most recent quotes
- No backend required for first version

### Ticket 6 — Add admin pricing surface
**Goal:** Reduce code-edit dependency when pricing changes.

**Scope**
- Read pricing from a structured source
- Add simple internal editor or import workflow
- Validate missing city values before publish/use

**Acceptance criteria**
- Operator can update pricing data with less engineering involvement

---

## MVP recommendation
If we want the next highest-value MVP increment, do these next:
1. Packaging fee
2. Arrangement premium
3. Quote validity control
4. Saved quotes

That gives Bloomfield a more realistic real-world quoting flow without dragging us into full admin tooling too early.

---

## Later-phase roadmap

### Phase 3
- saved quotes
- reusable templates
- quote search/history
- pricing admin improvements

### Phase 4
- wholesale cost layer
- margin and profit visibility
- markup recommendations
- city/product reporting

### Phase 5
- customer self-serve experience
- lead capture
- payment / fulfillment hooks

---

## Strong recommendation
Do **not** jump to customer self-serve yet.
The internal quoting flow still needs two core florist controls:
- packaging fee
- arrangement premium

Without those, the quote engine is useful but still slightly too rigid for daily sales use.
