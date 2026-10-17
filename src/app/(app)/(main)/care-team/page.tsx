import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/app/_components/icon";
import { SheetClose, SheetLink } from "@/app/_components/sheet-link";
import { type LocalDate, toLocal } from "@/engine/time";
import { dayMonth, weekdayDayMonth } from "@/lib/app/dates";
import { initial } from "@/lib/app/words";
import { requireOwner } from "@/lib/auth/session";
import { requireSetup } from "@/lib/setup/queries";
import { type Dog, getMyDog } from "@/lib/dogs/queries";
import { HOUSEHOLD_SIZE, INVITATION_DAYS, type Member, type PastInvitation, careTeam, invitationExpires, placesLeft } from "@/lib/household/input";
import { type Invitation, getHouseholdHistory, getLastRecorded, getMyInvitations } from "@/lib/household/queries";
import { formatDate } from "@/lib/plan/input";
import { getTimeZone, householdNames } from "@/lib/today/queries";
import { Page } from "../../_components/page";
import { acceptInvitation, declineInvitation, removeMember, resendInvitation } from "./actions";
import { InviteForm, LeaveForm, RemoveMember } from "./forms";

export const metadata: Metadata = { title: "Care team · Tailhelm" };

export default function CareTeamPage() {
  return (
    <Suspense fallback={<main className="page" aria-busy="true" />}>
      <CareTeamContent />
    </Suspense>
  );
}

const PAST_OUTCOME = { declined: "Declined", expired: "Expired", cancelled: "Cancelled" } as const;

