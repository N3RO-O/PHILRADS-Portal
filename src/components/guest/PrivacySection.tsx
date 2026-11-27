import { Link } from 'react-router-dom';
import { GuestSection } from './guestUi';

/** PHILRADS's public contact, as in the staff Privacy Policy (public/privacy.html). */
export const PHILRADS_EMAIL = 'info.philrads@gmail.com';
export const PHILRADS_ADDRESS = '1st/F Evangelical Center, 62 Molave St., Project 3, Quezon City 1102, Philippines';

/** One part of the notice: where on the site, what is kept, who sees it. */
function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

/**
 * The guest site's privacy notice (Data Privacy Act of 2012): what each part of the site keeps,
 * why, and who sees it. Written from what the code does; keep it in step when that changes.
 */
export function PrivacySection() {
  return (
    <GuestSection id="privacy" title="Privacy" lead="What this site keeps about you, why, and who can see it.">
      <div className="flex flex-col gap-7">
        <Part title="Looking around">
          <p>You can read every page without an account. We don’t use advertising or tracking cookies.</p>
          <p>
            Your phone keeps a few things for you: copies of the pages you opened, so they still show without a signal, and choices such as whether you’ve seen the welcome. They stay on your phone. Clearing this
            site’s data in your browser removes them.
          </p>
          <p>“Near me” on the map uses your location on your phone only, to sort places by distance. It is not sent to us.</p>
        </Part>

        <Part title="Feedback, volunteering and merch orders">
          <p>
            We keep what you write, and the name, community, phone number or email you choose to give. A name and contact are optional except for volunteering, where we need a way to reply.
          </p>
          <p>Ordering merch needs a sign-in: the order is sent with your account’s name and email, so the team can reply about payment and pick-up or delivery.</p>
          <p>Only PHILRADS coordinators and administrators read these messages. Nothing you send here is posted publicly.</p>
          <p>To stop one connection flooding the inbox, we keep a scrambled code made from your internet address with each message. It can’t be turned back into the address.</p>
        </Part>

        <Part title="Signing in">
          <p>Signing in keeps your email address, so we can send you a sign-in code, and the name and picture you add to your profile.</p>
          <p>Posts and comments you make in the community can be read by anyone who visits the site, with your name and picture. Signed-in guests can see who else is here now.</p>
        </Part>

        <Part title="Alerts">
          <p>If you turn on alerts, we keep your browser’s notification address and the regions you chose, so we can send typhoon and urgent news alerts there. No name is attached. Turning alerts off removes it.</p>
        </Part>

        <Part title="Where it is kept">
          <p>The site runs on Vercel and keeps its data with Supabase, two cloud services PHILRADS uses. We don’t sell your details or share them for marketing.</p>
        </Part>

        <Part title="Your choices">
          <p>
            You can ask to see, correct or delete what we keep about you. Write to us through{' '}
            <Link to="/guest/feedback" className="font-semibold text-ink underline underline-offset-2">
              Feedback
            </Link>{' '}
            and say what you would like us to do, or email{' '}
            <a href={`mailto:${PHILRADS_EMAIL}`} className="font-semibold text-ink underline underline-offset-2">
              {PHILRADS_EMAIL}
            </a>
            .
          </p>
        </Part>

        <Part title="Contact">
          <p id="contact">
            Philippine Relief and Development Services, Inc. (PHILRADS)
            <br />
            {PHILRADS_ADDRESS}
            <br />
            <a href={`mailto:${PHILRADS_EMAIL}`} className="font-semibold text-ink underline underline-offset-2">
              {PHILRADS_EMAIL}
            </a>
          </p>
        </Part>
      </div>
    </GuestSection>
  );
}
