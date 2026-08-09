/**
 * The cast for the development seed.
 *
 * Names are obviously fictional and every email sits on `@nurella.local`, a
 * reserved-style domain that cannot receive mail — so a stray notification or
 * an export of this data can never reach a real inbox.
 *
 * `hasLogin: false` mirrors a client added at the front desk: a record with no
 * usable password, claimed later through forgot-password.
 */
export interface DemoClientSpec {
  fullName: string;
  email: string;
  phone: string;
  notes: string;
  hasLogin: boolean;
  /** Before/after records to build for this client. */
  photoSets?: DemoPhotoSetSpec[];
  documents?: string[];
}

export interface DemoPhotoSetSpec {
  title: string;
  /** Matched against the catalogue by name; skipped if the service is absent. */
  serviceName?: string;
  daysAgo: number;
  notes: string;
  consentToPublish: boolean;
  /** Some records intentionally have only a "before" — treatment still in progress. */
  afterPhoto: boolean;
}

export const DEMO_CLIENTS: DemoClientSpec[] = [
  {
    fullName: 'Layla Haddad (demo)',
    email: 'layla.demo@nurella.local',
    phone: '+961 70 100 101',
    notes: 'Sensitive skin — patch tested 12 J, no reaction.',
    hasLogin: true,
    photoSets: [
      {
        title: 'Laser course — session 1',
        serviceName: 'Laser hair removal',
        daysAgo: 56,
        notes: 'Left forearm. Baseline photographs before the first pass.',
        consentToPublish: true,
        afterPhoto: true,
      },
      {
        title: 'Laser course — session 3',
        serviceName: 'Laser hair removal',
        daysAgo: 14,
        notes: 'Same framing and lighting as session 1 for a fair comparison.',
        consentToPublish: false,
        afterPhoto: true,
      },
    ],
    documents: ['Consent form — laser course'],
  },
  {
    fullName: 'Nour Khalil (demo)',
    email: 'nour.demo@nurella.local',
    phone: '+961 71 200 202',
    notes: 'Prefers late-afternoon appointments.',
    hasLogin: true,
    photoSets: [
      {
        title: 'Hydra facial — first visit',
        serviceName: 'Hydra facial',
        daysAgo: 21,
        notes: 'Congestion across the T-zone.',
        consentToPublish: true,
        afterPhoto: true,
      },
    ],
    documents: ['Intake questionnaire'],
  },
  {
    fullName: 'Rana Aoun (demo)',
    email: 'rana.demo@nurella.local',
    phone: '+961 76 300 303',
    notes: 'Walk-in, added at reception. No app account yet.',
    hasLogin: false,
    photoSets: [
      {
        title: 'Microneedling — course in progress',
        serviceName: 'Rf microneedling laser',
        daysAgo: 7,
        notes: 'Before only so far; after photographs due at the next visit.',
        consentToPublish: false,
        afterPhoto: false,
      },
    ],
  },
  {
    fullName: 'Maya Fares (demo)',
    email: 'maya.demo@nurella.local',
    phone: '+961 78 400 404',
    notes: 'Booked for a consultation; no treatment photographs yet.',
    hasLogin: false,
  },
  {
    fullName: 'Sara Mansour (demo)',
    email: 'sara.demo@nurella.local',
    phone: '+961 79 500 505',
    notes: 'Long-standing client — several completed visits.',
    hasLogin: true,
    documents: ['Aftercare sheet'],
  },
];

/** Shared password for the demo accounts that do have a login. */
export const DEMO_CLIENT_PASSWORD = 'DemoClient123!';
