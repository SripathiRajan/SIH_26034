# PRAMAN v4 — Winning Presentation Kit

Everything you need for the panel: the strategy, the full script (with demo cues), a 3-minute cut,
the Q&A war room, a demo failure playbook, and a cheat card.

**Before you present, do these two things:**
1. Time one real scan on the machine you'll demo on and write the actual number everywhere the
   script says `[X sec]` — quote only real numbers.
2. Rehearse out loud 3 times, once on video. The script is written to be *spoken* — if you read
   it, it dies. Speak it.

---

## PART 1 — Strategy: how the judges actually decide

**1. Judges remember one sentence, not your feature list.**
After ten teams, everything blurs. Decide *your* sentence and build the whole pitch around it:

> **"We turned the law itself into code — an AI that gives a package a legal verdict in seconds,
> with the exact rule it violated."**

Say it early, say it at the end. If a judge says it back to the next judge, you've won.

**2. You are not demoing software — you are telling a story with software as proof.**
The arc that wins: *a real person in a real shop has an impossible job → technology has failed
them for a specific, explainable reason → here is the insight that changes that → watch it work →
here's why it can be trusted in court → here's the scale of what that unlocks.*

**3. Name your novelty. Do not hope the judges infer it.**
Explicitly say "there are three things here nobody else has built" and number them. Judges
cannot award novelty they didn't consciously register.

**4. Translate every tech term on first use.**
- PaddleOCR → "the fastest reading engine"
- Ensemble → "if it's unsure, two more engines take over"
- Florence-2 VLM → "a vision-language model that reads curved and blurry text"
- IoU merger → "a geometric merger that fuses all readings into one"
- RAG → "answers retrieved from the actual gazette, with citations"
The panel has both technical and domain judges; the domain judge votes too.

**5. The demo serves the story.**
Scan **one** real package. Show: live coverage strip → verdict screen → one violation with its
rule citation. Stop there. Screen-touring kills momentum. The chatbot gets one question, ten
seconds, done.

**6. Narrate the wait.**
On CPU, OCR can take up to a couple of minutes — your progress-stage timer is a *storytelling
opportunity*, not an embarrassment. Explain the cascade while it runs. Never stand silent.

**7. Only defensible numbers.** (These are all verified in your repo — memorize them.)
- **18** machine-checkable statutory rules encoded (rules_db.json)
- **8** mandatory field categories checked (net qty, MRP, manufacturer, mfg date, best-before, consumer care, FSSAI, country of origin)
- **5-stage** OCR cascade, **3** OCR engines + **1** vision-language model
- **39** backend tests passing; automated precision/recall harness
- **1–6** package angles per session, merged into one verdict
- **0.60** confidence gate → anything below goes to human review, never auto-verdict
- RAG corpus built from **real gazette PDFs** (2022–2023 amendments) with G.S.R. provenance
- Barcode **GTIN cross-verification** against the scanned label

**8. Winning happens in the Q&A, not the pitch.** Rehearse Part 4 twice as hard as Part 2.
An interview-style, calm, "here's our honest answer" tone in Q&A reads as maturity — that's
what separates first place from participation.

**Team split (if 2–3 of you):** one Speaker (owns the room), one Demo driver (owns the phone,
zero talking), one Timekeeper (hand signals at 2:00 and 0:30 remaining). If solo: speaker + phone
propped on a stand so both hands are free.

---

## PART 2 — THE MASTER SCRIPT (6–7 minutes, with demo cues)

Lines in quotes are spoken. [BRACKETS] are stage directions / demo cues. Pause marks: **(beat)**.

### 0:00 — The Hook

> "Good morning. Before I begin — a quick question. **(beat)** The last packet of chips, the last
> bottle of water you bought — did *anyone* check that its MRP, its expiry date, its net weight
> were legally correct?
>
> **(beat)** Nobody did. And that's not your fault. It's the system's.
>
> Every packaged product in India is governed by the **Legal Metrology Act** — that's the law
> behind every rupee symbol, every 'Best Before', every '500 grams' printed on a label. The law
> says a package must carry around ten mandatory declarations. An inspector is supposed to verify
> them — manually, rulebook in hand, at the shop. Fifteen minutes per product if done properly.
> **(beat)** No inspection department can do that at scale. So it simply... doesn't happen.
>
> We built **PRAMAN** — from the Sanskrit *pramāṇa*, meaning proof. An AI inspector that scans a
> package and returns a **legal verdict in [X] seconds — with the exact rule it violated.**"

### 0:45 — Why this is genuinely hard (the setup for novelty)

