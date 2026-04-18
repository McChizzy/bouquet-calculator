# Bloomfield Bouquet Pricing / Quote Calculator PRD

## Product summary
The Bloomfield Bouquet Pricing / Quote Calculator is a V1 sales quote tool for quickly pricing bouquets using existing sale-price data from the Bloomfield Retail Price List plus Lagos and Abuja price lists. Because wholesale cost data is not yet available, V1 focuses on quote accuracy, pricing consistency, and fast customer-facing estimates rather than margin analysis. Later versions will add wholesale cost, margin, profit, and operator analytics.

## Problem
Bloomfield needs a reliable way to generate bouquet quotes without manually recalculating city-based prices, mixed bouquet combinations, and per-stem selections each time. Manual quoting is slow, inconsistent, and hard to scale, especially when Lagos and Abuja pricing differ and mixed bouquets combine products with range-based prices.

## Goal
Help Bloomfield generate fast, consistent, city-aware bouquet quotes for customers and internal sales use.

## Success criteria
- A seller can produce a quote in under 2 minutes.
- Lagos and Abuja pricing differences are applied correctly.
- Mixed bouquet pricing rules are consistent and explainable.
- Per-stem pricing supports custom bouquets.
- Quote output is clean enough to send directly to a customer on chat.

## Users
### Primary users
- Bloomfield owner/operator creating quotes manually for customers
- Sales assistant handling Instagram, WhatsApp, or Telegram inquiries

### Secondary users
- Customer-facing use later, if a self-serve quote flow is exposed
- Operations/finance users in later versions when cost and margin are added

## Core use cases
1. Quote a standard bouquet from the existing retail catalog.
2. Quote a bouquet differently for Lagos vs Abuja.
3. Build a custom bouquet with per-stem flower counts.
4. Price a mixed bouquet with flowers from multiple categories.
5. Generate a customer-ready quote with bouquet details, city, quantity, and total.
6. Save or copy a quote for follow-up.

## Product scope for V1
V1 is a sale-price / quote calculator only.

Included:
- City selection: Lagos or Abuja
- Product selection from Bloomfield retail catalog
- Support for standard bouquets and custom bouquets
- Per-stem pricing inputs
- Mixed bouquet pricing logic
- Quote generation with line items and total
- Optional delivery/packaging/manual adjustment fields
- Shareable quote summary

Not included in V1:
- Wholesale cost tracking
- Margin and profit calculation
- Inventory availability
- Full checkout/payment
- Advanced CRM/history dashboards
- Customer self-serve storefront flow

## Pricing data assumptions
Current pricing data sources:
- Bloomfield Retail Price List
- Lagos Price List
- Abuja Price List

Important assumption for V1:
- Retail/sale prices are the source of truth.
- If a product has a range instead of a fixed amount, the calculator must either:
  - use a rule-based midpoint/default, or
  - require the operator to choose the final price band.

Example known catalog patterns from current data:
- Fixed retail price products exist, for example Barbie Deluxe (M) at 250,000 NGN.
- Some bouquets use a price range, for example Pastel Cloud (S) at 50,000 to 80,000 NGN.
- Some premium bouquets also use ranges, for example Century of Roses and BFF Collection.

## Functional requirements
### 1. Pricing mode
The calculator must support two pricing modes:
- Catalog bouquet quote
- Custom bouquet quote

### 2. City pricing logic
The user must choose a quote city:
- Lagos
- Abuja

Rules:
- If a city-specific price exists, use that city price.
- If a city-specific price does not exist, use the default retail price and flag it as a fallback.
- The quote output must clearly display the city used.

### 3. Catalog bouquet pricing
The user can select an existing bouquet/product from the retail list.
Inputs:
- bouquet/product name
- city
- quantity
- optional add-ons or manual adjustments

Outputs:
- unit price
- quantity
- subtotal
- notes on city-specific pricing or fallback pricing

### 4. Per-stem pricing
The user can build a custom bouquet using per-stem counts.
Inputs:
- flower type
- stem count per flower type
- city
- optional filler/wrapping/add-ons

Outputs:
- per-stem line items
- subtotal by flower type
- bouquet subtotal
- final total

V1 rule:
- per-stem pricing can come from a maintained lookup table derived from the Lagos/Abuja retail data.
- where only bouquet-level data exists, the admin may define temporary reference per-stem values manually.

### 5. Mixed bouquet pricing
Mixed bouquet pricing must support bouquets composed of multiple flower types such as roses, spray roses, lilies, chrysanthemums, and gypsos.

Recommended V1 logic:
- Each flower component has a unit or stem-based sale price by city.
- Total bouquet price = sum of all component subtotals + packaging/wrapping + design premium + optional delivery.
- The calculator should support a configurable “arrangement premium” percentage or flat fee for labor/design complexity.

