# 14. docs/SEED_DATA.md — concrete classic content

These tables are the initial `classic` pack values. They satisfy every [SRC] anchor in section 3 and remove the largest [ASSUMED] gaps. CC MAY tune them in stage-1 calibration within ±25% per value (ADR required); structure (job count, degree requirements, uniform tiers) MUST NOT change. Modern pack overrides names only (see 4.6 ladder example) plus `automationRisk`.

## 14.1 Job table (wage = base $/hr; Exp/Dep = minimum; Uniform tier; automationRisk for modern)

| Workplace | Job | Wage | Exp | Dep | Degrees | Uniform | Auto |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Burger Joint | Cook (always approved) | 4 | 0 | 0 | — | none | 0.45 |
| Burger Joint | Cashier | 5 | 12 | 15 | — | casual | 0.45 |
| Burger Joint | Shift Lead | 7 | 18 | 25 | — | casual | 0.20 |
| Burger Joint | Assistant Manager | 9 | 25 | 35 | JC | dress | 0.10 |
| Burger Joint | Manager | 12 | 35 | 45 | JC, BA | dress | 0.05 |
| Grocery | Bagger | 5 | 10 | 10 | — | none | 0.50 |
| Grocery | Stocker | 6 | 14 | 20 | — | casual | 0.40 |
| Grocery | Butcher | 9 | 16 | 25 | TS | casual | 0.10 |
| Grocery | Assistant Manager | 11 | 30 | 40 | JC | dress | 0.10 |
| Grocery | Manager | 14 | 40 | 50 | JC, BA | dress | 0.05 |
| Discount Store | Cashier | 5 | 12 | 15 | — | casual | 0.45 |
| Discount Store | Stock Clerk | 6 | 15 | 20 | — | casual | 0.40 |
| Discount Store | Department Lead | 8 | 22 | 30 | — | dress | 0.20 |
| Discount Store | Manager | 11 | 32 | 42 | JC | dress | 0.05 |
| Discount Store | Store Director | 14 | 42 | 52 | JC, BA | business | 0.05 |
| Clothing Boutique | Sales Associate | 6 | 14 | 18 | — | dress | 0.30 |
| Clothing Boutique | Tailor | 8 | 20 | 28 | TS | dress | 0.10 |
| Clothing Boutique | Assistant Manager | 10 | 28 | 38 | JC | dress | 0.10 |
| Clothing Boutique | Manager | 13 | 38 | 48 | JC, BA | business | 0.05 |
| Electronics Store | Sales Clerk | 6 | 14 | 18 | — | casual | 0.35 |
| Electronics Store | Repair Technician | 9 | 20 | 28 | EL | casual | 0.10 |
| Electronics Store | Floor Supervisor | 10 | 28 | 36 | JC | dress | 0.15 |
| Electronics Store | Manager | 13 | 36 | 46 | JC, BA | dress | 0.05 |
| Electronics Store | Regional Manager | 16 | 46 | 56 | BA, EL | business | 0.05 |
| Factory | Picker | 5 | 10 | 12 | — | none | 0.50 |
| Factory | Packer | 6 | 15 | 20 | — | casual | 0.45 |
| Factory | Machinist's Helper | 8 | 18 | 26 | PE | casual | 0.20 |
| Factory | Forklift Operator | 9 | 22 | 30 | TS | casual | 0.30 |
| Factory | Shift Supervisor | 12 | 32 | 42 | JC | dress | 0.10 |
| Factory | Engineer | 18 | 42 | 52 | EN, JC | dress | 0.05 |
| Factory | General Manager | 25 | 55 | 65 | EN, BA | business | 0.05 |
| Bank | Teller | 8 | 20 | 30 | JC | dress | 0.40 |
| Bank | Loan Officer | 12 | 30 | 42 | JC, BA | business | 0.20 |
| Bank | Branch Manager | 18 | 40 | 50 | BA | business | 0.05 |
| Bank | Broker | 22 | 45 | 60 | BA, AC | business | 0.10 |
| Rent Office | Records Clerk | 7 | 12 | 15 | — | none | 0.40 |
| Rent Office | Inspector | 9 | 20 | 28 | — | none | 0.15 |
| Rent Office | Apartment Manager | 12 | 30 | 40 | JC | none | 0.05 |
| Employment Office | Receptionist | 6 | 12 | 16 | — | dress | 0.45 |
| Employment Office | Counselor | 10 | 25 | 35 | JC | dress | 0.15 |
| Employment Office | Placement Manager | 14 | 38 | 48 | JC, BA | business | 0.05 |
| University | Janitor | 5 | 8 | 8 | — | none | 0.30 |
| University | Lab Assistant | 8 | 20 | 26 | JC | casual | 0.15 |
| University | Teacher | 12 | 30 | 40 | AC | dress | 0.05 |
| University | Lecturer | 15 | 40 | 50 | GS | dress | 0.05 |
| University | Professor | 20 | 50 | 60 | RE | dress | 0.05 |

Degree codes: TS Trade School, JC Junior College, EL Electronics, PE Pre-Engineering, EN Engineering, BA Business Admin, AC Academic, GS Graduate School, PD Post Doctoral, RE Research, PU Publishing. PD and PU unlock no jobs; they exist for the education goal (as in the original).

## 14.2 Item table (price base $; Happ = happinessOnBuy; Comfort adds relax bonus; XC = extra credit; Break = %/week; store D = discount, E = electronics, A = appliance depot, G = grocery)