> "Two things make this hard, and this is where every generic attempt fails.
>
> **Problem one: reading the label.** Real packaging is hostile to computers. Expiry dates are
> printed in dot-matrix — a standard OCR engine reads 'JUN' as **'1-U-N'**. The rupee symbol
> becomes a question mark. Glare, curved bottles, tiny print on the flap. Every off-the-shelf OCR
> demo collapses on a real shop shelf.
>
> **Problem two: even with perfect text — the system doesn't know the law.** Which declarations
> are *mandatory*? Under which rule? What counts as a violation? Google's Document AI can read a
> label. It cannot tell you that **Rule 6(1)(e)** requires the MRP to say 'inclusive of all taxes'.
>
> We solved both. And the second one is our core novelty: **we encoded the law itself.**"

### 1:20 — Novelty pillar 1: Law as Code

> "There are three things in this project nobody else here has built. First — **the law, as
> code.**
>
> We took the Legal Metrology (Packaged Commodities) Rules 2011 — as amended — and the FSSAI
> Labelling Regulations 2020, and converted them into a **machine-checkable rules engine**: 18
> validated statutory rules, each mapped to its exact section citation, fed by a corpus ingested
> from the **actual gazette PDFs**.
>
> So when PRAMAN flags a package, it never says 'MRP not found'. It says: *'Rule 6(1)(e) — MRP
> must be inclusive of all taxes — VIOLATION.'* **(beat)** That output is **evidence-grade**. It
> can go straight into a legal notice. No generic document-AI product does that today."

### 1:55 — Novelty pillar 2: the reading engine built for real shelves

> "Second — a reading engine tough enough for real packaging. It's a **five-stage cascade**.
> Think of it like hospital triage:
>
> The fastest engine — PaddleOCR — tries first. If it's confident and finds every declaration,
> we're done in seconds. **If it struggles —** two more engines, EasyOCR and Surya, take over in
> parallel, with contrast enhancement. **If fields are still missing —** say, text curved around a
> bottle — a vision-language model, Florence-2, does targeted recovery. Finally, a **geometric
> merger** fuses every engine's output into one clean reading.
>
> And here's the field insight: **no package shows everything on one face.** MRP is on the
> bottom, expiry is on the flap. So the officer photographs **up to six angles** in one session —
> and PRAMAN merges them into **one verdict**. It even shows, live, which statutory fields
> you've captured and which are still missing. **The app guides the inspection.**"

### 2:35 — THE DEMO (woven into the story)

**[CUE: phone on stand, app open at Login → log in → Capture screen, live camera on a real package]**

