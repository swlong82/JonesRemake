# Naming (IP-safe)

Title: **Hustle Ring** — row #1 below, chosen by the owner at M8 (ADR-0037); `app.title` in `apps/web/src/i18n/en.json` carries it.
Every name here must pass `pnpm check:banned` and be clearly distinct from the original's names and from
real brands (no one-letter edits).

## Title proposals (config.title = #1)

| #   | Title              | Rationale                                                                                   | Banned-term check |
| --- | ------------------ | ------------------------------------------------------------------------------------------- | ----------------- |
| 1   | Hustle Ring        | The working title, kept by the owner: a race around a ring of city locations, on the clock. | clean             |
| 2   | The Weekly Grind   | Names the core loop: one week a turn, work against study against rest.                      | clean             |
| 3   | Clock In, Cash Out | Satire of hustle culture; hints at jobs and the wealth goal.                                | clean             |
| 4   | Side Hustle City   | Leans on the modern ruleset (gigs, delivery, crypto).                                       | clean             |
| 5   | Rent Week          | Short and wry: rent falling due is the game's recurring beat.                               | clean             |

## Rival AI names (one per personality)

| Personality | Name         | Tagline                           |
| ----------- | ------------ | --------------------------------- |
| grinder     | The Grinder  | Sleep is for people with savings. |
| scholar     | The Scholar  | Another degree will fix this.     |
| hustler     | The Hustler  | Every side has a side hustle.     |
| balanced    | The Balanced | Moderation, aggressively.         |

## Locations (modern-western)

| Role              | Name                  | Quip sample                                |
| ----------------- | --------------------- | ------------------------------------------ |
| low-housing       | Co-Living Pod         | Welcome home; the shared calendar is full. |
| rent-office       | City Services Counter | Take a ticket for a ticket.                |
| pawn-shop         | Resale Kiosk          | Yesterday's upgrade is today's bargain.    |
| discount-store    | MegaMart Marketplace  | Deals rotate faster than the staff.        |
| burger-joint      | Burger Stack          | The meal deal has three terms.             |
| clothing-boutique | Threadline            | Dress for the promotion algorithm.         |
| electronics-store | GadgetHub             | A newer model launched during your walk.   |
| university        | Hybrid University     | Lecture hall or livestream? Same tuition.  |
| employment-office | JobLink Center        | Your profile is a strong partial match.    |
| factory           | Fulfillment Center    | The scanner is already counting.           |
| bank              | NeoBank Branch        | The app has a branch after all.            |
| grocery           | FreshCart Grocery     | Fresh produce, dynamic pricing.            |
| secure-apartments | Guarded Tower Condo   | The lobby recognizes your keycard.         |
| appliance-depot   | Plug & Play Depot     | Your kitchen deserves an update.           |
| clinic            | Community Clinic      | Please complete the intake tablet.         |
| park              | Common Ground Park    | A walk needs no account.                   |

## Parody brands

| Real-world category  | Parody name                                                | Distinctness note                                            |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------------------------ |
| Big-box retailer     | MegaMart Marketplace                                       | Generic compound, no retailer's name or mark echoed.         |
| Electronics chain    | GadgetHub                                                  | Generic noun pair; no chain uses it as its brand.            |
| Fast-food chain      | Burger Stack                                               | Describes the product; no mascot, colour or slogan borrowed. |
| Online bank          | NeoBank Branch                                             | "Neobank" is the industry's category word, not a brand.      |
| Grocery delivery     | FreshCart Grocery                                          | Generic compound; no delivery app's name or mark.            |
| Job board            | JobLink Center                                             | Generic compound; not a one-letter edit of any job site.     |
| Fulfilment warehouse | Fulfillment Center                                         | The job's own name, deliberately brandless.                  |
| Subscriptions        | Streaming, Music, Cloud Storage, Gym, Focus App, Food Club | Named by category only; no service's brand appears.          |

Every name above is checked by `pnpm check:banned` in CI, which scans code, content, UI and docs output for the PRD 2.6 list.