async function CareTeamContent() {
  const owner = await requireOwner();
  await requireSetup();
  const [dog, invitations, timeZone] = await Promise.all([getMyDog(), getMyInvitations(), getTimeZone(owner.userId)]);
  const now = new Date();
  const local = (iso: string) => toLocal(new Date(iso), timeZone);
  const incoming = invitations.length > 0 && <IncomingInvitations invitations={invitations} />;

  if (!dog) {
    return (
      <Page title="Care team" sub={`Up to ${HOUSEHOLD_SIZE} people share a dog's list. Everyone sees who recorded each dose, and when.`} subLarge>
        {incoming}
        <section className="card lg stack-16" aria-label="Add your dog">
          <h2 className="r-t">{incoming ? "Or add your own dog" : "Add your dog first"}</h2>
          <p>
            Then you can invite up to {HOUSEHOLD_SIZE - 1} other people to share their list. If someone has invited you, their invitation
            shows here once you sign in with the address they used.
          </p>
          <Link href="/dog" className="btn btn-primary" style={{ alignSelf: "flex-start", width: "auto" }}>
            Add your dog
          </Link>
        </section>
      </Page>
    );
  }

  const [rows, names, lastRecorded] = await Promise.all([getHouseholdHistory(dog.id), householdNames(dog.id), getLastRecorded(dog.id)]);
  const team = careTeam(rows, now);
  const today = toLocal(now, timeZone).date;
  const me = team.people.find((m) => m.profile_id === owner.userId);
  const isOwner = me?.role === "owner";
  const ownerRow = team.people.find((m) => m.role === "owner");
  const ownerName = (ownerRow?.profile_id && names[ownerRow.profile_id]) || "the owner";
  const nameOf = (m: Member) => (m.profile_id && names[m.profile_id]) || m.invited_email || "Someone";
  const date = (iso: string) => formatDate(local(iso).date);
  const lastText = (profileId: string | null) => {
    const at = profileId && lastRecorded[profileId];
    if (!at) return null;
    const { date: day, time } = local(at);
    return `${time} ${day === today ? "today" : sameYear(day, today) ? weekdayDayMonth(day) : formatDate(day)}`;
  };
  const left = placesLeft(team);
  const waiting = team.waiting.length;
  const inUse = team.people.length + waiting;
  const waitingText = waiting === 1 ? "1 invitation" : `${waiting} invitations`;
  const fullText =
    waiting === 0
      ? `All ${HOUSEHOLD_SIZE} places are in use. Remove someone to invite someone else.`
      : `All ${HOUSEHOLD_SIZE} places are in use. Cancel ${waiting === 1 ? "the" : "a"} waiting invitation to invite someone else.`;
  const placesText = `${inUse} of ${HOUSEHOLD_SIZE} in use`;

  const invite = (id: string) =>
    isOwner ? (
      <div className="stack-8">
        {left > 0 ? (
          <SheetLink label="Invite someone" icon="invite" className="btn btn-secondary">
            <InviteForm dogId={dog.id} dogName={dog.name} />
          </SheetLink>
        ) : (
          <button className="btn btn-secondary" type="button" disabled aria-describedby={id}>
            <Icon name="invite" />
            Invite someone
          </button>
        )}
        <p className="prov" id={id}>
          {left > 0
            ? `${left} ${left === 1 ? "place" : "places"} free. An invitation stays open for ${INVITATION_DAYS} days.`
            : fullText}
        </p>
      </div>
    ) : (
      <p className="prov">Only {ownerName}, the owner, can invite or remove people.</p>
    );

  return (
    <Page title="Care team" sub={`Up to ${HOUSEHOLD_SIZE} people share ${dog.name}'s list. Everyone sees who recorded each dose, and when.`} subLarge>
      {incoming}

      <section className="stack-8 m-only" aria-label="Places">
        <div className="row between" style={{ alignItems: "baseline" }}>
          <span className="ty-label">Places</span>
          <span className="sec-meta">
            {placesText}
            {waiting > 0 && ` · ${waiting} waiting for a reply`}
          </span>
        </div>
        <Places people={team.people.length} waiting={waiting} />
      </section>

      <div className="d-row" style={{ alignItems: "flex-start" }}>
        <div className="d-col stack-24" style={{ flex: "8 1 560px" }}>
          <section className="team-card" aria-labelledby="members">
            <div className="sec-h">
              <h2 id="members" className="r-t">
                Members
              </h2>
              <span className="sec-meta">{team.people.length}</span>
            </div>
            <Members
              people={team.people}
              me={owner.userId}
              canRemove={isOwner}
              nameOf={nameOf}
              joined={(m) => m.joined_at && date(m.joined_at)}
              last={(m) => lastText(m.profile_id)}
              dog={dog}
            />
          </section>

          {(waiting > 0 || team.past.length > 0) && (
            <section className="card lg stack-16 d-only" aria-labelledby="invitations-desk">
              <div className="sec-h">
                <h2 id="invitations-desk" className="d-h">
                  Invitations
                </h2>
                <span className="sec-meta">{waiting > 0 ? `${waiting} waiting` : "None waiting"}</span>
              </div>
              {team.waiting.map((m) => (
                <div key={m.id} className="invite-box">
                  <WaitingAvatar />
                  <div style={{ flex: "1 1 280px" }}>
                    <p className="w6" style={{ overflowWrap: "anywhere" }}>
                      {m.invited_email}
                    </p>
                    <p className="prov">{sentText(m, ownerName, local)}</p>
                  </div>
                  <span className="chip chip-dashed">Waiting for reply</span>
                  {isOwner && <InvitationActions id={m.id} />}
                </div>
              ))}
              {team.past.length > 0 && (
                <div>
                  <p className="ty-label c2" style={{ padding: "8px 0 12px", borderBottom: "1px solid var(--line)" }}>
                    Past invitations
                  </p>
                  {team.past.map((m, i) => (
                    <div key={m.id} className="past-row" style={i === team.past.length - 1 ? { borderBottom: 0 } : undefined}>
                      <span style={{ overflowWrap: "anywhere" }}>{m.invited_email}</span>
                      <span className="prov">{pastText(m, date)}</span>
                      <span>
                        <span className="chip chip-outline">{PAST_OUTCOME[m.outcome]}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {waiting > 0 && (
            <section className="sec m-only" aria-labelledby="invitations">
              <div className="sec-h">
                <h2 id="invitations" className="sec-t">
                  Invitations
                </h2>
                <span className="sec-meta">{waiting} waiting</span>
              </div>
              {team.waiting.map((m) => (
                <div key={m.id} className="card stack-12" style={{ padding: "16px 20px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "48px minmax(0, 1fr)", columnGap: 16, alignItems: "start" }}>
                    <WaitingAvatar />
                    <div className="stack-8">
                      <div>
                        <p className="w6" style={{ overflowWrap: "anywhere" }}>
                          {m.invited_email}
                        </p>
                        <p className="prov">{sentText(m, ownerName, local)}</p>
                      </div>
                      <span className="chip chip-dashed" style={{ alignSelf: "flex-start" }}>
                        Waiting for reply
                      </span>
                    </div>
                  </div>
                  {isOwner && (
                    <div style={{ paddingLeft: 64 }}>
                      <InvitationActions id={m.id} />
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          <div className="m-only">{invite("places-full-m")}</div>

          {team.past.length > 0 && (
            <section className="sec m-only" aria-labelledby="past">
              <div className="sec-h">
                <h2 id="past" className="sec-t">
                  Past invitations
                </h2>
              </div>
              <ul className="recs">
                {team.past.map((m) => (
                  <li key={m.id} className="past-item">
                    <div>
                      <p style={{ overflowWrap: "anywhere" }}>{m.invited_email}</p>
                      <p className="prov">{pastText(m, date)}</p>
                    </div>
                    <span className="chip chip-outline">{PAST_OUTCOME[m.outcome]}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="d-col stack-24" style={{ flex: "4 1 300px" }}>
          <section className="card lg stack-16 d-only" aria-label="Places">
            <div className="kicker">
              <span>Places</span>
              <span className="tn">{placesText}</span>
            </div>
            <Places people={team.people.length} waiting={waiting} />
            <dl className="dl">
              <dt>Members</dt>
              <dd>{team.people.length}</dd>
              <dt>Waiting</dt>
              <dd>{waiting === 0 ? "None" : waitingText}</dd>
            </dl>
            {invite("places-full-d")}
          </section>

          <section className="panel stack-12 m-only" aria-labelledby="who-can">
            <h2 id="who-can" className="ty-title">
              What each person can do
            </h2>
            <dl className="dl">
              <dt>Owner</dt>
              <dd>{OWNER_CAN}</dd>
              <dt>Members</dt>
              <dd>{MEMBERS_CAN}</dd>
            </dl>
          </section>
          <section className="panel stack-12 d-only" aria-labelledby="who-can-desk" style={{ padding: 28 }}>
            <h2 id="who-can-desk" className="ty-title">
              What each person can do
            </h2>
            <dl className="stack-12">
              <div className="stack-4">
                <dt className="ty-label">Owner</dt>
                <dd className="ty-sm">{OWNER_CAN}</dd>
              </div>
              <div className="stack-4">
                <dt className="ty-label">Members</dt>
                <dd className="ty-sm">{MEMBERS_CAN}</dd>
              </div>
            </dl>
          </section>

          {me?.role === "member" && (
            <SheetLink label={`Leave ${dog.name}'s care team`} title="Leave the care team" className="lnk">
              <LeaveForm dogId={dog.id} dogName={dog.name} />
            </SheetLink>
          )}
        </div>
      </div>
    </Page>
  );
}

const OWNER_CAN = "Everything members can do, and invites or removes people.";
const MEMBERS_CAN = "Record doses, checks and notes, and keep the care plan and vets up to date. Every record shows who made it and when.";

function sameYear(a: LocalDate, b: LocalDate) {
  return a.slice(0, 4) === b.slice(0, 4);
}

/** "Sent by Adebayo on 9 Oct · expires 16 Oct 2026" */
function sentText(m: Member, ownerName: string, local: (iso: string) => { date: LocalDate }) {
  return `Sent by ${ownerName} on ${dayMonth(local(m.invited_at).date)} · expires ${formatDate(local(invitationExpires(m.invited_at).toISOString()).date)}`;
}

/** "Sent 22 Sep 2026 · not accepted within 7 days" */
function pastText(m: PastInvitation, date: (iso: string) => string) {
  const sent = `Sent ${date(m.invited_at)}`;
  if (m.outcome === "expired") return `${sent} · not accepted within ${INVITATION_DAYS} days`;
  return m.endedAt ? `${sent} · ${m.outcome} ${date(m.endedAt)}` : sent;
}

function Places({ people, waiting }: { people: number; waiting: number }) {
  return (
    <div className="places" aria-hidden="true">
      {Array.from({ length: HOUSEHOLD_SIZE }, (_, i) => (
        <span key={i} className={i < people ? "on" : i < people + waiting ? "waiting" : undefined} />
      ))}
    </div>
  );
}

function WaitingAvatar() {
  return (
    <span className="avatar waiting" aria-hidden="true">
      <Icon name="invitation" size={20} />
    </span>
  );
}

function InvitationActions({ id }: { id: string }) {
  return (
    <div className="row gap-16">
      <form action={resendInvitation}>
        <input type="hidden" name="member_id" value={id} />
        <button className="btn btn-secondary btn-sm" type="submit">
          Resend
        </button>
      </form>
      <form action={removeMember}>
        <input type="hidden" name="member_id" value={id} />
        <button className="lnk" type="submit">
          Cancel invitation
        </button>
      </form>
    </div>
  );
}

/** The people in the household. The owner opens a member to remove them. */
function Members({
  people,
  me,
  canRemove,
  nameOf,
  joined,
  last,
  dog,
}: {
  people: Member[];
  me: string;
  canRemove: boolean;
  nameOf: (m: Member) => string;
  joined: (m: Member) => string | null;
  last: (m: Member) => string | null;
  dog: Pick<Dog, "name">;
}) {
  const canOpen = canRemove && people.some((m) => m.role === "member");
  return (
    <div className={canOpen ? "team-rows can-open" : "team-rows"}>
      <div className="team-head ty-label c2 d-only">
        <span>Person</span>
        <span>Role</span>
        <span>Joined</span>
        <span>Last recorded</span>
      </div>
      <ul className="recs">
        {people.map((m) => {
          const name = nameOf(m);
          const you = m.profile_id === me;
          const joinedOn = joined(m);
          const lastAt = last(m);
          // On a phone your own row leaves out what you last recorded, as the design does.
          const phone = [joinedOn && `Joined ${joinedOn}`, !you && lastAt && `last recorded ${lastAt}`].filter(Boolean).join(" · ");
          const cells = (
            <>
              <span className="team-who">
                <span className="avatar" aria-hidden="true">
                  {initial(name)}
                </span>
                <span>
                  <span className="w6" style={{ display: "block", overflowWrap: "anywhere" }}>
                    {name}
                    {you && (
                      <span className="c2" style={{ fontWeight: 400 }}>
                        {" "}
                        (you)
                      </span>
                    )}
                  </span>
                  {phone && <span className="prov m-only">{phone.charAt(0).toUpperCase() + phone.slice(1)}</span>}
                </span>
              </span>
              <span>
                <span className="chip chip-neutral">{m.role === "owner" ? "Owner" : "Member"}</span>
              </span>
              <span className="tn d-only">{joinedOn ?? <span className="c2">Not recorded</span>}</span>
              <span className="tn d-only">{lastAt ?? <span className="c2">Nothing yet</span>}</span>
            </>
          );
          return (
            <li key={m.id}>
              {canRemove && m.role === "member" ? (
                <SheetLink
                  label={name}
                  className="team-row"
                  trigger={
                    <>
                      {cells}
                      <Icon name="open" className="c2 open-mark" />
                    </>
                  }
                >
                  <dl className="dl wide">
                    <dt>Role</dt>
                    <dd>Member</dd>
                    <dt>Joined</dt>
                    <dd>{joinedOn ?? "Not recorded"}</dd>
                    <dt>Last recorded</dt>
                    <dd>{lastAt ?? "Nothing yet"}</dd>
                  </dl>
                  <RemoveMember memberId={m.id} name={name} dogName={dog.name} />
                  <SheetClose />
                </SheetLink>
              ) : (
                <div className="team-row">
                  {cells}
                  {canOpen && <span className="open-mark" />}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Invitations to the signed-in person's address, to accept or decline. */
function IncomingInvitations({ invitations }: { invitations: Invitation[] }) {
  return (
    <>
      {invitations.map((inv) => (
        <section key={inv.id} className="card lg stack-16" aria-label={`Invitation to ${inv.dog_name}'s care team`}>
          <div className="row gap-16" style={{ alignItems: "flex-start" }}>
            <span className="avatar waiting" aria-hidden="true">
              <Icon name="invitation" size={20} />
            </span>
            <div className="stack-4">
              <h2 className="r-t">
                {inv.invited_by ?? "Someone"} invited you to help care for {inv.dog_name}
              </h2>
              <p>You will see and record on the same list, and everyone sees who recorded each dose, and when.</p>
            </div>
          </div>
          <div className="row gap-16" style={{ flexWrap: "wrap" }}>
            <form action={acceptInvitation} style={{ flex: "1 1 220px" }}>
              <input type="hidden" name="invitation_id" value={inv.id} />
              <button type="submit" className="btn btn-primary">
                Join {inv.dog_name}&rsquo;s care team
              </button>
            </form>
            <form action={declineInvitation}>
              <input type="hidden" name="invitation_id" value={inv.id} />
              <button type="submit" className="lnk">
                Decline
              </button>
            </form>
          </div>
        </section>
      ))}
    </>
  );
}