> "Let me show you. This is a real product from a shop near campus. Live camera — I'm capturing
> the front..." **[tap capture]** "...and the bottom." **[tap capture]**
>
> **[POINT at the coverage strip on screen]** "Notice this bar. It's telling us **live** what
> the law demands and what we've captured so far — net quantity found, MRP found, manufacturer
> still missing. The app is literally guiding the officer through the statute. Now — scan."
>
> **[While the progress-stage timer runs — DO NOT go silent:]**
> "While that runs — see the progress bar? That's the **actual pipeline stage**, not a fake
> spinner. Inside: preprocessing, first engine, ensemble fallback if needed, then the compliance
> engine checks every field against the rulebook."
>
> **[Result screen — point, don't tour:]**
> "Here's the verdict. Every mandatory field — green or red. Every violation carries its **rule
> citation**. This is what an inspector would write in the report — except it took [X] seconds,
> not fifteen minutes."
>
> **[If time permits — chatbot, one question only:]**
> "And when the officer asks — 'what does the rule say about MRP declarations?' — our assistant
> answers **retrieved from the gazette itself, with citations**. It never invents law: if the
> language model can't ground an answer in the corpus, it falls back to a statutory template.
> Never a made-up answer."

### 4:45 — Novelty pillar 3: AI honest enough for a courtroom

> "Third novelty — and honestly, the one I care about most. This is AI built to be **distrusted
> in the right places**.
>
> **Zero silent fallbacks** — if a service fails, we return a typed error, never fake data.
> **Honest metrics** — no clamping scores to look better than we are. And any field below a
> **0.60 confidence threshold goes to 'needs review'** — the human decides. The AI never
> guesses on a legal verdict.
>
> Every scan produces an **official PDF audit report**. There's barcode cross-verification of
> the product code against the label. Full authentication, rate limiting, UTC-grade timestamps.
> **For court, that chain of custody matters.**"

### 5:30 — Engineering rigor + field readiness

> "And this is not a notebook demo. **Thirty-nine backend tests pass.** An evaluation harness
> measures per-field precision and recall — and we report failures, not just successes. It's
> **offline-first**: inspections are queued when there's no signal — because shops in India
> don't have great signal — and sync when back online. Deployed on free-tier cloud
> infrastructure — this system is running **today**."

### 6:00 — Impact + close

> "Consumer complaints today take months. With PRAMAN, one officer with one phone covers in an
> afternoon what used to take weeks — with legally citable evidence, in every store, for every
> product.
>
> We didn't build another OCR demo. **We built the law as code.** Reading engines tough enough
> for real shelves. And AI honest enough for a courtroom.
>
> **(beat)** If you remember one line: *every product you buy deserves a legal check — for the
> first time, that check is seconds away.*
>
> PRAMAN. Proof, in seconds. Thank you."

---

## PART 3 — The 3-minute version (when time is short)

> **[0:00]** "Quick question — the last packet you bought: did anyone check its MRP, its expiry,
> its weight were legally correct? **(beat)** Nobody. India's Legal Metrology Act requires around
> ten mandatory declarations per package. Checking takes fifteen minutes per product, by hand.
> At scale — it doesn't happen. We built **PRAMAN**: scan a package, get a legal verdict in
> seconds, with the exact rule violated."
>
> **[0:40]** "Two reasons generic tech fails here. Real labels break OCR — dot-matrix dates read
> as '1-U-N' instead of 'JUN', the rupee symbol becomes a question mark. And even perfect text
> doesn't know the law. So our core novelty: **we encoded the law itself** — 18 machine-checkable
> statutory rules from the Packaged Commodities Rules and FSSAI regulations, each flag carrying
> its section citation. Evidence-grade output."
>
> **[1:20]** "On reading: a five-stage OCR cascade — fastest engine first, two more engines and a
> vision-language model when it struggles, a geometric merger fusing it all. Officers capture up
> to six package angles; PRAMAN merges them into one verdict and shows **live** which statutory
> fields are still missing. The app guides the inspection."
>
> **[1:50] [DEMO — one scan, verdict + one citation, ~45 seconds. If no time: show a prepared
> verdict screenshot]**
>
> **[2:35]** "And it's AI you can trust *because* it's designed to be distrusted: zero silent
> fallbacks, honest metrics, and below 0.60 confidence everything goes to human review — the AI
> never guesses on a legal verdict. 39 tests pass, it works offline and syncs later, and it's
> deployed and running today.
>
> **(beat)** Every product deserves a legal check — for the first time, it's seconds away.
> PRAMAN. Proof, in seconds."

---

## PART 4 — Q&A War Room

Calm, short, honest answers. Never bluff a judge.

**1. "How accurate is it?"**
> "We report accuracy the honest way — an evaluation harness measuring per-field precision,
> recall and F1 against annotated ground truth, and we report failures alongside successes.
> Critically, the system is designed so it never *silently* errs: below the 0.60 confidence
> gate, a field goes to 'needs review' instead of producing a verdict. In enforcement, a
> flagged-for-review is safe; a confidently wrong answer is a lawsuit."
> ⚠️ Do NOT quote "100% F1" from the harness — it currently runs on a small benchmark set, and
> a sharp judge will ask how many samples. If pressed: "Our published benchmark set is small and
> we say so; the architecture's guarantee is the confidence gate and human review, not a
> vanity metric."

**2. "Why not just use GPT-4V / Gemini directly on the photo?"**
> "Three reasons. One: hallucination — in legal enforcement a fabricated field is worse than a
> missing one, so the VLM in our cascade is only a *targeted recovery stage*, and every accepted
> field traces back to a real OCR token with a confidence score. Two: determinism — our verdicts
> come from a coded rules engine with citations, not a black box. Three: cost and offline
> operation — the cascade *exits early* when the fast path succeeds, so most scans never pay for
> a large-model call."

**3. "What if it wrongly flags an honest business?"**
> "It can't act on its own. PRAMAN is decision *support*: low confidence goes to 'needs review',
> the officer verifies, and the officer signs the PDF report. Every flag carries its rule text
> so the officer can check it in seconds. The AI proposes; the human decides."

**4. "Rules get amended. How do you keep up?"**
> "That's exactly why we built a gazette ingestion pipeline — our corpus is generated from the
> official amendment PDFs, like the 2022 and 2023 PCR amendments, with G.S.R. provenance. When a
> new amendment drops, we ingest the PDF, and both the RAG knowledge base and the rules database
> update. The law is data, not hardcoded strings."

**5. "Doesn't this already exist?"**
> "Document-AI products — Google's, AWS's — extract *text*. None encode the Legal Metrology
> (Packaged Commodities) Rules as a machine-checkable engine with citations, none merge
> multi-angle captures into a single statutory verdict, and none apply domain-specific repairs
> like dot-matrix date normalization — '1UN/2026' to 'JUN/2026' — which is our own code, not any
> OCR vendor's."

**6. "What about regional-language labels?"**
> "The retrieval layer already uses multilingual sentence embeddings, and our patterns are
> tolerant of common label variants. Full Indic-script OCR is on our roadmap — tier one covers
> English declarations, which carry the statutory fields on most packaged goods; the cascade
> architecture means we add an Indic engine without touching the compliance layer."

**7. "Can't a manufacturer just fake the label?"**
> "PRAMAN validates the *declarations against the law* — that's the inspector's statutory job.
  For authenticity we added barcode GTIN cross-verification of the product code against the
> label. Counterfeit detection at scale would be phase two — the capture infrastructure is the
> same."

**8. "Cost and scale?"**
> "It runs on free-tier cloud infrastructure today — deliberately. The stateless parts scale
> behind a load balancer; the one piece of in-memory state, the capture sessions, moves to Redis
> when we go multi-instance. For a state department, cost per inspection approaches zero — that's
> the point."

**9. "Why the 0.60 threshold specifically?"**
> "It's precision-first calibration: a false accusation costs an honest business; a
> needs-review costs the officer ten seconds. We bias hard toward review. The threshold is a
> config, not a dogma — we'd tune it per state department with real-world feedback."

**10. "What did YOU each build?"**
> Prepare honest one-liners per member. Structure: "I owned [layer], the hardest bug there was
> [X], and I also did [Y]." Judges smell rehearsed vagueness instantly.

**11. "What's next?"**
> "Three things: Indic-language OCR so it works everywhere in India, a department dashboard so
> a district officer sees violation heatmaps across inspectors, and expanding the rules engine
> from declarations to measured compliance — like net-quantity verification against a weighing
> scale. The rules engine makes all three an extension of data, not a rewrite."

**12. "What happens when OCR just fails on a badly printed package?"**
> "It tells you the truth. After the full cascade — three engines plus the vision-language
> model — missing fields show as missing with a hint of what to recapture, and the session asks
> for another angle. We return a typed error or a coverage gap, never a guessed field. That's the
> 'zero silent fallbacks' principle doing its job."

---

## PART 5 — Demo Failure Playbook

| Failure | Move |
|---|---|
| WiFi drops | Switch to **Demo Mode** (already built) — say "and for field conditions with no network, Demo Mode"; it's a *feature moment*, not an apology |
| OCR slow (CPU) | The progress-stage timer is your narration script — explain the cascade stage by stage; never stand silent |
| Scan fails on the chosen product | "Perfect — this is real-world AI. Watch the cascade escalate: engines 2 and 3 now take over." (This is still novel content.) Then rescan the backup product |
| Backend down | Pre-recorded 60–90s screen video on the phone as last resort; say "a recorded scan from this morning" |
| Bad lighting in the hall | The glare detector flags it — narrate it: "the system is telling me to retake, that's built in" |

**Morning-of checklist:**
- [ ] Scan your chosen product **that morning**; verify the verdict + a real violation shows
- [ ] Backup product tested, ready (one fully compliant, one non-compliant)
- [ ] Demo Mode toggled and tested; laptop hotspot ready
- [ ] Video backup on phone
- [ ] Backend restarted 10 min before; `py -3.11` runtime, not default python
- [ ] Phone charged, stand ready, brightness max

---

## PART 6 — Cheat Card (memorize cold)

**The one sentence:** "We turned the law itself into code — an AI that gives a package a legal
verdict in seconds, with the exact rule it violated."

**Three novelties, one breath each:**
1. **Law as code** — 18 machine-checkable statutory rules with gazette citations → evidence-grade verdicts.
2. **Shelf-proof reading** — 5-stage OCR cascade + 6-angle capture, merged into one verdict, with live statutory coverage.
3. **Honest AI** — zero silent fallbacks, honest metrics, 0.60 gate → human review; PDF audit trail.

**The numbers:** 18 rules · 8 mandatory field categories · 5 stages · 3 engines + 1 VLM ·
39 tests · 1–6 angles · 0.60 gate · real gazette PDFs (2022–23 amendments).

**The close:** "Every product you buy deserves a legal check. For the first time, it's seconds
away. PRAMAN — proof, in seconds."

**Laws, named correctly:** Legal Metrology Act 2009 · LM (Packaged Commodities) Rules 2011
(as amended) · FSS (Labelling & Display) Regulations 2020.
