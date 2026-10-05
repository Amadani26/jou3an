import LegalPage from '../components/LegalPage'
import { LEGAL_UPDATED, PRIVACY_EMAIL } from '../lib/legal'

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated={LEGAL_UPDATED}>
      <p>
        These terms are the agreement between you and Jou3an FZ-LLC, Dubai,
        United Arab Emirates (&ldquo;Jou3an&rdquo;, &ldquo;we&rdquo;,
        &ldquo;us&rdquo;) for the Jou3an mobile app and the website at
        jou3an.me (together, the &ldquo;Service&rdquo;). By using the Service
        you accept them. If you don&apos;t, please don&apos;t use it.
      </p>

      <h2>Who can use Jou3an</h2>
      <p>
        You must be <strong>at least 16 years old</strong> to use the Service.
        By using it you confirm that you are, and that any information you give
        us at signup is accurate.
      </p>

      <h2>What Jou3an actually is</h2>
      <p>
        Jou3an <strong>suggests restaurants</strong>. That is the whole of it.
        We are not a restaurant, a delivery company or a booking service, we do
        not take your order, and we are not a party to anything that happens
        between you and a restaurant.
      </p>
      <p>
        Tapping <strong>Directions</strong> opens Google Maps,{' '}
        <strong>Call</strong> opens your phone&apos;s dialler, and{' '}
        <strong>Order</strong> opens Talabat. Once you leave the app you are
        using someone else&apos;s service under their terms.
      </p>

      <h2>We can&apos;t guarantee the information is right</h2>
      <p>
        Restaurant names, addresses, opening hours, phone numbers, prices,
        ratings, photos and whether somewhere delivers come from{' '}
        <strong>third parties — principally Google Places — and from our own
        catalogue.</strong> That information goes out of date. Places close,
        move, change their hours, change their prices, or stop delivering, and
        we often find out after you would.
      </p>
      <p>
        So: <strong>check before you travel.</strong> Prices shown are
        indicative ranges per person, not quotes. &ldquo;Open now&rdquo; is our
        best reading of the hours we hold, not a promise. If a restaurant
        doesn&apos;t have the hours we expected or the bill isn&apos;t what you
        expected, that is between you and the restaurant.
      </p>
      <p>
        We also can&apos;t guarantee the Service will always be available, fast
        or error-free, and we may change or stop features.
      </p>

      <h2>Dietary needs and allergies</h2>
      <p>
        Any dietary filtering we do is a <strong>best effort based on
        third-party data about a restaurant, not about a dish.</strong> It is
        not a safety feature and must not be relied on where it matters.{' '}
        <strong>If you have an allergy or a strict dietary requirement, confirm
        it with the restaurant.</strong>
      </p>

      <h2>Your account</h2>
      <ul>
        <li>Keep your password to yourself; you are responsible for what happens under your account.</li>
        <li>Give us accurate details and keep them current.</li>
        <li>One person per account. Don&apos;t share it.</li>
        <li>Tell us promptly if you think someone else is using it.</li>
      </ul>

      <h2>Things you must not do</h2>
      <ul>
        <li>Break the law, or use the Service to harm, harass or defraud anyone.</li>
        <li>
          Scrape, bulk-download, resell or redistribute our restaurant data, or
          try to rebuild our catalogue from it.
        </li>
        <li>
          Interfere with the Service — probing, overloading, or working around
          our rate limits or security.
        </li>
        <li>Use bots or automated scripts against the app or our API.</li>
        <li>Impersonate anyone, or create accounts to manipulate recommendations.</li>
        <li>Reverse-engineer the app except where the law says you may.</li>
      </ul>

      <h2>Suspending or closing accounts</h2>
      <p>
        <strong>We can suspend or terminate your account</strong>, with or
        without notice, if you break these terms, abuse the Service or put other
        users, our partners or us at risk. Where it&apos;s reasonable to warn
        you first, we will.
      </p>
      <p>
        You can stop using Jou3an at any time, and you can ask us to delete your
        account — see the{' '}
        <a href="/privacy">Privacy Policy</a> for how.
      </p>

      <h2>Our content</h2>
      <p>
        The Jou3an name, the app, the website, our recommendation engine and the
        way our catalogue is put together belong to us. Using the Service
        doesn&apos;t transfer any of that to you. Restaurant names, logos and
        photographs belong to their owners or to the providers we licence them
        from.
      </p>

      <h2>Paid features</h2>
      <p>
        Jou3an is free today. If we introduce paid features we will set out the
        price and the terms before you are charged, and you will have to agree
        to them separately.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        The Service is provided <strong>&ldquo;as is&rdquo;</strong>. To the
        fullest extent the law allows, we exclude all warranties that
        aren&apos;t expressly stated here, including that the Service will be
        uninterrupted or that the information in it is accurate or complete.
      </p>
      <p>
        To the fullest extent the law allows,{' '}
        <strong>we are not liable for indirect or consequential loss</strong>,
        or for loss of profit, data or goodwill, and{' '}
        <strong>we are not liable for anything that happens at or because of a
        restaurant</strong> — the quality of the food, illness, allergic
        reaction, a wasted journey, a booking that wasn&apos;t honoured, or a
        dispute over a bill.
      </p>
      <p>
        Where we are liable despite the above, our total liability to you is
        capped at <strong>the greater of the amount you have paid us in the
        previous twelve months, or AED 500.</strong>
      </p>
      <p>
        Nothing here excludes liability that cannot lawfully be excluded —
        including for death or personal injury caused by our negligence, or for
        fraud.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms. The date at the top always says when they
        last changed. If a change is material we will give account holders
        reasonable notice — in the app or by email — before it takes effect.
        Continuing to use the Service after that means you accept the new terms;
        if you don&apos;t, stop using it and ask us to close your account.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of the{' '}
        <strong>United Arab Emirates</strong>, as applied in the Emirate of
        Dubai. The courts of Dubai have exclusive jurisdiction over any dispute,
        though we would much rather you emailed us first.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
      </p>
    </LegalPage>
  )
}