| Item | Store | Price | Happ | Comfort | XC | Break | Repair | Unlocks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Refrigerator | A, D | 450 | 2 | no | no | 1.0 | 90 | freshFood |
| Freezer | A, D | 350 | 1 | no | no | 1.0 | 70 | freshFood12 |
| Microwave | A, D | 120 | 2 | no | no | 1.5 | 30 | — |
| Television | E, D | 400 | 4 | yes | no | 1.0 | 80 | — |
| Stereo | E, D | 300 | 3 | yes | no | 1.0 | 60 | — |
| VCR / Media Player | E, D | 250 | 3 | yes | no | 1.5 | 50 | — |
| Computer | E | 1200 | 5 | yes | yes | 1.0 | 200 | weekendIncome |
| Hot Tub | A | 2500 | 6 | yes | no | 0.5 | 300 | noRelaxDecay |
| Encyclopedia | D | 200 | 1 | no | yes | 0 | — | — |
| Dictionary | D | 40 | 1 | no | yes | 0 | — | — |
| Atlas | D | 60 | 1 | no | yes | 0 | — | — |
| Concert Ticket | D | 45 | +3 (consumed) | — | — | — | — | — |
| Theatre Ticket | D | 30 | +2 (consumed) | — | — | — | — | — |
| Dog Food | D | 8 | −1 (consumed) | — | — | — | — | — |
| Bad Novel | D | 12 | −2 (consumed) | — | — | — | — | — |
| Soft Drink | Burger Joint, G | 2 | +1 first per turn | — | — | — | — | — |
| Newspaper | G | 1 | 0 | — | — | — | — | newsHint |
| Lottery Ticket | G | 10 | 0 | — | — | — | — | — |

Discount-store copies of appliances: price ×0.7, Break ×2.5. Item value for pawn/resale: `price × max(20%, 100% − 2% × weeksOwned)`. Modern items (GDD 4.11) added by the modern overlay with the same fields; smartphone $600 (Happ 4, Break 2.0, unlocks rideHail/delivery/gigDelivery/newsHint), laptop $900 (Happ 3, XC no, unlocks onlineStudy), massage chair replaces hot tub.

## 14.3 Weekend events (one per player per week, weighted; money effects × econ)

| Event | Weight | Effect |
| --- | --- | --- |
| Quiet weekend at home | 20 | −$20, +1 Happ |
| Laundromat marathon | 10 | −$15, 0 |
| Friends visit | 12 | −$60, +2 Happ |
| Night out | 10 | −$120, +3 Happ |
| Road trip | 6 | −$200, +4 Happ |
| Minor illness | 6 | −$40, −1 Happ, −4h next turn |
| Freelance from home (needs Computer) | 10 | +$50..$150, 0 |
| Found cash | 3 | +$20..$80, +1 Happ |
| Parking fine / fee | 5 | −$50, −1 Happ |
| Family calls | 8 | $0, +1 Happ |
| Binge weekend | 6 | −$30, +2 Happ, −2 relaxation |
| Neighbour noise | 4 | $0, −1 Happ |

Weekend cost is deducted from cash then bank; if both empty, adds to rent debt.

## 14.4 Classic market instruments (price bounds in cents; weekly move drawn uniformly within `maxMove`, reflected at bounds)

| Instrument | Start | Min | Max | maxMove/wk | Econ correlation |
| --- | --- | --- | --- | --- | --- |
| T-Bills | 10000 | 9500 | 10800 | 1% | 0 |
| Gold | 10000 | 8000 | 14000 | 4% | −0.5 |
| Silver | 10000 | 7000 | 15000 | 6% | −0.3 |
| Commodities | 10000 | 5000 | 20000 | 9% | +0.2 |
| Blue Chip | 10000 | 8000 | 13000 | 3% | +0.7 |
| Penny Stocks | 10000 | 2000 | 30000 | 15% | +0.3 |

Move = correlation × econ weekly change + uniform(−maxMove, +maxMove) × (1 − |correlation|). Crash event: all instruments except T-Bills and Gold ×0.7.

## 14.5 Probabilities and misc constants (basis points)

| Constant | Value |
| --- | --- |
| Street theft on exit (bank, grocery) | 300 base + 100 per $100 cash above $200, cap 1200; steals all cash |
| Burglary (low tier) | GDD 4.10 formula |
| Doctor visit at turn start | 500 − 5 × relaxation, min 100; −10h, $30–$60 |
| Appliance breakdown | per item table |
| Lottery per ticket | $200: 800; $1,000: 150; $5,000: 20; max one prize per week (highest wins) |
| Job luck roll | GDD 3.4 formula |
| Rent extension approval | 6000 |
| Market crash event weight | 80 per week (Classic chaos); severity uniform 1–3; job-loss chance 1000/4000/10000 |
| Recession/Boom news weight | 400 each |
| Pawn: sell to shop | 50% of value; redeem within 2 rounds at 110% of sale; others buy at 70% of value |
| Grocery unit price | $15 × econ; spoils without fridge at turn start |
| Meals | Burger $8, Combo $12, Fries $4 (fries do not count as a meal) |
| Enrollment fee | $50 × econ |
| Discount Store rotation | 6 random items from its catalog per player turn, seeded per seat |

## 14.6 Board order (classic ring, square index → location)

1 Low-Cost Housing, 2 Rent Office, 3 Pawn Shop, 4 Discount Store, 5 Burger Joint, 6 Clothing Boutique, 7 Electronics Store, 8 University, 9 Employment Office, 10 Factory, 11 Bank, 12 Grocery, 13 Secure Apartments, 14 Appliance Depot, 15 Clinic, 16 Park. Modern overlay renames per 3.8.
