import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { CareRing } from "@/app/(app)/_components/care-ring";
import { Icon, type IconName } from "@/app/_components/icon";
import { Wordmark } from "@/app/_components/mark";

const FREE = [
  "Every safety feature",
  "Today and the last 30 days",
  "One dog, with all its conditions",
  "90-day summary and full CSV export",
  "Your first designed vet report and sitter page",
  "A basic cycle summary and annual review",
];

const PLUS = [
  "Full history, kept for as long as your account exists",
  "Observations across the full history. Observations get stronger with more history.",
  "Results, charts, the injection-cycle overlay and trend notices for all time",
  "Unlimited designed vet reports, ready to download and send to your vet",
  "Appointment preparation: a report prepared for you, and three things worth asking",
  "Unlimited sitter pages",
  "The stress-event planner",
  "Medicine stock and expiry tracking",
  "Text messages for red alerts, if you opt in",
  "The full cycle summary and annual review",
  "Up to 3 dogs",
  "The weather overlay, after launch",
];

const FREE_FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "call",
    title: "Emergencies",
    text: "The emergency card, QR tag and crisis checklist. Seizure and crisis capture, with the timer and the published escalation points. Crisis alerts and emergency mode.",
  },
  {
    icon: "reminder",
    title: "Doses and injections",
    text: "The dose tick and all four reminder layers, including the calendar feed. The injection countdown, treatment log and reminders. The Reminder health screen.",
  },
  {
    icon: "careTeam",
    title: "Household",
    text: "Up to 3 people on one shared list, with the double-dose guard and escalation to the other person.",
  },
  {
    icon: "today",
    title: "Daily records",
    text: "The quick check and symptom log, vet-visit mode and milestones. All conditions for one dog, with today and the last 30 days on screen.",
  },
  {
    icon: "vetVisit",
    title: "Records you can always take with you",
    text: "A plain 90-day summary, always. A full CSV export of everything held. Your first designed vet report and your first sitter page.",
  },
];

const SECTIONS = [
  { href: "#how", label: "How it works" },
  { href: "#household", label: "Household" },
  { href: "#emergency", label: "Emergency" },
  { href: "#vet", label: "Vet visits" },
  { href: "#price", label: "Pricing" },
];

/*
 * The pictures of the app on this page name each medicine and when it is
 * given, never an amount: only an owner's own entry, from their vet, shows one.
 */
