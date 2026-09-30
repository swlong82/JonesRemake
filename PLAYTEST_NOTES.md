# Playtest notes — a layman's pass over Modern Western

Date: 2026-09-30. Played the built game in a browser (desktop 1440×900 and a 390×844 phone) as someone who has not read the rules: start a game, get a job, buy food, pay rent, read the news, end turn, repeat for seven weeks. Seed `layman2`, two seats (you and a Normal rival), tutorial off.

## 1. Fixed in this pass (ADR-0065)

| #   | What a player saw                                                                                                                                                                                           | Fix                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Threadline sold "item.casual.name"-style stock; engine events (rent hike, roommate, lost delivery, transit and car trouble, and older ones such as burglary) showed keys or half-keys like `burglary.title` | Clothing has names; every engine event has a title and text (with a themed override for Modern Western); every log line reads as a sentence; engine reason tags are worded                                                                                                                                                                                                                         |
| 2   | Entering a building took 2 hours                                                                                                                                                                            | 0.5 h in Modern Western; Classic keeps the original rule. The modern education goal was retuned (13 → 11 per degree) so `sim:gate` stays green                                                                                                                                                                                                                                                     |
| 3   | No news ever appeared unless you bought the paper                                                                                                                                                           | The Daily Hustle is always on the shelf and written from the game: economy, the biggest market mover (and what you hold in it), your job or the best opening you qualify for, rent due or overdue, layoff and automation warnings, this week's city events, who leads the race. A slim news flash shows the lead story each turn (Settings turns it off). Buying the paper still adds the forecast |
| 4   | The job card opened on a wall of numbers                                                                                                                                                                    | Title and workplace first; wage, dress code and requirements behind "More details"                                                                                                                                                                                                                                                                                                                 |
| 5   | Event cards showed raw tags like `severance:300`, `fired`, `grant:freeEnrollment:1`, and "Debt +$0"                                                                                                         | Every effect tag has a chip; the rent card no longer states a $0 debt                                                                                                                                                                                                                                                                                                                              |
| 6   | A magenta/cyan box flashed where a walking avatar loaded                                                                                                                                                    | Characters stay on their previous frame while the next one loads                                                                                                                                                                                                                                                                                                                                   |
| 7   | A clothing shop opened on "Work a shift (unavailable)" and "Gig work (unavailable)"; the stock was below the fold                                                                                           | Sections you can use come first                                                                                                                                                                                                                                                                                                                                                                    |
| 8   | Log said "spent 3.5h on travel:walk"                                                                                                                                                                        | "travel (Walk)"                                                                                                                                                                                                                                                                                                                                                                                    |

## 2. Findings not fixed yet, by priority

### P1 — quick wins (hours each)

1. **One button to go and enter.** Arriving and then pressing Enter is two steps for the same intent. Add "Go and enter" as the primary button in the travel sheet (keep "Go" for passing by).
2. **Collapse what you cannot do.** Panels still list every greyed-out section. Fold sections with no usable action behind "Show unavailable (n)", and keep the reason on hover.
3. **Rent and food as a weekly checklist.** The only reminder inside a building is small orange "Needs: food". Show a compact "This week" strip at the top of the panel: Rent (due in N weeks or now, with where to pay), Food, Job. My scripted player paid rent late twice because the game never said where.
4. **Say where to pay rent.** The hint told me to go to the home building; rent is paid at the City Services Counter. (Fixed in the news; check the other hint strings and the tutorial.)
5. **Application odds.** "57% chance you are turned down (the hours are spent either way)" is good, but add why ("needs experience 2, you have 0") and what raises the odds.
6. **Shop items.** "Not available now (1)" is unexplained. Show why (needs a higher outfit, needs a fridge) and the effect of each item before buying.
7. **Hours ring without a unit.** The ring shows "50"; add "h" or "left".
8. **Two entry points to the paper on phones** (banner button plus a News button) cost vertical space. Keep the banner's button, drop the second while the banner shows.
9. **Code-split the bundle.** The build warns about a chunk over 500 kB. Lazy-load setup, art packs and the end screen.

### P2 — worth a milestone

10. **Errand planner.** A week is 60 hours and the JobLink Center is 5 hours from home on foot; whole weeks go on walking. Let the player tick several places and see one ordered route and its total hours, then walk it with one confirm. This is the biggest quality-of-life gap.
11. **A money view.** Rent $325 every four weeks against $5 an hour is unforgiving and the game never shows the sums. Add a weekly budget card: expected income, rent share, food, subscriptions, loans, net. The news can reference it.
12. **Choices on events.** "Friends visit −$61" is a bill, not a decision. Give the common events two options (host or decline, repair or ignore) with different costs; keep single-outcome events for the rest.
13. **Protect the first weeks.** I was laid off ("Automated", two weeks' severance) in week 2 with no earlier warning. With the new watch-list story there is now a warning, but also hold random layoffs off until week 4 or after the first raise.
14. **Rival recap.** During the rival's turn the screen says "Rival is playing… Thinking…". After it, show one line of what they did (worked 6 h, bought a car, enrolled). Offer "skip rival turns" as a setting.
15. **News depth.** Keep an archive of the last eight editions, add rivals' public moves ("Rival took out a loan"), a link on each story to the place that acts on it (bank, JobLink, City Services), and a market chart under the mover.
16. **Rent-hike foresight.** The notice arrives a week ahead; add "you can prepay rent at the current price" as an option and say so in the story.
17. **Explain the goals in play.** "Career 0/50" does not say how to move it. The goal cards have levers; surface the top one as a one-line hint under each bar.
18. **Pack quality gate.** The `core:*` bug shipped because no test asserted that every emitted event id has text. Add a content test: emit every engine and pack event id through `eventCardText` and fail on any raw key.

### P3 — bigger ideas

19. **Modern look.** See `GRAPHICS_PLAN.md`.
20. **Replay value.** Daily seed, challenge modes (no loans, gig only, no car), achievements, and a shareable end card (already partly there).
21. **Multiple cities in play.** `TravelCity` exists in the command list; use the world map for a late-game expansion.
22. **Audio and haptics reactions to news** (paper rustle, market sting) using the existing audio bus.
23. **Localisation beyond English.** The i18n plumbing and the pseudo-locale exist; commission one real translation to prove the pack strings.
24. **Phone landscape and a larger map.** Labels truncate ("Fulfillme…"); use icons plus long-press names, and a landscape layout.
25. **Coaching by need.** Replace the fixed tutorial with hints triggered by first events (first rent due, first loan offer, first layoff warning).

## 3. What worked well

- The scene UI reads clearly: the block, the label plates and the interiors make places feel like places.
- Previews on every action (hours, money, stat deltas, risk) plus disabled reasons are the right pattern.
- Undo, the palette (`/`), and quick travel are excellent for experienced players.
- The satire in the greetings and event text is the game's strongest asset; the new engine-event text follows it.
- Deterministic replays made every finding reproducible from a seed.
