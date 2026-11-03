export const DEMO_PASSWORD = 'DemoPass123!';

export interface SeedTenant {
  id: string;
  name: string;
  users: { id: string; name: string; email: string; role: 'ADMIN' | 'USER' }[];
  customers: { name: string; email: string; status: 'ACTIVE' | 'INACTIVE' }[];
}

export const TENANTS: SeedTenant[] = [
  {
    id: '6f1c2a10-0000-4000-8000-000000000001',
    name: 'Northstar Consulting',
    users: [
      {
        id: '6f1c2a10-0000-4000-8000-0000000000a1',
        name: 'Olivia Hart',
        email: 'admin@northstar.test',
        role: 'ADMIN',
      },
      {
        id: '6f1c2a10-0000-4000-8000-0000000000a2',
        name: 'Maya Chen',
        email: 'maya@northstar.test',
        role: 'USER',
      },
      {
        id: '6f1c2a10-0000-4000-8000-0000000000a3',
        name: 'Daniel Brooks',
        email: 'daniel@northstar.test',
        role: 'USER',
      },
    ],
    customers: [
      { name: 'Acme Robotics', email: 'ops@acmerobotics.example', status: 'ACTIVE' },
      { name: 'Brightwave Media', email: 'hello@brightwave.example', status: 'ACTIVE' },
      { name: 'Cedar & Pine Interiors', email: 'studio@cedarpine.example', status: 'ACTIVE' },
      { name: 'Delta Health Partners', email: 'it@deltahealth.example', status: 'ACTIVE' },
      { name: 'Evergreen Capital', email: 'finance@evergreencap.example', status: 'ACTIVE' },
      { name: 'Fjord Analytics', email: 'team@fjord.example', status: 'INACTIVE' },
      { name: 'Granite Construction Co.', email: 'pm@graniteco.example', status: 'ACTIVE' },
      { name: 'Harborview Hotels', email: 'gm@harborview.example', status: 'ACTIVE' },
      { name: 'Ironclad Security', email: 'contact@ironclad.example', status: 'INACTIVE' },
      { name: 'Juniper Learning', email: 'admin@juniperlearn.example', status: 'ACTIVE' },
      { name: 'Keystone Legal', email: 'office@keystonelegal.example', status: 'ACTIVE' },
      { name: 'Lumen Solar', email: 'projects@lumensolar.example', status: 'ACTIVE' },
    ],
  },
  {
    id: '7a2d3b20-0000-4000-8000-000000000002',
    name: 'Bluebird Logistics',
    users: [
      {
        id: '7a2d3b20-0000-4000-8000-0000000000b1',
        name: 'Samuel Ortiz',
        email: 'admin@bluebird.test',
        role: 'ADMIN',
      },
      {
        id: '7a2d3b20-0000-4000-8000-0000000000b2',
        name: 'Priya Nair',
        email: 'priya@bluebird.test',
        role: 'USER',
      },
      {
        id: '7a2d3b20-0000-4000-8000-0000000000b3',
        name: 'Tom Wallace',
        email: 'tom@bluebird.test',
        role: 'USER',
      },
    ],
    customers: [
      {
        name: 'Atlas Freight Forwarding',
        email: 'dispatch@atlasfreight.example',
        status: 'ACTIVE',
      },
      { name: 'Bayside Grocers', email: 'supply@baysidegrocers.example', status: 'ACTIVE' },
      {
        name: 'Coastal Pharma Distribution',
        email: 'logistics@coastalpharma.example',
        status: 'ACTIVE',
      },
      { name: 'Driftwood Outdoor Gear', email: 'orders@driftwood.example', status: 'ACTIVE' },
      { name: 'Eastgate Auto Parts', email: 'warehouse@eastgate.example', status: 'INACTIVE' },
      { name: 'Frontier Farms Co-op', email: 'coop@frontierfarms.example', status: 'ACTIVE' },
      {
        name: 'Golden Gate Electronics',
        email: 'shipping@ggelectronics.example',
        status: 'ACTIVE',
      },
      { name: 'Highland Brewing', email: 'distribution@highlandbrew.example', status: 'ACTIVE' },
      { name: 'Island Imports', email: 'customs@islandimports.example', status: 'INACTIVE' },
      { name: 'Jetstream Courier', email: 'ops@jetstream.example', status: 'ACTIVE' },
      { name: 'Kestrel Home Goods', email: 'retail@kestrelhome.example', status: 'ACTIVE' },
    ],
  },
];

export const TASK_TITLES = [
  'Kickoff call with stakeholders',
  'Send revised proposal',
  'Prepare quarterly business review',
  'Renew service agreement',
  'Collect onboarding documents',
  'Resolve invoice discrepancy',
  'Schedule site visit',
  'Update billing contact',
  'Review SLA performance report',
  'Draft statement of work',
  'Follow up on support escalation',
  'Confirm delivery schedule',
  'Audit account permissions',
  'Share product roadmap deck',
  'Process contract amendment',
  'Plan training session',
  'Verify insurance certificate',
  'Reconcile shipment manifest',
  'Book renewal negotiation',
  'Send satisfaction survey',
];

export const TASK_DESCRIPTIONS = [
  'Coordinate with the account owner and capture next steps in the notes.',
  'Check the latest correspondence before reaching out.',
  'Customer asked for this before the end of the month.',
  'Loop in finance if any pricing changes are required.',
  '',
];