export default function Home() {
  return (
    <div className="lp">
      <header className="ink lp-hdr">
        <div className="lp-wrap lp-bar">
          <Link className="wm" href="/" aria-label="Tailhelm home">
            <Wordmark size={32} textStyle={{ fontSize: 24 }} />
          </Link>
          <nav className="lp-nav" aria-label="Main">
            {SECTIONS.map((s) => (
              <a key={s.href} className="opt" href={s.href}>
                {s.label}
              </a>
            ))}
          </nav>
          <div className="row gap-8">
            <Link className="lnk" href="/sign-in" style={{ padding: "0 12px", textDecoration: "none" }}>
              Sign in
            </Link>
            <Link className="btn btn-primary btn-sm" href="/sign-in" style={{ padding: "0 20px" }}>
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main>
        <div className="ink lit lp-hero">
          <section className="lp-wrap" style={{ paddingTop: "clamp(56px, 8vw, 104px)" }} aria-labelledby="hero-h">
            <div className="stack-24" style={{ maxWidth: 820, margin: "0 auto", textAlign: "center", alignItems: "center" }}>
              <p className="eyebrow">Care log for dogs with lifelong conditions</p>
              <h1 id="hero-h" className="lp-h1">
                For dogs who can&rsquo;t miss a dose.
              </h1>
              <p className="lp-lead" style={{ maxWidth: 680 }}>
                One exact record of every dose, injection and check, shared by everyone who looks after your dog. Starting with Addison&rsquo;s
                disease.
              </p>
              <div className="row gap-16" style={{ flexWrap: "wrap", justifyContent: "center", paddingTop: 8 }}>
                <Link className="btn btn-primary" href="/sign-in" style={{ width: "auto", padding: "0 36px" }}>
                  Start free
                </Link>
                <a className="btn btn-secondary" href="#how" style={{ width: "auto", padding: "0 28px", background: "transparent" }}>
                  See how it works
                </a>
              </div>
              <p className="prov" style={{ color: "var(--text-2)" }}>
                Every safety feature is free on every plan. Works in your phone&rsquo;s browser and on a computer.
              </p>
            </div>

            <div
              className="hero-stage"
              role="img"
              aria-label="Tailhelm's Today screen on a computer and on a phone, showing Bella's next dose at 18:00 and her Zycortal injection in 9 days"
            >
              <DeskMock />
              <span className="base float-chip" style={{ left: -36, top: 196 }} aria-hidden="true">
                <span className="key" />
                Zycortal · day 19 of 28
              </span>
              <span className="base float-chip" style={{ left: 600, top: -22 }} aria-hidden="true">
                <Icon name="synced" />
                Shared with Sam · up to date at 17:20
              </span>
              <span className="base float-chip" style={{ left: 548, top: 578 }} aria-hidden="true">
                <Icon name="recorded" />
                Given 08:03 by Sam
              </span>
              <div className="base hero-phone" aria-hidden="true">
                <PhoneMock />
              </div>
            </div>
          </section>
        </div>

        <section className="lp-wrap after-hero" aria-label="What Tailhelm commits to">
          <div className="proof">
            <div className="stack-8">
              <p className="figline">
                <span className="ty-fig-md">72</span>
                <span className="unit">px</span>
              </p>
              <h2 className="ty-title">The Given button</h2>
              <p className="c2">Big enough to press one-handed, half awake. It records the time and your name.</p>
            </div>
            <div className="stack-8">
              <p className="ty-fig-md">3</p>
              <h2 className="ty-title">People on one list</h2>
              <p className="c2">Everyone sees who gave each dose. Tailhelm checks before the same dose is recorded twice.</p>
            </div>
            <div className="stack-8">
              <p className="ty-fig-md">£0</p>
              <h2 className="ty-title">For every safety feature</h2>
              <p className="c2">Alerts, reminders, the emergency card and the double-dose guard are free on every plan.</p>
            </div>
            <div className="stack-8">
              <p className="figline">
                <span className="ty-fig-md">90</span>
                <span className="unit">days</span>
              </p>
              <h2 className="ty-title">For your vet, always</h2>
              <p className="c2">A plain 90-day summary to share at any appointment, whichever plan you&rsquo;re on.</p>
            </div>
          </div>
        </section>

        <section className="lp-wrap lp-sec" aria-labelledby="how">
          <div className="stack-16 lp-intro">
            <Eyebrow n="01">How it works</Eyebrow>
            <h2 id="how" className="lp-h2">
              Your vet&rsquo;s plan, kept exactly as they set it.
            </h2>
          </div>
          <ol className="lp-grid" style={{ "--lp-min": "300px" } as CSSProperties}>
            <Step n={1} title="Record the plan" text="Type each medicine exactly as your vet wrote it, with the date they set it. Tailhelm never works out or changes a dose.">
              <p className="quote tn" style={{ marginTop: "auto" }}>
                Prednisolone twice daily <span className="c2 nowrap">(set by vet 12 Sep 2026)</span>
              </p>
            </Step>
            <Step n={2} title="Tick each dose" text="One large Given button records the time and who gave it. Reminders arrive at the times you set.">
              <p className="st given" style={{ marginTop: "auto", fontSize: 16, lineHeight: "24px" }}>
                <Icon name="recorded" />
                Given 08:03 by Sam
              </p>
            </Step>
            <Step n={3} title="Share one list" text="Up to three people in a household see the same list, on their phones or a computer.">
              <p className="sync" style={{ marginTop: "auto" }}>
                <Icon name="synced" />
                Shared with Sam · up to date at 17:20
              </p>
            </Step>
          </ol>
        </section>

        <section className="lp-wrap lp-sec" aria-labelledby="household">
          <div className="show">
            <div className="stack-24">
              <Eyebrow n="02">Household</Eyebrow>
              <h2 id="household" className="lp-h2">
                One shared list for everyone who gives a dose.
              </h2>
              <p className="lp-lead">
                Sam gives the morning dose and ticks it at 08:01. When you reach for the same box a minute later, Tailhelm shows you before
                anything is recorded twice.
              </p>
              <Ticks
                items={[
                  "Every record shows who and when, to the minute",
                  "Reminders go to the other person if a dose isn't ticked",
                  "Works with no signal, and shares the record when you're back online",
                ]}
              />
            </div>
            <div
              className="stage ink lit"
              style={{ minHeight: 560 }}
              role="img"
              aria-label="The double-dose guard: Already given. Sam ticked this at 08:01. It has not been recorded twice."
            >
              <p className="stage-cap" aria-hidden="true">
                Double-dose guard · Mon 12 Oct, 08:02
              </p>
              <div className="base stage-in stack-16" style={{ maxWidth: 460 }} aria-hidden="true">
                <div className="recs" style={{ opacity: 0.92 }}>
                  <Rec time="08:00" status={{ icon: "recorded", text: "Given 08:01 by Sam" }} />
                  <Rec time="18:00" status={{ icon: "due", text: "Due at 18:00" }} />
                </div>
                <div className="card stack-16" style={{ padding: 28, borderRadius: 16, boxShadow: "var(--shadow-3)" }}>
                  <div className="row gap-12">
                    <span style={{ color: "var(--warning)", display: "flex" }}>
                      <Icon name="attention" size={32} />
                    </span>
                    <p className="ty-page">Already given</p>
                  </div>
                  <p className="tn" style={{ fontSize: 20, lineHeight: "28px" }}>
                    Sam ticked this at 08:01. It has not been recorded twice.
                  </p>
                  <p className="prov">If you think Bella may have had two doses, contact your vet.</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                    <span className="btn btn-secondary" style={{ fontSize: 16, padding: "0 12px" }}>
                      Call Larkfield Vets
                    </span>
                    <span className="btn btn-primary">Close</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-wrap lp-sec" aria-labelledby="emergency">
          <div className="show">
            <div
              className="stage stage-plate"
              style={{ minHeight: 640, order: -1 }}
              role="img"
              aria-label="The Emergency screen: one large button to call the out-of-hours vet, and a labelled alternative below it"
            >
              <p className="stage-cap" aria-hidden="true">
                Emergency · Mon 12 Oct, 03:10
              </p>
              <div className="device fit" aria-hidden="true">
                <EmergencyMock />
              </div>
            </div>
            <div className="stack-24">
              <Eyebrow n="03">Emergency</Eyebrow>
              <h2 id="emergency" className="lp-h2">
                Designed for 3 a.m.
              </h2>
              <p className="lp-lead">
                One tap from every screen. The vet to call first, chosen from the opening hours you saved, and Bella&rsquo;s emergency card ready
                to show. No typing and no menus before the call.
              </p>
              <Ticks
                items={[
                  "Call buttons at least 72 px tall, in very large type",
                  "Your own vet or the out-of-hours vet first, by the time of day",
                  "The emergency card shows each medicine exactly as your vet set it",
                ]}
              />
            </div>
          </div>
        </section>

        <section className="lp-wrap lp-sec" aria-labelledby="vet">
          <div className="show">
            <div className="stack-24">
              <Eyebrow n="04">Vet visits</Eyebrow>
              <h2 id="vet" className="lp-h2">
                Walk into the vet with the facts.
              </h2>
              <p className="lp-lead">
                Results typed from the lab report, each compared with the range printed on that report. Weights, doses and notes, each with where
                it came from.
              </p>
              <Ticks
                items={[
                  "Every figure shows its source and who entered it",
                  "Inside or outside the report's own range, and nothing more",
                  "A plain 90-day summary is free on every plan",
                ]}
              />
            </div>
            <div
              className="stage ink lit"
              style={{ minHeight: 600 }}
              role="img"
              aria-label="Blood test results from the lab report of 22 Sep 2026, each shown against the range printed on the report"
            >
              <p className="stage-cap" aria-hidden="true">
                Lab report · 22 Sep 2026
              </p>
              <div className="base stage-in" style={{ maxWidth: 480 }} aria-hidden="true">
                <LabMock />
              </div>
            </div>
          </div>
        </section>

        <section className="lp-wrap lp-sec" aria-labelledby="free">
          <div className="stack-16 lp-intro">
            <Eyebrow n="05">Free</Eyebrow>
            <h2 id="free" className="lp-h2">
              Never miss a dose, free.
            </h2>
            <p className="lp-lead">
              Every safety feature is free on every plan, always. Nothing that helps in a crisis, or keeps a dose on track, is ever behind a
              payment.
            </p>
          </div>
          <div className="lp-grid" style={{ "--lp-min": "320px" } as CSSProperties}>
            {FREE_FEATURES.map((f) => (
              <div key={f.title} className="card stack-12" style={{ padding: 28 }}>
                <span className="feat-ic">
                  <Icon name={f.icon} />
                </span>
                <h3 className="ty-title">{f.title}</h3>
                <p className="c2">{f.text}</p>
              </div>
            ))}
            <div className="card ink stack-12" style={{ padding: 28, justifyContent: "center" }}>
              <p className="ty-section">Nothing is ever deleted.</p>
              <p className="c2">On the free plan you see today and the last 30 days. Everything older is kept, and appears again if you choose Plus.</p>
            </div>
          </div>
        </section>

        <section className="lp-wrap lp-sec" aria-labelledby="price">
          <div className="stack-16 lp-intro">
            <Eyebrow n="06">Pricing</Eyebrow>
            <h2 id="price" className="lp-h2">
              Plus: the whole story.
            </h2>
            <p className="lp-lead">Plus is for everything that builds up over time. The line between free and Plus is continuity, never safety.</p>
          </div>
          <div className="lp-grid" style={{ "--lp-min": "360px" } as CSSProperties}>
            <div className="card stack-24 lp-plan">
              <div className="stack-8">
                <h3 className="ty-section">Free</h3>
                <p className="figline">
                  <span className="ty-fig">£0</span>
                </p>
                <p className="ty-lead">Never miss a dose.</p>
              </div>
              <Ticks items={FREE} />
              <Link className="btn btn-primary" href="/sign-in" style={{ marginTop: "auto" }}>
                Start free
              </Link>
            </div>
            <div className="card ink stack-24 lp-plan">
              <div className="stack-8">
                <h3 className="ty-section">Tailhelm Plus</h3>
                <p className="figline">
                  <span className="ty-fig">£36</span>
                  <span className="unit">a year</span>
                </p>
                <p className="c2 tn">or £4 a month · UK only · prices include VAT</p>
                <p className="ty-lead">The whole story.</p>
              </div>
              <Ticks items={PLUS} />
              <Link className="btn btn-primary" href="/sign-in" style={{ marginTop: "auto" }}>
                Choose Plus
              </Link>
            </div>
          </div>
          <p className="prov" style={{ marginTop: 16 }}>
            Every safety feature stays free on both plans. Amber and red alerts reach every household, whichever plan it is on.
          </p>
        </section>

        <section className="lp-wrap lp-sec" aria-labelledby="isnt">
          <div className="panel lp-isnt">
            <h2 id="isnt" className="ty-section">
              What Tailhelm is, and isn&rsquo;t
            </h2>
            <p>
              Tailhelm is a record of what you and your household enter. It doesn&rsquo;t give medical advice, work out doses or replace your vet,
              and it isn&rsquo;t part of or endorsed by any veterinary practice. If you&rsquo;re worried about your dog, contact your vet.
            </p>
          </div>
        </section>

        <section className="lp-wrap lp-sec lp-last" aria-labelledby="cta">
          <div className="cta-band ink lit">
            <div className="stack-12" style={{ maxWidth: 640 }}>
              <h2 id="cta" className="lp-h2">
                Start with today&rsquo;s doses.
              </h2>
              <p className="lp-lead">Add your vet&rsquo;s plan as they wrote it, then tick the next dose. Every safety feature is free on every plan.</p>
            </div>
            <Link className="btn btn-primary" href="/sign-in" style={{ width: "auto", padding: "0 40px" }}>
              Start free
            </Link>
          </div>
        </section>
      </main>

      <footer className="ink lp-foot">
        <div className="lp-wrap" style={{ paddingTop: 64, paddingBottom: "calc(40px + env(safe-area-inset-bottom))" }}>
          <div className="cols">
            <div className="stack-16" style={{ maxWidth: 360 }}>
              <span className="wm" style={{ minHeight: 0 }}>
                <Wordmark size={30} textStyle={{ fontSize: 22 }} />
              </span>
              <p className="ty-lead">For dogs who can&rsquo;t miss a dose.</p>
              <p className="prov">
                Tailhelm is a record of what your household enters. It doesn&rsquo;t give medical advice and isn&rsquo;t part of any veterinary
                practice.
              </p>
            </div>
            <nav aria-label="Product">
              <h3>Product</h3>
              <ul>
                {SECTIONS.map((s) => (
                  <li key={s.href}>
                    <a href={s.href}>{s.label}</a>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Account">
              <h3>Account</h3>
              <ul>
                <li>
                  <Link href="/sign-in">Start free</Link>
                </li>
                <li>
                  <Link href="/sign-in">Sign in</Link>
                </li>
              </ul>
            </nav>
            <nav aria-label="Policies">
              <h3>Policies</h3>
              <ul>
                <li>
                  <a href="mailto:hello@tailhelm.com">Contact</a>
                </li>
              </ul>
            </nav>
          </div>
          <div className="row between lp-legal">
            <p className="prov">© 2026 Tailhelm · tailhelm.com</p>
            <p className="prov">UK only · prices include VAT</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Eyebrow({ n, children }: { n: string; children: ReactNode }) {
  return (
    <p className="eyebrow">
      <span className="n">{n}</span>
      {children}
    </p>
  );
}

function Step({ n, title, text, children }: { n: number; title: string; text: string; children: ReactNode }) {
  return (
    <li className="card stack-16" style={{ padding: 32 }}>
      <span className="step-n">{n}</span>
      <h3 className="ty-section">{title}</h3>
      <p className="c2">{text}</p>
      {children}
    </li>
  );
}

function Ticks({ items }: { items: string[] }) {
  return (
    <ul className="ticks">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

function Rec({ time, status }: { time: string; status: { icon: IconName; text: string } }) {
  return (
    <div className="rec">
      <span className="rec-time">{time}</span>
      <div>
        <p className="rec-med">
          <b className="m-pred">Prednisolone</b>
        </p>
        <p className={status.icon === "recorded" ? "st given" : "st"}>
          <Icon name={status.icon} />
          {status.text}
        </p>
      </div>
    </div>
  );
}

const NAV: { icon: IconName; label: string }[] = [
  { icon: "today", label: "Today" },
  { icon: "trends", label: "Trends" },
  { icon: "careTeam", label: "Care team" },
  { icon: "dog", label: "Dog" },
];

/** Bella's injection cycle: 18 days passed, today the 19th, due on the 28th. */
function Cycle() {
  return (
    <div className="cycle">
      {Array.from({ length: 28 }, (_, i) => (
        <span key={i} className={i < 18 ? "past" : i === 18 ? "today" : i === 27 ? "due" : undefined} />
      ))}
    </div>
  );
}

/** The desktop Today screen inside a browser window, at 0.7333 scale. */
function DeskMock() {
  return (
    <div className="base browser hero-browser" aria-hidden="true">
      <div className="browser-bar">
        <i />
        <i />
        <i />
        <em className="browser-url">tailhelm.com/today</em>
      </div>
      <div className="snap">
        <div className="app desk">
          <aside className="side" style={{ flex: "0 0 248px" }}>
            <div className="side-brand">
              <span className="wm">
                <Wordmark size={32} />
              </span>
            </div>
            <div className="side-dog">
              <span className="avatar" style={{ width: 40, height: 40, fontSize: 16 }}>
                B
              </span>
              <div>
                <p className="w6">Bella</p>
                <p className="ty-sm c2">Addison&rsquo;s disease</p>
              </div>
            </div>
            <div className="side-nav">
              {NAV.map((n, i) => (
                <span key={n.label} className={i === 0 ? "nav-item on" : "nav-item"}>
                  <Icon name={n.icon} />
                  {n.label}
                </span>
              ))}
            </div>
            <p className="side-label">More</p>
            <div className="side-nav">
              <span className="nav-item">
                <Icon name="vetVisit" />
                Vet visit
              </span>
              <span className="nav-item">
                <Icon name="reminder" />
                Reminders
              </span>
            </div>
          </aside>
          <div className="app-main">
            <div className="topbar instrument" style={{ padding: "28px 40px" }}>
              <div className="top-row">
                <div className="top-id">
                  <CareRing initial="B" day={19} days={28} size={80} label="" />
                  <div>
                    <p className="d-title">Bella</p>
                    <p className="d-sub">Tailhelm for Addison&rsquo;s · Sunday 11 October 2026</p>
                  </div>
                </div>
                <span className="btn-em-hdr">
                  <Icon name="call" size={20} />
                  Emergency
                </span>
              </div>
              <dl className="stats">
                <div className="stat k-pred">
                  <dt>Next dose</dt>
                  <dd className="stat-fig">18:00</dd>
                  <dd className="stat-sub">Prednisolone · in 40 min</dd>
                  <dd className="stat-micro m-day" style={{ "--p": 0.7222 } as CSSProperties}>
                    <i style={{ left: "33.333%" }} />
                    <i style={{ left: "75%" }} />
                  </dd>
                </div>
                <div className="stat k-zyc">
                  <dt>Zycortal injection</dt>
                  <dd className="stat-fig">9 days</dd>
                  <dd className="stat-sub">Due Tue 20 Oct · day 19 of 28</dd>
                  <dd className="stat-micro m-cycle" style={{ "--p": 0.6786, "--n": 28 } as CSSProperties} />
                </div>
                <div className="stat k-sync">
                  <dt>Household</dt>
                  <dd className="stat-fig">Adebayo and Sam</dd>
                  <dd className="stat-sub">Up to date at 17:20</dd>
                </div>
              </dl>
            </div>
            <div className="d-content" style={{ padding: "32px 40px" }}>
              <div className="d-row">
                <section className="card lg" style={{ flex: "7 1 420px", display: "flex", flexDirection: "column", gap: 24 }}>
                  <div className="kicker">
                    <span className="kick-med">
                      <span className="med pred">Pr</span>Next dose
                    </span>
                    <span className="tn">in 40 min</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 28px", alignItems: "flex-end" }}>
                    <p className="d-fig">18:00</p>
                    <div className="stack-4" style={{ paddingBottom: 6 }}>
                      <p className="d-h">Bella&rsquo;s Prednisolone</p>
                      <p className="tn">
                        Twice daily <span className="c2 nowrap">(set by vet 12 Sep 2026)</span>
                      </p>
                    </div>
                  </div>
                  <span className="btn btn-primary btn-given" style={{ maxWidth: 340 }}>
                    <Icon name="tick" size={28} />
                    Given
                  </span>
                </section>
                <section className="card lg" style={{ flex: "5 1 300px", display: "flex", flexDirection: "column", gap: 20 }}>
                  <div className="kicker">
                    <span className="kick-med">
                      <span className="med zyc">Zy</span>Next injection
                    </span>
                    <span className="tn">Tue 20 Oct</span>
                  </div>
                  <div className="stack-4">
                    <p className="figline">
                      <span className="d-fig-md">9</span>
                      <span className="unit">days</span>
                    </p>
                    <p className="ty-lead">to Bella&rsquo;s Zycortal, on 20 Oct</p>
                  </div>
                  <div className="stack-8">
                    <Cycle />
                    <div className="row between prov">
                      <span>22 Sep · last given by Sam</span>
                      <span>20 Oct · due</span>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The phone Today screen inside a device. */
function PhoneMock() {
  return (
    <div className="device">
      <div className="phone" style={{ height: 700 }}>
        <div className="safe-top" style={{ height: 24 }} />
        <div className="hdr">
          <span className="wm">
            <Wordmark />
          </span>
          <span className="btn-em-hdr">
            <Icon name="call" size={20} />
            Emergency
          </span>
        </div>
        <div className="fill">
          <div className="scr hero" style={{ gap: 24 }}>
            <div className="dog">
              <div className="stack-4">
                <p className="ty-dog">Bella</p>
                <p className="dog-sub">Tailhelm for Addison&rsquo;s</p>
                <p className="dog-cycle">Zycortal in 9 days · day 19 of 28</p>
              </div>
              <CareRing initial="B" day={19} days={28} size={72} label="" />
            </div>
            <div className="card stack-16">
              <div className="kicker">
                <span className="kick-med">
                  <span className="med pred">Pr</span>Next dose
                </span>
                <span className="tn">in 40 min</span>
              </div>
              <div className="stack-4">
                <p className="ty-fig">18:00</p>
                <p className="ty-section">Bella&rsquo;s Prednisolone</p>
                <p className="ty-body tn">
                  Twice daily <span className="c2 nowrap">(set by vet 12 Sep 2026)</span>
                </p>
              </div>
              <span className="btn btn-primary btn-given">
                <Icon name="tick" size={28} />
                Given
              </span>
            </div>
            <div className="recs">
              <Rec time="08:00" status={{ icon: "recorded", text: "Given 08:03 by Sam" }} />
            </div>
          </div>
        </div>
        <div className="tabbar">
          {NAV.map((n, i) => (
            <span key={n.label} className={i === 0 ? "tab on" : "tab"}>
              <Icon name={n.icon} />
              {n.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The phone Emergency screen inside a device. */
function EmergencyMock() {
  return (
    <div className="phone" style={{ height: 600 }}>
      <div className="safe-top" style={{ height: 24 }} />
      <div className="hdr plain" style={{ height: 72 }}>
        <p style={{ fontSize: 32, lineHeight: "38px", fontWeight: 600 }}>Emergency</p>
        <span className="btn btn-secondary btn-sm" style={{ gap: 6, padding: "0 14px 0 10px" }}>
          <Icon name="close" size={20} />
          Close
        </span>
      </div>
      <div style={{ padding: "8px 20px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
        <span
          className="btn btn-emergency"
          style={{ minHeight: 152, flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 8, padding: "20px 24px", textAlign: "left" }}
        >
          <Icon name="call" size={32} />
          <span style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 28, lineHeight: "34px", fontWeight: 600 }}>Call out-of-hours vet</span>
            <span style={{ fontSize: 18, lineHeight: "26px", fontWeight: 400 }}>Northgate Vets · open 24 hours</span>
          </span>
        </span>
        <span className="btn btn-secondary btn-call" style={{ minHeight: 88, padding: "12px 24px", gap: 16 }}>
          <Icon name="call" size={28} />
          <span className="lines">
            <span className="l1">Call Larkfield Vets</span>
            <span className="l2">Your own vet · opens 08:00</span>
          </span>
        </span>
        <p className="prov">Order chosen from the opening hours you saved for Larkfield Vets.</p>
        <div className="panel stack-8" style={{ padding: 20 }}>
          <p style={{ fontSize: 22, lineHeight: "28px", fontWeight: 600 }}>Bella · Addison&rsquo;s disease</p>
          <p className="tn">
            <b className="w6 m-pred">Prednisolone</b> twice daily
          </p>
          <p className="prov">Set by vet 12 Sep 2026</p>
        </div>
      </div>
    </div>
  );
}

const RESULTS = [
  { name: "Sodium", value: "146", low: "140", high: "155", mark: 44.1, outside: false },
  { name: "Potassium", value: "5.1", low: "3.6", high: "5.6", mark: 64.7, outside: false },
  { name: "Urea", value: "10.2", low: "2.5", high: "9.6", mark: 84.4, outside: true },
];

/** A lab report's results, each against the range printed on it. */
function LabMock() {
  return (
    <section className="card stack-16" style={{ padding: 28, borderRadius: 16, boxShadow: "var(--shadow-3)" }}>
      <div className="kicker">
        <span className="m-meas">Blood tests</span>
        <span className="chip chip-outline">From lab report</span>
      </div>
      <div className="stack-4">
        <p className="ty-title tn">Lab report, 22 Sep 2026</p>
        <p className="prov">Larkfield Vets · typed in by Adebayo from the printed report on 23 Sep 2026</p>
      </div>
      <div>
        {RESULTS.map((r) => (
          <div key={r.name} className="stack-8 lab-row">
            <div className="row between" style={{ alignItems: "baseline" }}>
              <span className="w6">{r.name}</span>
              <span className="tn">
                <span style={{ fontSize: 20, fontWeight: 500 }}>{r.value}</span> <span className="c2">mmol/L</span>
              </span>
            </div>
            <div className="range">
              <div className="range-track" />
              <div className="range-band" style={{ left: "20.6%", width: "58.8%" }} />
              <div className="range-mark" style={{ left: `${r.mark}%` }} />
            </div>
            <div className="range-scale">
              <span style={{ left: "20.6%" }}>{r.low}</span>
              <span style={{ left: "79.4%" }}>{r.high}</span>
            </div>
            <p className={r.outside ? "ty-sm w6" : "ty-sm"}>{r.outside ? "Outside" : "Inside"} the range on your lab report</p>
          </div>
        ))}
        <div className="stack-8 lab-row" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="row between" style={{ alignItems: "baseline" }}>
            <span className="w6">Na:K ratio</span>
            <span className="tn" style={{ fontSize: 20, fontWeight: 500 }}>
              28.6
            </span>
          </div>
          <p className="ty-sm c2">No range given on your lab report</p>
        </div>
      </div>
    </section>
  );
}

