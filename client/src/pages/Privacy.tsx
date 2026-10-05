import LegalPage from '../components/LegalPage'
import { LEGAL_UPDATED, PRIVACY_EMAIL } from '../lib/legal'

/**
 * ⚠️ THIS DOCUMENT DESCRIBES WHAT THE CODE ACTUALLY DOES.
 *
 * Every claim below was checked against the Prisma schema, the Supabase
 * waitlist policy and the app's own calls before it was written. If you change
 * what is collected, stored, or sent to a third party, change this page in the
 * same commit — a privacy policy that has drifted from the code is worse than
 * no privacy policy, because people have relied on it.
 *
 * Known gaps are stated as gaps, not papered over (see "Deleting your data":
 * there is no in-app delete endpoint yet, so the page says to email us).
 */
export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated={LEGAL_UPDATED}>
      <p>
        This policy explains what Jou3an collects, why, and what you can do
        about it. &ldquo;Jou3an&rdquo;, &ldquo;we&rdquo; and &ldquo;us&rdquo;
        mean Jou3an FZ-LLC, Dubai, United Arab Emirates. It covers the Jou3an
        mobile app and the website at jou3an.me.
      </p>
      <p>
        We have tried to write this in plain English and to describe what the
        product really does rather than everything we might one day do.
      </p>

      <h2>What we collect</h2>

      <h3>If you create an account</h3>
      <ul>
        <li>
          <strong>Your name, email address and phone number</strong>, as you
          enter them at signup.
        </li>
        <li>
          <strong>Your password, stored only as a bcrypt hash.</strong> We never
          store it in a readable form and we cannot recover it for you.
        </li>
        <li>
          If you sign in with Google, the Google account identifier we receive,
          instead of a password.
        </li>
        <li>
          <strong>Your taste preferences</strong>: cuisines you said you&apos;d
          rather skip, your usual spend, how adventurous you want the picks to
          be, and any dietary needs you set in your profile.
        </li>
      </ul>

      <h3>If you join the waitlist on the website</h3>
      <p>
        Only your <strong>email address</strong>, the date you joined, and which
        page it came from. Nothing else — the website has no account system, no
        analytics and no advertising tags.
      </p>

      <h3>Location</h3>
      <ul>
        <li>
          <strong>Your device location, only while you are using the app and
          only if you grant permission.</strong> We ask when you choose
          &ldquo;Nearby&rdquo;. If you decline, the app simply searches all of
          Dubai — nothing breaks.
        </li>
        <li>
          <strong>Areas you choose yourself</strong>, when you pick a
          neighbourhood instead of using GPS.
        </li>
        <li>
          Those coordinates are used to rank restaurants by distance, and{' '}
          <strong>they are recorded in the decision log</strong> described below
          so a past recommendation can be explained or reproduced.
        </li>
      </ul>

      <h3>How you use the app</h3>
      <ul>
        <li>
          <strong>Your briefs</strong> — the area, cuisines, delivery or dine-in,
          casual or fancy, and budget you picked for each decision.
        </li>
        <li>
          <strong>Which restaurants we showed you, which one you chose</strong>,
          and whether you then tapped Directions, Call or Order.
        </li>
        <li>
          <strong>A taste profile</strong>: a small set of numbers per cuisine
          that goes up when you swipe right or pick somewhere, and down when you
          swipe left. Individual swipes are not stored as a history — they are
          folded into those numbers and the individual swipe is not kept.
        </li>
        <li>
          <strong>A decision log</strong> for each recommendation: the filters
          used, the coordinates if any, and the scores behind each of the three
          picks. This is how we debug a bad recommendation and improve the
          engine.
        </li>
      </ul>
      <p>
        If you use the app without an account, decisions are still recorded but
        are not linked to any person — there is no account for them to belong
        to.
      </p>

      <h3>On your device</h3>
      <p>
        The app stores your login token in the operating system&apos;s secure
        storage (Keychain on iOS). Your current swipe session and liked list
        live in memory only and are gone when you close the app. The website
        stores no cookies for tracking; it keeps a service-worker cache so it
        loads quickly and one short-lived flag used to recover from a bad
        deploy.
      </p>

      <h2>Why we collect it</h2>
      <ul>
        <li>
          <strong>To give you three recommendations</strong> — the entire point
          of the product. Location, filters and taste all feed that.
        </li>
        <li>
          <strong>To remember your decisions</strong>, so your history and your
          taste profile work.
        </li>
        <li>
          <strong>To run and fix the service</strong>, including understanding
          why a particular recommendation was poor.
        </li>
        <li>
          <strong>To contact you</strong> about your account, or — if you joined
          the waitlist — about launch. You can ask us to stop at any time.
        </li>
      </ul>

      <h2>Where your data lives</h2>
      <p>
        Our database is <strong>PostgreSQL hosted by Supabase in the European
        Union (Frankfurt, Germany)</strong>. Our application server is hosted by{' '}
        <strong>Railway</strong>, and the website by <strong>Vercel</strong>.
        This means your data is stored and processed outside the UAE. We rely on
        these providers&apos; contractual and technical safeguards to protect it
        in transit and at rest.
      </p>

      <h2>Other services we use</h2>
      <ul>
        <li>
          <strong>Google Places</strong> supplies restaurant information —
          names, addresses, opening hours, ratings, phone numbers and photos.
          Photos are fetched by <em>our</em> server and passed on to you, so
          your device does not talk to Google to display them. When you search
          for an area, <strong>the text you type is sent to Google</strong> to
          find matching places.
        </li>
        <li>
          <strong>Google Maps and Talabat</strong> open when you tap Directions
          or Order. At that point you are on their service and their privacy
          policies apply, not ours. We do not tell them who you are.
        </li>
        <li>
          <strong>Apple and Expo</strong> distribute and update the app. Apple
          may collect its own data about downloads and crashes under its own
          policy.
        </li>
        <li>
          <strong>An AI service (Anthropic)</strong> is used by us, offline, to
          write the short description of a restaurant.{' '}
          <strong>No user data is sent to it</strong> — only facts about the
          restaurant that we already hold.
        </li>
      </ul>

      <h2>What we do not do</h2>
      <div className="legal-note">
        <ul>
          <li>
            <strong>We do not sell your personal data.</strong> Not to anyone,
            not in any form.
          </li>
          <li>
            <strong>We do not show ads</strong> and we carry no advertising or
            analytics trackers.
          </li>
          <li>
            <strong>We do not take money to change your results.</strong> No
            restaurant can pay to appear in your three.
          </li>
          <li>
            We do not use your data to make automated decisions that have a
            legal or similarly significant effect on you. Choosing which
            restaurants to show you is the only &ldquo;automated&rdquo; thing we
            do.
          </li>
        </ul>
      </div>

      <h2>How long we keep it</h2>
      <ul>
        <li>
          <strong>Account data</strong> — for as long as your account exists.
        </li>
        <li>
          <strong>Decision history and taste profile</strong> — for as long as
          your account exists, because they are what the app shows you and
          learns from.
        </li>
        <li>
          <strong>Decision logs</strong> — kept while they are useful for
          debugging and improving the engine, and deleted or disconnected from
          your account when you delete your account.
        </li>
        <li>
          <strong>Waitlist emails</strong> — until launch, or until you ask us
          to remove you.
        </li>
      </ul>

      <h2>Deleting your data</h2>
      <p>
        Email <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> from the
        address on your account and ask us to delete it. We will confirm and
        delete your account, your decision history and your taste profile within{' '}
        <strong>30 days</strong>.
      </p>
      <p>
        You can also ask us to remove your waitlist email, or to send you a copy
        of what we hold about you, at the same address.
      </p>

      <h2>Your rights</h2>
      <p>
        Jou3an is operated from the United Arab Emirates and we handle personal
        data in line with{' '}
        <strong>UAE Federal Decree-Law No. 45 of 2021 on the Protection of
        Personal Data (the PDPL)</strong>. Subject to that law, you can ask us
        to:
      </p>
      <ul>
        <li>tell you what we hold about you, and give you a copy of it;</li>
        <li>correct anything that is wrong;</li>
        <li>delete your data;</li>
        <li>stop or limit how we use it, including withdrawing consent;</li>
        <li>transfer your data to you or to another service.</li>
      </ul>
      <p>
        Withdrawing consent — for example turning off location permission —
        doesn&apos;t undo anything we did while we had it, and may mean parts of
        the app stop working as well. If you think we have mishandled your data,
        tell us first at{' '}
        <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>; you also have
        the right to complain to the UAE Data Office.
      </p>

      <h2>Children</h2>
      <p>
        Jou3an is not for people under 16. We don&apos;t knowingly collect data
        from them, and if you believe a child has given us data, contact us and
        we will delete it.
      </p>

      <h2>Security</h2>
      <p>
        Passwords are hashed with bcrypt. Traffic to our servers uses HTTPS.
        Access to the database is restricted to the service and to us. Our
        Google API key never leaves our server. No system is perfectly secure,
        and we won&apos;t pretend otherwise — but we will tell you promptly if a
        breach affects your data.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy we will update the date at the top. If a change
        materially affects how we use your data, we will tell account holders
        directly rather than relying on you to re-read this page.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, requests or complaints:{' '}
        <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
