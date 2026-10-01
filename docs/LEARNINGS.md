# Learning log

What building this app taught me, kept for the same two reasons as the
[workout tracker's log](https://github.com/sartaj1995/workout-tracker/blob/main/docs/LEARNINGS.md):
so the next small web app goes faster, and so the lessons that aren't really
about code come with me to client work.

Same format. Each entry is **what happened here** → **the thing that
generalises**, with commit hashes in brackets so the full reasoning is a
`git show <hash>` away. Written after the first twenty-four pull requests,
28 August to 25 September 2026, from the commit messages and the
conversations behind them.

This log doesn't repeat that one. Where a lesson from there came back here,
the entry is marked **again**, and the fact that any came back at all is the
first lesson.

## The three I'd keep

1. **Lessons travel as artefacts, not prose.** Turn each one into a checklist
   item, a template or shared code, or expect to learn it again [`31af7e1`,
   `737959f`].
2. **The dangerous number is the plausible one.** Pin the figures that matter,
   have someone who knows the domain read the output, and ask outright where
   it could be confidently wrong [`ce26611`].
3. **Ask "why?" before approving**, whether the recommendation comes from a
   teammate, a vendor or a model. One that can't survive being explained
   wasn't one [`4dfa9f7`].

---

## 1. How lessons actually travel

### Three lessons were written down, and came back anyway

| Lesson, as written in the workout tracker's log | Written | Back here |
|:--|:--|:--|
| Surface failure where attention already is | 28 Aug | 24 Sep: backup status lived only in Settings, and the dashboard said nothing [`737959f`] |
| Call a popup inside the tap, with its library already loaded | 6 Sep | 24 Sep: Safari blocked the first tap, because Google's script loaded inside it [`1790037`] |
| Write claims that don't decay | 6 Sep | 11 Sep: the README's test count was stale [`bc9214d`]. When this log was written it was stale again: 382 claimed, 436 run |

What did travel was code. The Drive layer was ported from the workout tracker
on 29 August, and every safeguard that lived in its `lib/` came along: the
narrow `drive.file` scope, the guard that stops a fresh device overwriting a
good backup, the retry for a backup still owed [`31af7e1`]. The banner that
made failures visible lived in a page component, so it stayed behind, and
this app rebuilt it four weeks later.

> **Generalises:** a lessons-learned document mostly gets read once, by the
> person who wrote it. What carries a lesson into the next project is an
> artefact that acts without anyone remembering it: shared code, a template, a
> test, a checklist read at the moment of work. When closing out any piece of
> work, ask of each lesson "what will make this happen next time?" If the
> answer is "someone rereads the debrief", assume it won't. Hence the
> checklist at the end, and why it belongs in the next project's `CLAUDE.md`,
> which the agent reads at the start of every session.

---

## 2. Confident wrong answers

### The bugs that mattered never crashed

| The app said | The truth | Caught by |
|:--|:--|:--|
| 110/100 is **Normal** | Diastolic stage 2 | Me, looking at the chart [`ce26611`] |
| "Average 116" for blood pressure | The average *systolic*, unlabelled | Me, the same morning [`a6965a3`] |
| Hemoglobin 12.5 in a woman is **Low**, in red | Mid-normal | The agent's audit. I deferred it; it shipped when real users arrived [`4dfa9f7`] |
| `Vitamin D (25-OH) : 41.9` is **25**, *Insufficient* | 41.9, *Sufficient* | A parser test, before it shipped [`6778bd3`] |
| `Post Prandial (120 Min) 142` is **120**, in range | 142, over the 140 cutoff | A test written while adding PP glucose. The fasting form of the bug was already live [`bc9214d`] |
| Lp(a) 85 nmol/L is **Very high risk** | *Borderline*, once converted | The agent, while designing the import, before it shipped [`33f372c`] |
| BMI uses the height you can see in Settings | It used an older height reading | The agent, when I suggested retiring height [`723c82a`] |
| "Saved" | Nothing was stored | The agent's audit [`737959f`] |

None threw an error, and none looked wrong on screen. Tests caught the two
they were written to catch. I caught two by looking at a chart and thinking
"that can't be right". The agent found the other four: two in audits I had
asked for, two while thinking through the consequences of a change.

> **Generalises:** the costly errors in a model or a deck are the plausible
> ones. A broken formula announces itself; a lookup against the wrong segment
> just returns a number. There are three defences, and each one caught
> something here that the others missed: checks pinned to the numbers that
> matter, someone who knows the domain reading the output and asking "does
> that make sense?", and an audit that asks specifically "where could this be
> confidently wrong?"

### A feature that nothing reads is decoration

The diastolic reference ladder had been in the catalogue since the first
commit, with the right cutoffs. Every one of the seven `classify()` calls
passed the systolic alone, and no test touched the second ladder, so it sat
there looking like a feature [`ce26611`]. The same morning the same cause
turned up in the statistics: `summarize()` read `value` and never `value2`
[`a6965a3`].

> **Generalises:** being in the model is not the same as being used by it. An
> input tab, a column or a scenario switch can sit in a workbook looking like
> coverage while nothing downstream reads it. Change it and see what moves. If
> nothing does, it's decoration, and every reviewer will assume it isn't.

### Prose is where the model admits what it can't do yet

Five of the seven sex-specific ranges were already in the app, as help text:
"Male reference. For women the normal range is roughly 12.0-15.5." Prose
can't classify a reading, colour a pill or keep something off a list. Moving
those numbers out of sentences and into bands was most of the fix
[`4dfa9f7`].

> **Generalises:** a footnote saying "this figure is wrong for segment X"
> means the figure is wrong for segment X. A caveat is often a record of
> something the model couldn't express yet. Fix the model, then delete the
> caveat.

### Two copies of a fact will eventually disagree

Height lived in Settings and as dated readings. Logging a reading copied it
into Settings, but once any reading existed BMI ignored Settings: log 170,
correct Settings to 175, and the screen said 175 while every BMI used 170
[`723c82a`]. The first-run setup was built the other way round. No step keeps
its own "done" flag; each reads the profile, so setup can't disagree with
Settings or with a restored backup [`83f4262`].

> **Generalises:** "one version of the truth" is a structural choice, not a
> slogan. Every duplicated figure, whether pasted into a deck, retyped into a
> summary tab or kept in two trackers, is a future disagreement with no record
> of which copy is right. Derive instead of copying. And if people see one
> copy while the system uses the other, the system is lying to them.

### A combined statistic can describe a reading that never happened

When blood pressure's Lowest and Highest had to cover both numbers, the
obvious rendering, "Lowest 110/78", would have described a reading that never
happened: the lowest systolic and the lowest diastolic came from different
days. Each statistic names its two numbers instead [`a6965a3`].

> **Generalises:** the minimum of one field and the minimum of another, taken
> from different records, is not a record. The same goes for best-in-class
> composites and personas assembled from averages. When a summary combines
> extremes across fields, check that it describes something real, or label it
> as a composite.

### When the values overlap, check the label, not the number

Total T3 runs 80-200 ng/dL and free T3 about 3 pg/mL, so a floor of 10
catches free T3 entered by mistake. Free PSA runs about 0.8 ng/mL, which is
also an entirely ordinary total PSA, so no range check can tell them apart.
The importer refuses those lines by their wording instead, and counts them as
missed rather than dropping them quietly [`1297e22`].

> **Generalises:** a sanity range only catches mistakes of a different
> magnitude. Gross and net revenue, bookings and revenue, reported and
> like-for-like growth all land in plausible ranges for one another. When the
> wrong metric looks as reasonable as the right one, only its definition can
> catch it. Check what a number *is* before checking whether it looks
> reasonable.

### Normalise units on the way in, and show the original

Labs print Lp(a) in mg/dL or nmol/L. Left alone, 85 nmol/L is stored as
85 mg/dL and shown as **Very high risk** when it is *Borderline*. The
conversion is itself an estimate, since there is no fixed factor, but the
usual 2.15, with the original shown at confirmation, beats storing the wrong
unit [`33f372c`].

> **Generalises:** units are where merged data goes silently wrong:
> currencies, monthly against annual, thousands against millions, fiscal
> against calendar years. Convert on the way in, keep the original visible
> beside the converted figure, and prefer approximately right and visible to
> exactly wrong.

### Write down what must not match

Three parser bugs had one shape, a number in the label read as the result:
"Vitamin D (25-OH)" gave 25, "(8-12 hrs)" gave 8, and "(120 Min)" would have
given 120 [`6778bd3`, `bc9214d`]. The PP glucose aliases all name the timing.
There is no bare "glucose" or "blood sugar", which would claim a random
glucose and judge it against post-meal ranges, and a "does not claim" test
enforces that. The spelling tests only measure coverage; that one protects the
rule [`bc9214d`].

> **Generalises:** inclusion criteria get written down and exclusion criteria
> get forgotten. A filter, a search, a segment or a market definition is
> defined as much by what it refuses, and the convenient shortcut ("just add
> 'blood sugar'") passes every positive check. Test the refusals.

---

## 3. Product judgement

### Who the users are decides the backlog

On 1 September I put sex-aware ranges on hold because I was the only one using
the app. On 10 September my parents became users, two non-technical iPhone
owners, and the same item went to the top [`4dfa9f7`], followed by failures I
could never have hit on my Android phone [`737959f`, `1790037`]. `main` had
also quietly become production for two people who can't troubleshoot it.

> **Generalises:** a priority list is a function of who the stakeholders are,
> and it expires without notice when they change: a pilot going live, a new
> business unit, a regulator taking an interest. Record *why* each item was
> deferred, so you can tell when the reason stops holding.

### Agree the principles early; they settle later arguments

The README promised "no network request that carries a reading". For lab
import, the agent first proposed a Claude API call to extract the readings,
then reversed itself while building it, because a lab report is the most
identifying thing the app touches. Plain-code parsing proved enough: 26 known
metrics, known units, regular layouts [`6778bd3`]. The same promise put
pdf.js's worker in the bundle rather than on a CDN [`09c60b3`].

> **Generalises:** a principle agreed at the start is a decision rule for
> arguments you haven't had yet. Here it turned "AI would be easier" into a
> one-line call. It only counts as a principle if it sometimes costs
> something, and this one cost the easy option. Principles signed off in week
> one are what let a team settle week-six debates without escalating them.

### A confirmation step lets automation be useful instead of perfect

The importer saves nothing until the rows are confirmed, and it leaves
implausible values unticked so a misread can't be saved by reflex. PDF text
lands in the paste box rather than going straight into readings, so a bad
read is visible [`6778bd3`, `09c60b3`].

> **Generalises:** an 80% extractor, classifier or auto-categoriser is
> shippable if a person confirms its output where an error would land. Decide
> where the review sits before tuning accuracy, because that is often what
> makes good enough good enough. (A sibling of the workout tracker's "a
> confident wrong guess costs more than a question".)

### When you have to guess, guess towards the cheap error

"Is this an installed app?" decides between a sign-in popup and a full-page
redirect. A wrong yes sends a browser tab through Google's page for nothing; a
wrong no leaves an iPhone app on "Connecting..." forever. So the check leans
towards yes [`1790037`]. In the same way, a sex left unset keeps the male
ranges, the only default that changes nothing already saved, but says so
above every reading it affects [`4dfa9f7`].

> **Generalises:** accuracy is the wrong target when the two errors cost
> different amounts. Set the threshold by what each mistake costs, which is
> the precision-recall call behind any churn model's cut-off. And when a
> default is unavoidable, name it where it does its damage, so a hidden wrong
> answer becomes a visible, fixable one.

### A dashboard needs an opinion

Every metric had the same 317x122 card, so 26 metrics made a two-screen page
that grew about 45px per metric, forever. The one block that worked, "worth a
closer look", worked because it was prioritised. Now the exceptions come
first, then a few pinned cards, then compact rows grouped the way a lab report
groups them, each showing its status only when out of range. The page went
from 1882px to 1307px, and a new metric costs about 24px [`c7d62b3`]. It took
me saying so, because the agent will keep extending a structure long after it
has stopped working.

> **Generalises:** a dashboard that weights everything equally has no
> opinion, and it gets longer rather than better. Manage by exception: keep
> the in-range quiet so the eye lands on what needs action. And measure the
> marginal cost of one more item, which tells you whether a structure scales
> before the reader does.

### Make a deliberate omission look deliberate

Lp(a) has no re-check reminder. It is set by a gene and holds for life, so a
repeat test can only tell you what you already know. The obvious tidy-up is to
give it the 365 days its neighbours have, so a test is named for the omission
[`33f372c`]. T4 was left out on purpose too, and the commit says what that
costs [`1297e22`].

> **Generalises:** an unexplained gap looks like an oversight, and someone
> will helpfully fix it. Record exclusions with their reason, out of scope
> *because*, wherever the next person will look.

### Retire, don't delete (**again**)

Height stopped being a metric but stayed in the catalogue as retired, so its
old readings still show and can still be deleted [`723c82a`]. This one did
transfer: nine days later, hiding PSA for women was turned down partly
because a metric pulled out from under its readings strands them [`4dfa9f7`].

> **Generalises:** a lesson learned recently, in the same project, by the same
> people gets applied. Anything further away needs the help described in
> section 1.

---

## 4. Numbers on a chart

### Smooth only where there's noise, and never rewrite the past

Ninety daily weigh-ins made a zigzag that hid the trend. A seven-day mean now
carries the line, trailing rather than centred, because a centred window lets
tomorrow's reading move today's point, so the chart would rewrite its past
every time you logged. It only appears with at least eight readings and a
median gap of four days or less (the median, so one fortnight away doesn't
switch it off), and the tooltip shows both numbers [`30d9581`].

> **Generalises:** a trend line that revises its own history erodes trust in
> every chart beside it, so use trailing measures for anything tracked over
> time. Smooth only where there's noise to remove, because on sparse data a
> smoother draws a confident curve through three dots. And show raw and
> smoothed together, so they never disagree without explanation.

### Don't claim more evidence than you have

The change under the chart is measured from the readings, not the range
button: pick 1Y with four months of data and it says four months. It also says
"Down 3.7 kg over 3 months" instead of comparing the last two readings, which
only ever answered "what happened since Tuesday" [`30d9581`]. Under four
readings the line stays dashed and says there's too little to call a trend
[`6dfcc09`].

> **Generalises:** label the evidence you have, not the window you asked for.
> "Over 12 months" on four months of data is an overstatement nobody catches
> until someone does, and then they discount the rest of the page. Lead with
> the change over the horizon the reader cares about, and show n.

### Reshape the data, not every calculation

Blood pressure's average, extremes and trend were all silently systolic.
Instead of teaching each calculation about pairs, `asSeries()` reshapes the
data. The diastolic view is the second number promoted into the first,
carrying its own reference ladder, and every existing calculation works
unchanged [`a6965a3`].

> **Generalises:** when a new dimension breaks many consumers, transform the
> input once rather than patching each consumer. A second code path is one more
> thing to forget, and forgetting it is how "average" came to mean "average
> systolic". In analysis, the same goes for normalising the dataset once
> instead of adjusting each chart.

---

## 5. Designing for the people actually using it

### Your own device is a sample of one (**again**)

Everything that broke for my parents was invisible from my Android phone.
Safari has no install prompt, only Share, then Add to Home Screen. An app
opened from the Home Screen keeps its storage apart from Safari's, so the
same address can open empty. And an installed iPhone app can never complete a
sign-in popup, because iOS opens it somewhere the app never hears back from
[`1790037`].

> **Generalises:** the workout tracker's lesson was about *where* the user
> stands; this one is about *what they hold*. Test on the users' actual
> devices and channels before calling anything done. Your own setup is rarely
> theirs.

### Two good rules can break each other (**again**)

Google's sign-in script was deliberately loaded only when someone tapped
Connect, so nobody loaded Google's code until they asked for Drive
[`31af7e1`]. But Safari only opens a popup while the tap is still being
handled. The script arrived 19ms later, in a separate task, so the first tap
was always blocked. It now loads while the Drive card is on screen, and
nothing waits between the tap and the popup: 4ms, measured [`1790037`]. The
workout tracker fixed exactly this on 29 August, the day this app's Drive
code was ported from it.

> **Generalises:** optimisations interact. A privacy-and-performance choice
> that was right on its own broke a platform constraint that nobody had
> written down beside it. When you add an optimisation (lazy loading, a cache,
> a cost cut, a process shortcut), check it against the constraints, not only
> against the goal.

### Silence is a decision (**again**)

A failed save went nowhere. `void localRepo.save(...)` discarded the
rejection, so with storage full or blocked the reading appeared and the chart
moved, but nothing was kept. Backup status lived only in Settings. Now every
screen says when saves fail, and the dashboard counts readings that no backup
holds, quietly at first and firmly after a week (Safari's window for clearing
an unused site) or ten readings [`737959f`].

> **Generalises:** silent failure usually arrives disguised as tidiness: a
> `void` that quiets a lint warning, an error caught and logged nowhere, an
> action item marked "noted". Each is a decision not to hear about a problem.
> And set escalation by the real risk window, here Safari's seven days, rather
> than by a round number.

### A backup you can't restore isn't a backup

Exporting JSON counts as a backup. Exporting CSV doesn't, because a CSV can't
be imported back [`737959f`].

> **Generalises:** define "done" by the recovery path, not the export. A
> handover the client team can't run, a model nobody else can refresh and a
> process document nobody can follow have all been exported, and none of them
> can be recovered from.

### Stamp the time of capture, not of completion

`lastSyncedAt` was stamped when an upload finished, so a reading saved
mid-upload counted as backed up when it wasn't. It's now stamped when the
snapshot is taken [`737959f`].

> **Generalises:** an "as of" date is when the data was captured, not when the
> report went out. Stamp at completion and you claim coverage of everything
> that changed in between.

### Offer, don't force, and keep each answer as it's given

The first-run setup asks one question a screen: height, sex, pins, backup.
Every step can be skipped, and each answer is saved the moment it's given, so
leaving halfway loses nothing. "Skip" stays visually secondary so the screen
never nudges anyone towards it. The choices keep their order while someone
picks, so nothing moves under a finger, and height takes feet and inches,
because plenty of people know theirs as "5 ft 6" [`83f4262`].

> **Generalises:** onboarding a user, a client team or a new joiner goes best
> as small, skippable steps in the person's own units, each one kept as it's
> given, so that stopping halfway costs nothing.

### Every setup step is one somebody will forget

Drive backup needs its own Google Cloud project, because the consent screen is
per project and a shared one names the wrong app, plus the right redirect
addresses. When the first-run needed a Home Screen sign-in to come back
somewhere new, it reused the one registered address and forwarded from there,
instead of adding a second one to register [`31af7e1`, `83f4262`].

> **Generalises:** every manual configuration step is a future outage that
> will happen to somebody else: whoever redeploys, forks or inherits it.
> Design steps out where you can, and where you can't, write them down in the
> order they're needed. At any handover, count the things the receiving team
> has to remember to do.

---

## 6. Working with an AI coding agent

### The world and the code need different reviewers (**again**)

The agent couldn't have known that 110/100 was wrong (I read the chart), about
Lp(a) (a doctor mentioned it), about PP glucose (labs draw it alongside
fasting), that adult height barely moves, or that the users would be on
iPhones. I wouldn't have found the 25 in "Vitamin D (25-OH)", a `void`
swallowing failed saves, two heights disagreeing, or male ranges hiding in
help text.

> **Generalises:** this is the workout tracker's split, with more evidence.
> Bring the world, meaning domain conversations, real use and who the users
> are, and let the agent bring exhaustiveness. Every row of the table in
> section 2 needed one side or the other, and neither side would have found
> all of them.

### Ask for the audit, then make the scope call

Four times I asked some version of "what can we improve?" Each answer came
back ranked and evidenced, with the file and line, the failure it causes and
the fix. I took some items and put others "on hold right now", and the
deferred list was there to pick up when the users changed [`4dfa9f7`].

> **Generalises:** use the agent like a diagnostic team. Ask for ranked
> options with evidence, then decide the scope yourself and keep the parking
> lot. That's the shape of a good steering-committee page (options, impact,
> recommendation, decision), and the parking lot is what lets you re-plan
> quickly when the situation shifts.

### Ask "why?" before approving

The agent proposed hiding PSA for women. I asked for its logic before
deciding, and in laying it out the agent talked itself out of it. Sex changes
nothing about PSA's ranges, only whether it's relevant, so hiding it would be
a different feature riding on the same field. And hiding a metric strands its
readings, which height had just taught us. PSA stayed [`4dfa9f7`].

> **Generalises:** "why?" is the cheapest review there is. A recommendation
> that can't survive being explained wasn't one, and asking before approving
> catches it before it ships rather than after, whether it came from a team
> member, a vendor or a model.

### A framework is an input, not an answer

The design skill's headline recommendation was a landing-page pattern in
"Exaggerated Minimalism", with 900-weight headlines suggested for fashion and
luxury brands, for a form you tap a number into each morning. Its primary
colour, cyan-600, measured 3.4:1 and fails as text. The domain searches were
good. The redesign kept those, demoted the colour to chart ink (where 3:1 is
the bar), and chose every token against a measured contrast ratio
[`6dfcc09`].

> **Generalises:** a framework's generic answer has to be tested against the
> context, and measurable criteria are what let you overrule it on evidence
> rather than taste. Let the framework supply structure and coverage, not the
> answer. (Also, the redesign only became coherent once it had a design system
> to work against. "Make it look better" isn't a brief.)

### Look at the rendered thing

DOM checks passed while the screenshot showed "HbA..." and "Vitam...", labels
clipped at panel width [`c7d62b3`]. Every test passed while the first-run's
choices jumped under the finger, because the data was right and only the
layout moved [`83f4262`]. "Six buttons fit" was a guess until it was measured
at 290 of 311px [`6a41f54`].

> **Generalises:** each kind of check catches its own class of failure.
> Numbers that tie out can sit on a slide that misleads, and a model that
> reconciles can still be unreadable. Look at the output the way its reader
> will, at the size they'll see it.

### Prove the check can fail

The first test suite was mutated before it was trusted: nudging HbA1c's
cutoff from 5.7 to 6.0 failed the test that names that boundary [`58b142d`].
The fasting-glucose regression test ran before the fix and failed with
"expected 8 to be 95", which is what let the PR say the bug was real rather
than suspected [`bc9214d`].

> **Generalises:** a check that can't fail tells you nothing. Perturb an input
> and confirm the output moves, and reproduce a problem before claiming the
> fix. In a model review, change one assumption and see whether the right
> things change, and only those.

### Separate the principle from the parameter

`backupNudge()` takes its facts as arguments and never reads the clock, so
tests cover hundreds of combinations without faking time. Its tests come in two
kinds: invariants any sensible rule must meet (never quieter as more readings
wait) and pins on the thresholds chosen. Changing a threshold fails only a
pin, and the pin is named after the decision you changed [`737959f`].

> **Generalises:** in any model, the logic (which must hold for every input)
> and the assumptions (which are judgement calls) deserve different checks and
> different owners. Keep assumptions as named inputs rather than numbers buried
> in formulas, so that changing one is a visible decision, not an edit.

### Build the seam at the first variation

The `HealthRepo` interface let Drive backup land as an additive PR
[`31af7e1`]. `bandsFor(metric, profile)` existed for a single case, WHO
against South-Asian BMI cutoffs, and it made sex-aware ranges a six-file
change instead of one that touched every screen [`4dfa9f7`]. One list of chart
windows made 3Y and 5Y a two-line change [`6a41f54`].

> **Generalises:** when a value first depends on a setting, route it through
> one resolver, even for one case, and the second case is nearly free. In a
> model that means scenario switches and lookup tables, so that "can we also
> see it by region?" is a new row rather than new formulas.

### Defaults ship

Three times the agent left a decision to me as an exercise: the backup-nudge
thresholds, how to recognise an installed app, and which metrics to suggest
pinning. Each time I pressed Create PR with the exercise still open, the agent
filled in a default and flagged it as mine to change, and all three merged as
filled [`737959f`, `1790037`, `83f4262`].

> **Generalises:** whatever is in the draft at the deadline is the answer. So
> make every placeholder safe and visibly flagged, since placeholder numbers in
> a draft deck end up in front of clients. And if a decision is really yours,
> make it before momentum makes it for you.

### Say what went wrong in the same breath as what went right

The README's account of how the app was built lists what the agent got right
*and* where it needed steering. The steering is the part worth reading,
because a list of wins reads as marketing [`b00e15f`]. The agent held itself
to the same standard. It reported two bugs it introduced and caught during the
redesign, a careless `git checkout` that wiped its own uncommitted work during
the dashboard change (redone and re-measured, and said so), and "not verified:
the live OAuth round-trip" [`6dfcc09`, `31af7e1`].

> **Generalises:** candour about misses is what makes the surrounding claims
> credible, whether in a status update, a case study or a steering-committee
> readout. A list of only wins gets discounted wholesale. (**Again**: the
> workout tracker's "say what you verified and what you didn't".)

---

## Next time: the checklist

Both apps' lessons in one list, folding in the workout tracker's. Copy it into
the next project's `CLAUDE.md` on day one. A checklist the agent reads at the
start of every session gets applied; this log only gets applied if someone
remembers it.

**Before starting**

- Who will use it, on what device, and where are they standing? Test there.
- Can it have no backend? No accounts, no server, no cost, no ops.
- Write the promises down: privacy, offline, no account. They'll settle
  trade-offs later.
- Narrowest permission scope that skips a review, and one Cloud project per
  app. With a non-sensitive scope, publish the OAuth app, because Testing
  means a test-user list and full re-consent after seven days.
- What does the first run look like for someone who isn't me?

**While building**

- One copy of each fact, with everything else derived. Key on content, never
  on position.
- Store the fact, not a proxy that expires on its own schedule.
- Route any value that depends on a setting through one resolver, from the
  first case.
- For every field in the data, what reads it? For every caveat in help text,
  should it be a rule?
- For every parser or filter, what must it refuse? Test the refusals.
- Normalise units on the way in, and show the original.
- For every number shown, what claim is it making? Does it overstate the
  evidence, mix unlike things, or combine records that never coexisted?
- Surface every failure where attention already is. No `void` on a promise
  that can fail.
- Confirm every destructive action, naming what will be lost. Automate only
  the reversible direction.
- For every automated guess, what does a wrong one cost? Lean towards the
  cheap error, and keep a confirmation where the error would land.
- Call anything gated on a tap (popups, audio, permissions) inside the
  handler, with everything it needs already loaded.
- Make every placeholder safe to ship as it is.

**Before shipping a change**

- Walk the zero state: fresh device, empty data, first run.
- What does an existing install do with this? Think about stored settings, a
  cached shell and the precache list.
- Look at it rendered at 375px, in both themes, not only through the tests.
- Make each new check fail once, on purpose.
- What else describes this: README, screenshots, counts? Write numbers so they
  can't go stale.
- Say what was verified and what wasn't.

**After shipping**

- Use it for real, on the users' devices, and fix what that finds first.
- On iPhones, installing is Share, then Add to Home Screen, and Safari never
  prompts, so tell people.
- Share the production address. Per-deployment Vercel URLs sit behind a login
  and can't be installed.
- When the users change, re-rank the parking lot.
- When a fix rests on how something behaves, measure the behaviour.
