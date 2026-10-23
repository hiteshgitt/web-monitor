import React, { useEffect } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import Logo from '../Logo';

const CONTACT_EMAIL = 'hiteshgml@gmail.com';
const LAST_UPDATED = '23 October 2026';

// Written from what the app actually stores and does; update it whenever that changes.
const DOCUMENTS = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'This policy explains what Web Monitor (operated by Ruyalab) collects when you use the website, the dashboard and the mobile app, why, and the choices you have.',
    sections: [
      {
        heading: 'Information we collect',
        items: [
          'Account details: your email address and name. If you sign up with a password, we store only a salted hash of it, never the password itself.',
          'If you sign in with Google: your Google account ID, email, name and profile picture, as shared by Google. We do not get access to your Gmail, Drive or any other Google data.',
          'Websites you add: the site name, URL, platform and the API key of the Web Monitor integration you installed on that site.',
          'Monitoring results: for every check we store the time, status, response time, HTTP status code and any error. Your site’s integration also reports technical health data such as WordPress/framework version, plugin list, PHP memory and CPU load, SEO findings (for example post titles missing an excerpt) and security findings (for example SSL status and outdated plugins).',
          'Plan information: whether you are on Basic or Pro and whether you requested Pro.',
        ],
      },
      {
        heading: 'How we use it',
        items: [
          'To run the service: check your websites every minute, show results in your dashboard, and open incidents when a site goes down.',
          'To manage your account and plan, including reviewing Pro requests.',
          'We do not sell your data and do not use it for advertising.',
        ],
      },
      {
        heading: 'Services that process data for us',
        items: [
          'Google Gemini (Pro plan only): when the Advanced view generates AI insights or you ask the Zealot assistant a question, the relevant monitoring data for that site is sent to Google’s Gemini API to produce the answer.',
          'Google Sign-In, if you choose to use it.',
          'Google Fonts: pages load the Nunito Sans font from Google’s servers, which receive your IP address as part of the request.',
        ],
      },
      {
        heading: 'Storage and retention',
        items: [
          'Data is stored in our database on our own server.',
          'Individual check results are deleted automatically after 90 days.',
          'When you delete a website from your dashboard, the site and all of its check history and incidents are deleted immediately.',
          'Your sign-in session is kept in your browser’s or app’s local storage until you sign out or it expires.',
        ],
      },
      {
        heading: 'Your choices and rights',
        items: [
          'You can view and delete your websites at any time from the dashboard.',
          `To get a copy of your data, correct it, or delete your account entirely, email ${CONTACT_EMAIL} and we will handle it promptly.`,
        ],
      },
      {
        heading: 'Security',
        items: [
          'Site API keys are never sent back to your browser after you save them; each customer can only access their own websites; access to the admin area is limited to the operator.',
        ],
      },
      {
        heading: 'Changes and contact',
        items: [
          'If we change this policy we will update the date above and, for important changes, tell you in the dashboard.',
          `Questions: ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    intro: 'These terms apply to your use of Web Monitor, operated by Ruyalab. By creating an account you agree to them.',
    sections: [
      {
        heading: 'The service',
        items: [
          'Web Monitor checks websites you connect and shows their availability, response time and health information. The Basic plan is free. The Pro plan adds the Advanced view and is activated by our team on request.',
          'We may change, add or remove features. If a change significantly reduces what your plan includes, we will tell you in advance.',
        ],
      },
      {
        heading: 'Your account',
        items: [
          'Keep your sign-in details secure; you are responsible for activity on your account.',
          'Provide accurate information, and only add websites you own or are authorised to monitor, using the Web Monitor integration installed on that site.',
        ],
      },
      {
        heading: 'Acceptable use',
        items: [
          'Do not use the service to attack, overload or probe systems you are not authorised to test, and do not try to access other customers’ data or the admin area.',
          'We may suspend accounts that break these rules.',
        ],
      },
      {
        heading: 'Monitoring results and AI insights',
        items: [
          'Results reflect what our server observed at the time of each check and what your site’s integration reported. Network conditions can affect them.',
          'AI insights are generated automatically and can be wrong. Review recommendations before acting on them.',
        ],
      },
      {
        heading: 'Availability and liability',
        items: [
          'We work to keep the service running but provide it “as is”, without a guarantee that it will be uninterrupted or error-free.',
          'To the extent the law allows, Ruyalab is not liable for indirect or consequential losses, such as lost revenue during a downtime we did or did not detect.',
        ],
      },
      {
        heading: 'Ending use',
        items: [
          `You can stop using the service at any time and ask us to delete your account by emailing ${CONTACT_EMAIL}.`,
        ],
      },
      {
        heading: 'Changes and contact',
        items: [
          'We may update these terms; the date above shows the latest version. Continuing to use the service after a change means you accept it.',
          `Questions: ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
};

const LegalPage = ({ doc }) => {
  const { title, intro, sections } = DOCUMENTS[doc];

  useEffect(() => {
    document.title = `${title} · Web Monitor`;
    window.scrollTo(0, 0);
    return () => { document.title = 'Web Monitor Dashboard'; };
  }, [title]);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-linear-to-br from-brand-400 via-brand-500 to-brand-700 text-white">
        <div className="max-w-3xl mx-auto px-5 pt-8 pb-14">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <Logo variant="white" className="h-6" />
            <span className="font-extrabold text-lg tracking-tight">Web Monitor</span>
          </Link>
          <h1 className="mt-12 text-4xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 text-white/80 text-sm">Last updated {LAST_UPDATED}</p>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-5 -mt-8 pb-16">
        <article className="panel p-7 sm:p-10">
          <p className="text-ink-soft leading-relaxed">{intro}</p>
          {sections.map((section) => (
            <section key={section.heading} className="mt-8">
              <h2 className="text-lg font-bold text-ink">{section.heading}</h2>
              <ul className="mt-3 space-y-2.5">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-3 text-ink-soft leading-relaxed">
                    <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </article>
        <div className="mt-8 flex flex-wrap gap-4 justify-between text-sm font-semibold">
          <Link to="/" className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-800"><ArrowLeft size={15} /> Back to website</Link>
          <span className="flex gap-4 text-ink-muted">
            <Link to="/privacy" className="hover:text-brand-600">Privacy</Link>
            <Link to="/terms" className="hover:text-brand-600">Terms</Link>
          </span>
        </div>
      </main>
    </div>
  );
};

export default LegalPage;
