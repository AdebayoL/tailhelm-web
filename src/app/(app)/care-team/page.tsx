import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TABS } from "@/lib/app/nav";
import { requireOwner } from "@/lib/auth/session";
import { getMyDog } from "@/lib/dogs/queries";
import { HOUSEHOLD_SIZE, placesLeft } from "@/lib/household/input";
import { getHousehold, getMyInvitations, getMyName } from "@/lib/household/queries";
import { householdNames } from "@/lib/today/queries";
import { TabPage } from "../_components/tab-page";
import { acceptInvitation, declineInvitation, leaveHousehold, removeMember } from "./actions";
import { InviteForm, NameForm } from "./forms";

export const metadata: Metadata = { title: "Care team · Tailhelm" };

const primary = "min-h-12 w-full rounded-2xl bg-green px-4 py-3 text-lg font-semibold text-paper";
const quietLink = "min-h-12 text-lg text-green underline underline-offset-4";

export default function CareTeamPage() {
  return (
    <TabPage tab={TABS[2]}>
      <Suspense fallback={<p className="text-lg">Loading…</p>}>
        <Invitations />
        <Household />
      </Suspense>
    </TabPage>
  );
}

/** Invitations to the signed-in person's address, to accept or decline. */
async function Invitations() {
  await requireOwner();
  const invitations = await getMyInvitations();
  if (invitations.length === 0) return null;
  return (
    <section aria-labelledby="invitations" className="flex flex-col gap-3">
      <h2 id="invitations" className="text-xl font-semibold">
        Invitations
      </h2>
      {invitations.map((inv) => (
        <div key={inv.id} className="flex flex-col gap-3 rounded-2xl border-2 border-green p-4">
          <p className="text-lg">
            {inv.invited_by ?? "Someone"} invited you to help care for {inv.dog_name}. You will see and tick the same
            plan.
          </p>
          <form action={acceptInvitation}>
            <input type="hidden" name="invitation_id" value={inv.id} />
            <button type="submit" className={primary}>
              Join {inv.dog_name}&rsquo;s household
            </button>
          </form>
          <form action={declineInvitation}>
            <input type="hidden" name="invitation_id" value={inv.id} />
            <button type="submit" className={quietLink}>
              Decline
            </button>
          </form>
        </div>
      ))}
    </section>
  );
}

async function Household() {
  const owner = await requireOwner();
  const dog = await getMyDog();
  const myName = await getMyName(owner.userId);
  if (!dog) {
    return (
      <>
        <p className="text-lg">
          <Link href="/dog" className={quietLink}>
            Add your dog
          </Link>{" "}
          to share their care with up to {HOUSEHOLD_SIZE - 1} other people. If someone has invited you, their
          invitation shows here once you sign in with the address they used.
        </p>
        <NameForm name={myName} />
      </>
    );
  }
  const [members, names] = await Promise.all([getHousehold(dog.id), householdNames(dog.id)]);
  const me = members.find((m) => m.profile_id === owner.userId);
  const isOwner = me?.role === "owner";
  const left = placesLeft(members);

  return (
    <>
      <section aria-labelledby="household" className="flex flex-col gap-3">
        <h2 id="household" className="text-xl font-semibold">
          {dog.name}&rsquo;s household
        </h2>
        <p className="text-lg">
          Everyone here sees the same Today screen, and each tick shows who gave the dose. Once a dose is ticked it
          closes for everyone.
        </p>
        <ul className="flex flex-col gap-2">
          {members.map((m) => {
            const who =
              m.profile_id === owner.userId
                ? "You"
                : m.status === "invited"
                  ? m.invited_email
                  : ((m.profile_id && names[m.profile_id]) ?? "Someone");
            const what = m.status === "invited" ? "invited, not joined yet" : m.role === "owner" ? "owner" : "member";
            return (
              <li key={m.id} className="flex flex-col gap-2 rounded-2xl border border-rule bg-card p-4">
                <p className="text-lg">
                  <span className="font-semibold">{who}</span> · {what}
                </p>
                {isOwner && m.role === "member" && (
                  <form action={removeMember}>
                    <input type="hidden" name="member_id" value={m.id} />
                    <button type="submit" className={quietLink}>
                      {m.status === "invited" ? "Cancel this invitation" : "Remove from the household"}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
        {isOwner &&
          (left > 0 ? (
            <>
              <h3 className="pt-2 text-lg font-semibold">Invite someone</h3>
              <InviteForm dogId={dog.id} />
            </>
          ) : (
            <p className="text-lg">
              The household is full at {HOUSEHOLD_SIZE} people, counting invitations not yet accepted.
            </p>
          ))}
        {me?.role === "member" && (
          <form action={leaveHousehold}>
            <input type="hidden" name="dog_id" value={dog.id} />
            <button type="submit" className={quietLink}>
              Leave {dog.name}&rsquo;s household
            </button>
          </form>
        )}
      </section>
      <section aria-labelledby="your-name" className="flex flex-col gap-3 border-t border-sand pt-6">
        <h2 id="your-name" className="text-xl font-semibold">
          Your name
        </h2>
        <NameForm name={myName} />
      </section>
    </>
  );
}
