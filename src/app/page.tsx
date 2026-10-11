import Link from "next/link";
import { Icon } from "@/app/_components/icon";
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

const FREE_FEATURES = [
  {
    title: "Emergencies",
    text: "The emergency card, QR tag and crisis checklist. Seizure and crisis capture, with the timer and the published escalation points. Crisis alerts and emergency mode.",
  },
  {
    title: "Doses and injections",
    text: "The dose tick and all four reminder layers, including the calendar feed. The injection countdown, treatment log and reminders. The Reminder health screen.",
  },
  {
    title: "Household",
    text: "Up to 3 people on one shared list, with the double-dose guard and escalation to the other person.",
  },
  {
    title: "Daily records",
    text: "The quick check and symptom log, vet-visit mode and milestones. All conditions for one dog, with today and the last 30 days on screen.",
  },
  {
    title: "Records you can always take with you",
    text: "A plain 90-day summary, always. A full CSV export of everything held. Your first designed vet report and your first sitter page.",
  },
];

export default function Home() {
  return (
    <div className="lp">
      <header className="lp-hdr">
        <div className="lp-wrap">
          <Link className="wm" href="/" aria-label="Tailhelm home">
            <Wordmark textStyle={{ fontSize: 24 }} />
          </Link>
          <Link className="btn btn-secondary btn-sm" href="/sign-in">
            Sign in
          </Link>
        </div>
      </header>

      <main>
        <section className="lp-wrap lp-hero">
          <div className="stack-24" style={{ paddingTop: 24 }}>
            <p className="ty-label c2">Tailhelm · the care log for dogs with lifelong conditions</p>
            <h1 className="lp-h1">For dogs who can&rsquo;t miss a dose.</h1>
            <p className="lp-sub">The care log for dogs with lifelong conditions, starting with Addison&rsquo;s disease.</p>
            <p className="ty-lead c2 lp-measure">
              Record what your vet prescribed, exactly as they wrote it. Tick each dose. Everyone in your household sees one shared list, so the
              same dose isn&rsquo;t given twice.
            </p>
            <div className="row gap-16" style={{ flexWrap: "wrap", paddingTop: 8 }}>
              <Link className="btn btn-primary" href="/sign-in" style={{ width: "auto", padding: "0 32px" }}>
                Start free
              </Link>
              <Link className="lnk" href="/sign-in">
                Already using Tailhelm? Sign in
              </Link>
            </div>
            <p className="prov">Works in your phone&rsquo;s browser. Add it to your Home Screen for reminders.</p>
          </div>
          <TodayMock />
        </section>

        <section className="lp-wrap lp-sec" aria-labelledby="how">
          <h2 id="how" className="ty-page" style={{ marginBottom: 32 }}>
            How it works
          </h2>
          <ol className="lp-grid" style={{ "--lp-min": "300px" } as React.CSSProperties}>
            <Step n={1} title="Record the plan">
              Type each medicine exactly as your vet wrote it, with the date they set it. Tailhelm never works out or changes a dose.
            </Step>
            <Step n={2} title="Tick each dose">
              One large Given button records the time and who gave it. Reminders arrive at the times you set.
            </Step>
            <Step n={3} title="Share one list">
              Up to three people in a household see the same list. If someone has already ticked a dose, Tailhelm says so before it&rsquo;s
              recorded twice.
            </Step>
          </ol>
        </section>

        <section className="lp-wrap lp-sec" aria-labelledby="free">
          <div className="stack-12 lp-intro">
            <h2 id="free" className="ty-page">
              Free: never miss a dose
            </h2>
            <p className="ty-lead c2">
              Every safety feature is free on every plan, always. Nothing that helps in a crisis, or keeps a dose on track, is ever behind a
              payment.
            </p>
          </div>
          <div className="lp-grid" style={{ "--lp-min": "320px" } as React.CSSProperties}>
            {FREE_FEATURES.map((f) => (
              <div key={f.title} className="card stack-12" style={{ padding: 24 }}>
                <h3 className="ty-title">{f.title}</h3>
                <p className="c2">{f.text}</p>
              </div>
            ))}
            <div className="panel stack-12" style={{ padding: 24, justifyContent: "center" }}>
              <p className="w6">Nothing is ever deleted.</p>
              <p className="c2">On the free plan you see today and the last 30 days. Everything older is kept, and appears again if you choose Plus.</p>
            </div>
          </div>
        </section>

        <section className="lp-wrap lp-sec" aria-labelledby="price">
          <div className="stack-12 lp-intro">
            <h2 id="price" className="ty-page">
              Plus: the whole story
            </h2>
            <p className="ty-lead c2">Plus is for everything that builds up over time. The line between free and Plus is continuity, never safety.</p>
          </div>
          <div className="lp-grid" style={{ "--lp-min": "360px" } as React.CSSProperties}>
            <div className="card stack-20 lp-plan">
              <div className="stack-8">
                <h3 className="ty-section">Free</h3>
                <p className="figline">
                  <span className="ty-fig">£0</span>
                </p>
                <p className="ty-lead">Never miss a dose.</p>
              </div>
              <Bullets items={FREE} />
              <Link className="btn btn-primary" href="/sign-in" style={{ marginTop: "auto" }}>
                Start free
              </Link>
            </div>
            <div className="card stack-20 lp-plan">
              <div className="stack-8">
                <h3 className="ty-section">Tailhelm Plus</h3>
                <p className="figline">
                  <span className="ty-fig">£36</span>
                  <span className="unit">a year</span>
                </p>
                <p className="c2 tn">or £4 a month · UK only · prices include VAT</p>
                <p className="ty-lead">The whole story.</p>
              </div>
              <Bullets items={PLUS} />
              <Link className="btn btn-secondary" href="/sign-in" style={{ marginTop: "auto" }}>
                Choose Plus
              </Link>
            </div>
          </div>
          <p className="prov" style={{ marginTop: 16 }}>
            Every safety feature stays free on both plans. Amber and red alerts reach every household, whichever plan it is on.
          </p>
        </section>

        <section className="lp-wrap lp-sec lp-last" aria-labelledby="isnt">
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
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap">
          <span className="wm" style={{ minHeight: 0 }}>
            <Wordmark textStyle={{ fontSize: 18 }} />
          </span>
          <nav className="row gap-16" style={{ flexWrap: "wrap" }} aria-label="Footer">
            <a className="lnk" href="mailto:hello@tailhelm.com" style={{ fontWeight: 400 }}>
              Contact
            </a>
            <Link className="lnk" href="/sign-in" style={{ fontWeight: 400 }}>
              Sign in
            </Link>
          </nav>
          <p className="prov">© 2026 Tailhelm · tailhelm.com</p>
        </div>
      </footer>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="card stack-12" style={{ padding: 28 }}>
      <p className="ty-fig-md c2">{n}</p>
      <h3 className="ty-section">{title}</h3>
      <p className="c2">{children}</p>
    </li>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="stack-12 lp-bullets">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

/**
 * A picture of the Today screen. It names the medicine and when it is given
 * but never an amount: only an owner's own entry, from their vet, shows one.
 */
function TodayMock() {
  return (
    <div className="lp-mock-wrap" role="img" aria-label="Tailhelm's Today screen, showing Bella's next dose">
      <div className="lp-mock">
        <div style={{ height: 20 }} />
        <div className="hdr">
          <span className="wm">
            <Wordmark />
          </span>
          <span className="btn-em-hdr">
            <Icon name="call" size={20} />
            Emergency
          </span>
        </div>
        <div className="scr" style={{ gap: 24 }}>
          <div className="dog">
            <div>
              <p className="ty-dog">Bella</p>
              <p className="dog-sub">Tailhelm for Addison&rsquo;s</p>
            </div>
            <span className="avatar">B</span>
          </div>
          <div className="card stack-16">
            <div className="kicker">
              <span>Next dose</span>
              <span className="tn">in 40 min</span>
            </div>
            <div className="stack-4">
              <p className="ty-fig">18:00</p>
              <p className="ty-section">Bella&rsquo;s Prednisolone</p>
              <p className="ty-body tn">
                Twice daily <span className="c2" style={{ whiteSpace: "nowrap" }}>(set by vet 12 Sep 2026)</span>
              </p>
            </div>
            <span className="btn btn-primary btn-given">
              <Icon name="tick" size={28} />
              Given
            </span>
          </div>
          <div className="recs">
            <div className="rec">
              <span className="rec-time">08:00</span>
              <div>
                <p className="rec-med">
                  <b>Prednisolone</b>
                </p>
                <p className="st given">
                  <Icon name="recorded" />
                  <span>Given 08:03 by Sam</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