If only finished bouquet reference prices are available for some SKUs, the operator can choose between:
- catalog reference pricing, or
- custom component pricing

This avoids forcing fake precision where pricing data is incomplete.

### 6. Quote generation flow
The quote generation flow should be:
1. Select city
2. Choose quote type: catalog bouquet or custom bouquet
3. Add bouquet items or per-stem components
4. Apply adjustments such as wrapping, arrangement premium, delivery, or discount
5. Review quote summary
6. Generate copyable customer quote

### 7. Quote output
Quote output should include:
- quote ID
- quote date/time
- customer name, optional in V1
- city
- bouquet name or custom bouquet label
- line items
- subtotal
- adjustments
- total amount
- optional validity note, for example “Valid for 24 hours subject to flower availability”

### 8. Manual override
The operator must be able to override a computed price with a reason note.
Examples:
- urgent delivery
- premium wrap requested
- special event surcharge
- promotional discount

## Non-functional requirements
- Mobile-friendly first, because quoting likely happens from chat-heavy workflows.
- Quote generation should feel fast and simple.
- Price logic should be editable without code-heavy maintenance if possible.
- Output should be easy to copy into WhatsApp, Telegram, Instagram DM, or email.

## UX outline
### Main screens
1. Pricing dashboard
2. Catalog quote builder
3. Custom bouquet builder
4. Quote preview
5. Admin pricing table editor, simple internal version

### Key UX principles
- Minimize typing.
- Default to operator speed.
- Always show city context.
- Let operators switch between prebuilt bouquet pricing and custom bouquet pricing without losing progress.

## Data model, V1 draft
### Entities
- Product
- CityPrice
- FlowerComponent
- Quote
- QuoteLine
- Adjustment

### Example product fields
- product_id
- name
- category
- description
- pricing_type: fixed | range | custom
- default_price_min
- default_price_max
- lagos_price_min
- lagos_price_max
- abuja_price_min
- abuja_price_max
- reference_stem_pricing_available
- active

## Edge cases
- Product has only a price range, no fixed amount.
- Product exists in retail catalog but not in one city list.
- Custom bouquet uses a flower with no per-stem price configured.
- Operator needs to quote mixed bouquet partly from catalog logic and partly from manual override.
- Large event bouquet needs a manual discount or premium.

## MVP scope
The MVP should focus on internal speed and quote consistency.

### MVP features
- City selector: Lagos/Abuja
- Catalog bouquet pricing
- Range price handling
- Custom bouquet builder with per-stem items
- Mixed bouquet pricing engine, simple rule-based
- Quote preview and copyable output
- Simple admin-editable pricing data store

### MVP exclusions
- Login/auth complexity unless needed internally
- Inventory syncing
- Payment collection
- Cost/margin/profit reporting
- Customer self-serve ordering portal

## Phased build plan
### Phase 1: PRD and pricing normalization
- Gather and normalize Bloomfield Retail, Lagos, and Abuja price lists
- Define city fallback rules
- Define range-price handling rules
- Create a clean product/pricing schema

### Phase 2: Internal calculator MVP
- Build internal quote UI
- Support catalog bouquet pricing
- Add custom bouquet builder
- Add mixed bouquet pricing + arrangement premium
- Generate copyable quote summary

### Phase 3: Admin usability improvements
- Add edit tools for pricing tables
- Add saved quotes
- Add reusable bouquet templates
- Add quote history/search

### Phase 4: Commercial intelligence upgrade
- Add wholesale cost input
- Add margin and profit calculation
- Add pricing recommendations
- Add reporting by bouquet type/city

### Phase 5: Customer-facing version
- Self-serve quote experience
- Lead capture
- Delivery options
- Checkout integration

## Future upgrade path
When wholesale data becomes available, the calculator should evolve into a pricing intelligence tool.

Future features:
- wholesale cost by flower type and city
- margin calculation per bouquet
- profit per quote
- recommended retail price suggestions
- seasonal price updates
- event pricing templates
- inventory-aware quoting
- customer self-serve instant quote flow

## Key product decisions
- V1 is explicitly a sale-price quote calculator, not a profitability calculator.
- City-based pricing must be first-class, not a bolt-on.
- Mixed bouquet pricing should support both component pricing and catalog reference pricing.
- Range-based prices must be handled transparently, not hidden.
- Manual override is necessary because flower quoting has real-world variability.

## Open questions
- What exact fields exist in the Lagos and Abuja price lists today?
- Are per-stem prices already derivable from the current lists, or do we need an admin-maintained mapping?
- Should delivery be part of V1 or left as a manual adjustment only?
- Do we want quote validity windows and expiration reminders in V1?
- Should quotes be saved per customer in MVP, or only copy-generated?
