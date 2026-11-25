/**
 * FlowMeet demo seed.
 *
 * Idempotent: every record uses a fixed "seed-" id, so re-running replaces the
 * demo data and leaves real meeting data untouched.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_EMAIL = process.env.SEED_EMAIL || "demo@flowmeet.ai";

const daysAgo = (days, hour = 10) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date;
};

const clients = [
  {
    id: "seed-client-northwind",
    name: "Northwind Logistics",
    company: "Northwind Freight Portal",
    description:
      "Freight brokerage moving 400+ loads a week. They want a self-serve shipper portal to replace phone and email status updates.",
    sessions: [
      {
        id: "seed-session-northwind-1",
        meetingNumber: 1,
        title: "Discovery & Feature Scoping",
        status: "COMPLETE",
        meetingUrl: "https://meet.google.com/seed-nw1-000",
        startedAt: daysAgo(12, 10),
        endedAt: daysAgo(12, 11),
        transcript: [
          { speaker: "Ava (Northwind)", text: "Right now every shipment status update is a phone call. My team spends about three hours a day just telling customers where their load is." },
          { speaker: "You", text: "So the first win is a place customers can look up a shipment themselves, by BOL or PRO number." },
          { speaker: "Ava (Northwind)", text: "Exactly. And they should see the last known location, the ETA, and any exception like a delayed pickup." },
          { speaker: "Marcus (Northwind Ops)", text: "We also want quotes. Small shippers call us for a rate and we email back a PDF within a day. That could be instant." },
          { speaker: "You", text: "I can set up a quote form that pulls from your rate table and returns a number they can accept right there." },
          { speaker: "Ava (Northwind)", text: "That would be huge. Invoices too — customers ask for copies of invoices constantly." },
          { speaker: "You", text: "Invoices can be a download list per shipment, assuming we can pull the PDFs from your accounting system." },
          { speaker: "Marcus (Northwind Ops)", text: "We use QuickBooks Online. There is an API for invoices, our bookkeeper confirmed it." },
          { speaker: "You", text: "Good. For notifications, do you want email only or SMS as well?" },
          { speaker: "Ava (Northwind)", text: "Email first. SMS can wait, but customers will ask for it." },
          { speaker: "You", text: "Last thing — do we need user roles, or is one login per customer company enough?" },
          { speaker: "Marcus (Northwind Ops)", text: "One company login, but a manager should be able to add their own dispatchers. So admin and member roles inside a company." },
          { speaker: "You", text: "Understood. I'll send a scope document and a clickable flow for tracking and quoting by Friday." },
        ],
        blueprint: {
          fullPrompt: `# Build: Northwind Freight Customer Portal

## Project overview
A self-serve B2B portal for Northwind Logistics shippers. Customers track shipments, request instant quotes, download invoices, and manage their own team members. The goal is to remove most of the three hours a day Northwind staff spend answering status phone calls.

## Roles
- Company admin: manages company profile, invites members, sees all company shipments and invoices.
- Company member: read-only on shipments and invoices, can request quotes.

## Screens
1. Login / invite acceptance
2. Dashboard: active shipments, exceptions, open quotes
3. Shipment list with search by BOL / PRO number, status filters
4. Shipment detail: timeline of scans, last known location, ETA, documents
5. Quote request form and quote result (accept / decline)
6. Invoice list and invoice detail with PDF download
7. Team settings (admin only)

## Core requirements (P0)
- Shipment tracking lookup by BOL or PRO number, restricted to the customer's own shipments.
- Live status timeline fed from the TMS, including exception events.
- Quote request form that prices against the rate table and returns a number the customer can accept.
- Invoice list with signed PDF downloads from QuickBooks Online.

## Requirements (P1)
- Email notifications on status change, exception, and quote expiry.
- Admin/member roles with member invitation.
- Audit log of who viewed or downloaded what.

## Requirements (P2)
- CSV export of shipments and invoices.
- SMS notifications.
- Saved shipment filters.

## Data model
- Company { id, name, mcNumber, createdAt }
- User { id, email, name, role(ADMIN|MEMBER), companyId }
- Shipment { id, companyId, proNumber, bolNumber, status, origin, destination, eta, lastScanAt }
- ShipmentEvent { id, shipmentId, code, description, location, occurredAt }
- Quote { id, companyId, userId, originZip, destinationZip, weight, equipment, amount, expiresAt, status }
- Invoice { id, companyId, shipmentId, qboId, number, amount, issuedAt }
- Invite { id, companyId, email, role, token, acceptedAt }

## Integrations
- TMS REST API for shipment and scan data.
- QuickBooks Online for invoices (OAuth per-company connection).
- Email provider for transactional notifications.

## Tech stack
Next.js (App Router) + TypeScript, Tailwind CSS, Prisma + PostgreSQL, NextAuth for auth, deployed on Vercel.

## Business rules
- A user can only ever see shipments and invoices belonging to their own company.
- Quotes expire after 7 days and cannot be accepted afterwards.
- Member invitations expire after 72 hours.
- Exception events must surface at the top of the dashboard.

## Out of scope
- Live driver GPS map, customer-facing payments, carrier portal.

Start by building in this order:
1. Auth and company/user tenancy with seeded demo data.
2. Shipment list, lookup and detail timeline.
3. Quote request and pricing flow.
4. Invoice list and PDF download.
5. Email notifications and team management.`,
          summary: {
            overview:
              "Northwind Logistics needs a self-serve customer portal so shippers can track shipments by BOL/PRO number, request instant quotes, and download invoices instead of calling the dispatch desk.",
            decisions: [
              "Shipment tracking is looked up by BOL or PRO number, scoped to the customer's own company.",
              "Quotes are priced from the existing rate table and returned instantly in the portal.",
              "QuickBooks Online supplies invoice PDFs through its API.",
              "Email notifications ship first; SMS is deferred to phase two.",
              "Two roles per customer company: admin and member.",
            ],
            outOfScope: [
              "Live driver GPS map",
              "Customer-facing online payments",
              "Carrier-side portal",
              "SMS notifications in the first release",
            ],
            timeline: "Scope document and clickable flow by Friday; first release target is 6 weeks.",
          },
          requirements: {
            p0: [
              { title: "Shipment lookup", description: "Search by BOL or PRO number and only ever return shipments that belong to the signed-in company." },
              { title: "Status timeline", description: "Show every scan with location and time, plus exception events such as a delayed pickup." },
              { title: "Instant quote request", description: "Form capturing origin, destination, weight and equipment that prices against the rate table and returns an acceptable number." },
              { title: "Invoice downloads", description: "List invoices per company and download the PDF from QuickBooks Online." },
            ],
            p1: [
              { title: "Email notifications", description: "Notify on status change, exception, and quote expiry." },
              { title: "Team management", description: "Admin can invite members with a 72-hour expiring invitation." },
              { title: "Access audit log", description: "Record which user viewed or downloaded a shipment or invoice document." },
            ],
            p2: [
              { title: "CSV export", description: "Export shipment and invoice lists for accounting reconciliation." },
              { title: "SMS notifications", description: "Opt-in SMS alerts for exception events." },
              { title: "Saved filters", description: "Persist shipment list filters per user." },
            ],
          },
          userFlows: {
            flows: [
              {
                name: "Track a shipment",
                actor: "Shipper (member)",
                steps: [
                  "Sign in with company email",
                  "Land on dashboard and see active shipments",
                  "Enter a PRO number in the search bar",
                  "Open the shipment detail and read the scan timeline",
                  "See ETA and any exception banner",
                ],
              },
              {
                name: "Request and accept a quote",
                actor: "Shipper (member)",
                steps: [
                  "Open the quote form",
                  "Enter origin, destination, weight and equipment",
                  "Receive a priced quote with a 7-day expiry",
                  "Accept the quote to create a shipment request",
                ],
              },
              {
                name: "Invite a dispatcher",
                actor: "Company admin",
                steps: [
                  "Open Team settings",
                  "Enter the dispatcher's email and pick the member role",
                  "Send the invitation",
                  "Dispatcher accepts the link within 72 hours",
                ],
              },
            ],
            screens: [
              "Login",
              "Dashboard",
              "Shipment list",
              "Shipment detail",
              "Quote request",
              "Quote result",
              "Invoice list",
              "Team settings",
            ],
          },
          techSpec: {
            recommended: {
              frontend: ["Next.js 16 App Router", "TypeScript", "Tailwind CSS", "shadcn/ui"],
              backend: ["Next.js route handlers", "Prisma ORM", "PostgreSQL"],
              auth: ["NextAuth.js with email magic links"],
              integrations: ["TMS REST API", "QuickBooks Online API", "Resend for transactional email"],
              deployment: ["Vercel", "Managed PostgreSQL (Supabase)"],
            },
            dataModel: [
              { model: "Company", fields: ["id: String", "name: String", "mcNumber: String?", "createdAt: DateTime"], relations: ["users User[]", "shipments Shipment[]"] },
              { model: "User", fields: ["id: String", "email: String @unique", "name: String?", "role: Role", "companyId: String"], relations: ["company Company"] },
              { model: "Shipment", fields: ["id: String", "companyId: String", "proNumber: String", "bolNumber: String?", "status: String", "eta: DateTime?", "lastScanAt: DateTime?"], relations: ["events ShipmentEvent[]", "invoices Invoice[]"] },
              { model: "ShipmentEvent", fields: ["id: String", "shipmentId: String", "code: String", "description: String", "location: String?", "occurredAt: DateTime"], relations: ["shipment Shipment"] },
              { model: "Quote", fields: ["id: String", "companyId: String", "amount: Decimal", "expiresAt: DateTime", "status: QuoteStatus"], relations: ["company Company"] },
              { model: "Invoice", fields: ["id: String", "companyId: String", "qboId: String", "number: String", "amount: Decimal", "issuedAt: DateTime"], relations: ["shipment Shipment?"] },
            ],
            businessRules: [
              "Shipments and invoices are always filtered by the signed-in user's companyId.",
              "Accepted quotes are immutable; a change requires a new quote.",
              "Quotes expire after 7 days and invitations after 72 hours.",
            ],
            constraints: [
              "QuickBooks tokens must be refreshed server-side per company connection.",
              "TMS API is rate limited to 60 requests per minute.",
            ],
          },
          confidence: {
            requirements: 92,
            userFlows: 88,
            techContext: 90,
            dataModel: 84,
            reasoning: "Tracking, quoting and invoices are clear. Notification preferences and rate-table ownership still need confirmation.",
          },
        },
        actionItems: [
          { text: "Send scope document and tracking flow wireframe", owner: "You", priority: "HIGH", done: true },
          { text: "Confirm QuickBooks Online API access with bookkeeper", owner: "Marcus", priority: "HIGH", done: false },
          { text: "Share rate table schema for quote pricing", owner: "Ava", priority: "MEDIUM", done: false },
          { text: "Collect 3 sample invoice PDFs for layout reference", owner: "Ava", priority: "LOW", done: false },
        ],
      },
      {
        id: "seed-session-northwind-2",
        meetingNumber: 2,
        title: "Portal Scope Review & Quote Logic",
        status: "COMPLETE",
        meetingUrl: "https://meet.google.com/seed-nw2-000",
        startedAt: daysAgo(5, 14),
        endedAt: daysAgo(5, 15),
        transcript: [
          { speaker: "You", text: "I walked through the tracking flow with the wireframe. Did the dispatch team get a chance to look?" },
          { speaker: "Ava (Northwind)", text: "They did, and they want the exception banner to be red on the dashboard, not just on the shipment page." },
          { speaker: "Marcus (Northwind Ops)", text: "Also, can the quote include accessorials? Liftgate and inside delivery are half our call volume." },
          { speaker: "You", text: "Yes. I'll model accessorials as optional line items the customer can tick, each with its own rate." },
          { speaker: "Ava (Northwind)", text: "Perfect. One more thing — we have customers who ship weekly. Could they save a lane?" },
          { speaker: "You", text: "Saved lanes are easy, but I'd put them in phase two so we don't slow down launch." },
          { speaker: "Marcus (Northwind Ops)", text: "Agreed. Launch first, saved lanes later." },
          { speaker: "You", text: "For invoices, QuickBooks returns a PDF URL that expires, so I'll stream and cache the file server-side." },
          { speaker: "Ava (Northwind)", text: "Fine. And please make sure a customer can never see another customer's invoice — that is a hard requirement from legal." },
          { speaker: "You", text: "Every query is scoped by companyId server-side, and I'll add the access audit log as part of phase one." },
          { speaker: "Ava (Northwind)", text: "Then we are ready to start. Send the contract and the staging link." },
        ],
        blueprint: {
          fullPrompt: `# Build: Northwind Freight Customer Portal (v2 scope)

## What changed since meeting 1
- Exception events surface as a red banner on the dashboard, not only on the shipment page.
- Quotes support optional accessorial line items (liftgate, inside delivery, residential, appointment).
- Saved lanes move to phase two.
- The access audit log is promoted into phase one because of a legal requirement on invoice visibility.

## Project overview
A B2B shipping portal for Northwind Logistics customers: shipment tracking by BOL/PRO, instant quoting with accessorials, invoice PDFs, team management.

## Roles
- Company admin: team management, all company data.
- Company member: shipments, quotes, invoices (read-only on invoices).

## Screens
Login, Dashboard (with exception banner), Shipment list, Shipment detail, Quote request with accessorials, Quote result, Invoice list, Invoice detail, Team settings, Audit log (admin).

## Requirements (P0)
- Company-scoped shipment tracking with scan timeline.
- Red exception banner on the dashboard listing affected PRO numbers.
- Quote builder with base rate plus selectable accessorials, total shown live, 7-day expiry.
- Invoice list with server-cached PDF downloads; every download written to the audit log.

## Requirements (P1)
- Email notifications for status change, exception, and quote expiry.
- Admin/member invites with 72-hour expiry.
- Admin audit log view: actor, action, resource, timestamp.

## Requirements (P2)
- Saved lanes (origin/destination/equipment presets).
- CSV export.
- SMS exception alerts.

## Data model
- Company { id, name, mcNumber }
- User { id, email, role, companyId }
- Shipment { id, companyId, proNumber, bolNumber, status, origin, destination, eta, lastScanAt }
- ShipmentEvent { id, shipmentId, code, description, location, occurredAt }
- Quote { id, companyId, userId, baseAmount, totalAmount, expiresAt, status }
- QuoteLine { id, quoteId, type(BASE|ACCESSORIAL), code, label, amount }
- Invoice { id, companyId, qboId, number, amount, issuedAt, cachedPath }
- AuditEvent { id, companyId, userId, action, resourceType, resourceId, createdAt }

## Business rules
- All reads are filtered by companyId derived from the session, never from the request body.
- Invoice PDFs are streamed from the server and cached; the browser never receives a QuickBooks token or expiring URL.
- Accessorials multiply nothing; they are additive line items.
- Quotes and accessorial prices are snapshotted at request time.

## Tech stack
Next.js App Router + TypeScript, Tailwind, Prisma + PostgreSQL, NextAuth, Resend, Vercel.

## Out of scope
Driver GPS map, customer payments, carrier portal, saved lanes in v1.

Start by building in this order:
1. Tenancy, auth, audit log plumbing.
2. Shipment tracking and dashboard exception banner.
3. Quote builder with accessorials.
4. Invoice download with server-side caching.
5. Email notifications and team invites.`,
          summary: {
            overview:
              "Second meeting finalised the portal scope: tracking plus a dashboard-level red exception banner, quotes with additive accessorials, server-cached invoice downloads, and an audit log promoted into the launch release for legal reasons.",
            decisions: [
              "Exception banner appears at the top of the dashboard in red.",
              "Accessorials are additive quote line items (liftgate, inside delivery, residential, appointment).",
              "Saved lanes are deferred to phase two.",
              "Invoice PDFs are streamed and cached server-side; QuickBooks tokens never reach the browser.",
              "Audit log moves into phase one.",
            ],
            outOfScope: ["Saved lanes in v1", "Driver GPS map", "Customer payments", "Carrier portal"],
            timeline: "Development starts now; staging link before contract signature; launch target 6 weeks.",
          },
          requirements: {
            p0: [
              { title: "Company-scoped tracking", description: "Shipment search and detail always filtered by the session's companyId." },
              { title: "Dashboard exception banner", description: "Red banner listing affected PRO numbers, linking to each shipment." },
              { title: "Quote with accessorials", description: "Base rate plus selectable accessorial line items with a live total and 7-day expiry." },
              { title: "Cached invoice downloads", description: "Stream PDFs through the server, cache them, and log each download." },
            ],
            p1: [
              { title: "Audit log", description: "Record actor, action, resource and time for document views and downloads." },
              { title: "Email notifications", description: "Status change, exception and quote expiry emails." },
              { title: "Team management", description: "Admin invites members with a 72-hour expiring link." },
            ],
            p2: [
              { title: "Saved lanes", description: "Reusable origin/destination/equipment presets for weekly shippers." },
              { title: "CSV export", description: "Export shipments and invoices." },
              { title: "SMS exception alerts", description: "Opt-in SMS for exceptions only." },
            ],
          },
          userFlows: {
            flows: [
              {
                name: "Build a quote with accessorials",
                actor: "Shipper (member)",
                steps: [
                  "Open quote request",
                  "Enter lane, weight and equipment",
                  "Tick liftgate and inside delivery",
                  "See the live total update",
                  "Submit and receive a 7-day quote",
                ],
              },
              {
                name: "Investigate an exception",
                actor: "Shipper (admin)",
                steps: [
                  "Sign in and see the red exception banner",
                  "Click the affected PRO number",
                  "Read the exception event in the timeline",
                  "Download the related invoice if needed, which is logged",
                ],
              },
            ],
            screens: ["Dashboard", "Shipment detail", "Quote request", "Quote result", "Invoice list", "Audit log", "Team settings"],
          },
          techSpec: {
            recommended: {
              frontend: ["Next.js 16 App Router", "TypeScript", "Tailwind CSS", "shadcn/ui"],
              backend: ["Route handlers", "Prisma ORM", "PostgreSQL", "S3-compatible PDF cache"],
              auth: ["NextAuth.js"],
              integrations: ["TMS REST API", "QuickBooks Online API", "Resend"],
              deployment: ["Vercel", "Supabase Postgres"],
            },
            dataModel: [
              { model: "Quote", fields: ["id: String", "companyId: String", "baseAmount: Decimal", "totalAmount: Decimal", "expiresAt: DateTime", "status: QuoteStatus"], relations: ["lines QuoteLine[]"] },
              { model: "QuoteLine", fields: ["id: String", "quoteId: String", "type: BASE|ACCESSORIAL", "code: String", "label: String", "amount: Decimal"], relations: ["quote Quote"] },
              { model: "Invoice", fields: ["id: String", "companyId: String", "qboId: String", "number: String", "amount: Decimal", "cachedPath: String?"], relations: ["auditEvents AuditEvent[]"] },
              { model: "AuditEvent", fields: ["id: String", "companyId: String", "userId: String", "action: String", "resourceType: String", "resourceId: String", "createdAt: DateTime"], relations: [] },
            ],
            businessRules: [
              "Tenant id comes from the session, never the request body.",
              "Accessorials are additive and snapshot prices at quote creation.",
              "Every document download writes an audit event before the stream starts.",
            ],
            constraints: ["QuickBooks refresh tokens stored encrypted at rest.", "PDF cache must be invalidated when an invoice is voided."],
          },
          confidence: {
            requirements: 95,
            userFlows: 91,
            techContext: 92,
            dataModel: 89,
            reasoning: "Scope is signed off. Remaining unknown is QuickBooks token ownership and whether accessorial rates live in the TMS or a spreadsheet.",
          },
        },
        actionItems: [
          { text: "Send staging link before contract signature", owner: "You", priority: "HIGH", done: true },
          { text: "Export accessorial rate list from the TMS", owner: "Marcus", priority: "HIGH", done: false },
          { text: "Confirm QuickBooks app scopes with bookkeeper", owner: "Marcus", priority: "MEDIUM", done: false },
          { text: "Add legal review of audit log retention", owner: "Ava", priority: "MEDIUM", done: false },
        ],
      },
    ],
  },
  {
    id: "seed-client-acme-health",
    name: "Acme Health",
    company: "Patient Intake & Booking",
    description:
      "Multi-clinic practice with 11 locations. Replacing a PDF intake packet and phone-only booking with a patient-facing scheduling app.",
    sessions: [
      {
        id: "seed-session-acme-1",
        meetingNumber: 1,
        title: "Patient Intake Discovery",
        status: "COMPLETE",
        meetingUrl: "https://meet.google.com/seed-acm-100",
        startedAt: daysAgo(8, 9),
        endedAt: daysAgo(8, 10),
        transcript: [
          { speaker: "Dr. Patel (Acme)", text: "New patients download a nine page PDF, print it, and bring it in. Half of them fill it out wrong." },
          { speaker: "You", text: "So a digital intake form that saves progress and validates fields would remove most of that." },
          { speaker: "Priya (Practice Manager)", text: "Yes, and it has to work on a phone. Most of our patients book from a phone at night." },
          { speaker: "You", text: "Do patients choose the clinic, or the provider?" },
          { speaker: "Priya (Practice Manager)", text: "Clinic first, then provider. Some providers only work two locations." },
          { speaker: "Dr. Patel (Acme)", text: "We also need insurance card uploads. Front desk spends a lot of time chasing those." },
          { speaker: "You", text: "I'll add a photo capture step with size limits and a retry if the upload fails." },
          { speaker: "Priya (Practice Manager)", text: "And Spanish. About a third of our patients prefer Spanish." },
          { speaker: "You", text: "Bilingual forms with an English/Spanish toggle — same data structure, translated labels." },
          { speaker: "Dr. Patel (Acme)", text: "Can we see which forms are incomplete before the appointment?" },
          { speaker: "You", text: "A staff view listing appointments with a completion badge, and an automatic reminder 24 hours before." },
          { speaker: "Priya (Practice Manager)", text: "That would cut our no-show cleanup a lot. Let's do it." },
        ],
        blueprint: {
          fullPrompt: `# Build: Acme Health Patient Intake & Booking

## Project overview
A mobile-first patient app for an 11-clinic practice. Patients book appointments by clinic and provider, complete a digital intake form (English or Spanish), upload insurance cards, and receive reminders. Front desk gets a live view of form completion before each visit.

## Roles
- Patient: books, completes intake, uploads insurance, manages appointments.
- Front desk staff: per-clinic view of today's appointments, completion status, patient documents.
- Practice manager: all clinics, provider schedules, reminder settings.

## Screens
1. Patient sign-in (email or phone OTP)
2. Clinic picker with map/list and next availability
3. Provider picker with availability calendar
4. Booking confirmation
5. Intake form (multi-step, save and resume, EN/ES toggle)
6. Insurance card capture (camera + upload)
7. My appointments
8. Staff schedule board with completion badges
9. Staff patient detail with documents
10. Manager settings (providers, hours, reminders)

## Requirements (P0)
- Clinic → provider → slot booking flow that reflects real availability.
- Multi-step intake form with server-side validation and save-and-resume.
- English/Spanish toggle over the same field set.
- Insurance card photo upload with client-side size limits and retry.
- Staff schedule board showing per-appointment intake completion.

## Requirements (P1)
- 24-hour reminder email/SMS with a deep link into the intake form.
- Patient can reschedule or cancel up to 24 hours before.
- Provider schedule exceptions (holidays, half days).

## Requirements (P2)
- Waitlist for fully booked slots.
- Insurance eligibility pre-check integration.
- Downloadable visit summary.

## Data model
- Clinic { id, name, address, timezone, phone }
- Provider { id, name, specialty, clinicIds, weeklyAvailability }
- Appointment { id, clinicId, providerId, patientId, startsAt, status, intakeId }
- IntakeForm { id, appointmentId, locale, completedAt, version }
- IntakeAnswer { id, intakeId, fieldKey, value }
- InsuranceCard { id, patientId, side(FRONT|BACK), storageKey, uploadedAt }
- Reminder { id, appointmentId, channel, sendAt, sentAt }

## Business rules
- A provider slot must be validated server-side at booking time; the UI availability is advisory.
- Intake forms are versioned; an edit after completion creates a new version and keeps the old one.
- Insurance images are private: scoped by patient id, served through signed URLs.
- Cancellations inside 24 hours are flagged to staff, not blocked.

## Tech stack
Next.js App Router + TypeScript, Tailwind, Prisma + PostgreSQL, NextAuth (email/phone OTP), S3-compatible private storage, Twilio + Resend for reminders.

## Out of scope
EHR/EMR integration, billing claims, telehealth video, insurance eligibility checks in v1.

Start by building in this order:
1. Clinics, providers and availability with seeded data.
2. Booking flow end to end.
3. Intake form with validation and EN/ES.
4. Insurance upload and staff document view.
5. Reminders and rescheduling.`,
          summary: {
            overview:
              "Acme Health wants a mobile-first patient app that replaces the nine-page PDF intake packet: book by clinic then provider, complete a bilingual intake form with insurance uploads, and show front desk which forms are complete before the visit.",
            decisions: [
              "Booking order is clinic first, then provider.",
              "Intake form is multi-step with save-and-resume and must work well on phones.",
              "Forms are bilingual English/Spanish over the same field set.",
              "Insurance cards are captured as photos and uploaded securely.",
              "Staff see a completion badge per appointment plus a 24-hour reminder.",
            ],
            outOfScope: ["EHR/EMR integration", "Insurance claims and billing", "Telehealth video visits", "Eligibility checks in v1"],
            timeline: "Pilot at two clinics in 8 weeks, all 11 clinics after that.",
          },
          requirements: {
            p0: [
              { title: "Clinic and provider booking", description: "Clinic picker, provider availability, and server-validated slot booking." },
              { title: "Digital intake form", description: "Multi-step form with validation, progress saving, and resume on any device." },
              { title: "Bilingual forms", description: "English/Spanish toggle that preserves answers across languages." },
              { title: "Insurance upload", description: "Front and back photo capture with size limits, retry, and private storage." },
              { title: "Staff completion board", description: "Per-clinic appointment list with intake completion status." },
            ],
            p1: [
              { title: "Reminders", description: "24-hour email/SMS reminder with a deep link to the intake form." },
              { title: "Reschedule and cancel", description: "Self-service changes up to 24 hours before the appointment." },
              { title: "Schedule exceptions", description: "Provider holidays and half days override weekly availability." },
            ],
            p2: [
              { title: "Waitlist", description: "Join a waitlist for fully booked slots and get notified on openings." },
              { title: "Visit summary", description: "Downloadable summary of the completed intake." },
            ],
          },
          userFlows: {
            flows: [
              {
                name: "Book an appointment",
                actor: "Patient",
                steps: [
                  "Sign in with email or phone OTP",
                  "Choose a clinic",
                  "Choose a provider and a slot",
                  "Confirm booking",
                  "Start the intake form or finish it later",
                ],
              },
              {
                name: "Complete intake in Spanish",
                actor: "Patient",
                steps: [
                  "Open the deep link from the reminder",
                  "Switch the form to Spanish",
                  "Answer each step and upload insurance photos",
                  "Submit and see confirmation",
                ],
              },
              {
                name: "Check today's readiness",
                actor: "Front desk staff",
                steps: [
                  "Open the staff schedule board",
                  "Filter to the clinic and today",
                  "See incomplete badges",
                  "Open the patient record and send a nudge",
                ],
              },
            ],
            screens: [
              "Sign in",
              "Clinic picker",
              "Provider picker",
              "Booking confirmation",
              "Intake form",
              "Insurance capture",
              "My appointments",
              "Staff schedule board",
              "Patient detail",
              "Manager settings",
            ],
          },
          techSpec: {
            recommended: {
              frontend: ["Next.js 16 App Router", "TypeScript", "Tailwind CSS", "React Hook Form + Zod"],
              backend: ["Route handlers", "Prisma ORM", "PostgreSQL"],
              auth: ["NextAuth.js with email and phone OTP"],
              integrations: ["Twilio (SMS)", "Resend (email)", "S3-compatible private storage"],
              deployment: ["Vercel", "Supabase Postgres + Storage"],
            },
            dataModel: [
              { model: "Clinic", fields: ["id: String", "name: String", "address: String", "timezone: String", "phone: String"], relations: ["appointments Appointment[]"] },
              { model: "Provider", fields: ["id: String", "name: String", "specialty: String", "clinicIds: String[]", "weeklyAvailability: Json"], relations: ["appointments Appointment[]"] },
              { model: "Appointment", fields: ["id: String", "clinicId: String", "providerId: String", "patientId: String", "startsAt: DateTime", "status: AppointmentStatus"], relations: ["intake IntakeForm?"] },
              { model: "IntakeForm", fields: ["id: String", "appointmentId: String", "locale: String", "completedAt: DateTime?", "version: Int"], relations: ["answers IntakeAnswer[]"] },
              { model: "InsuranceCard", fields: ["id: String", "patientId: String", "side: FRONT|BACK", "storageKey: String"], relations: [] },
            ],
            businessRules: [
              "Slot availability is re-validated server-side inside a transaction to prevent double booking.",
              "Completed intake forms are immutable; edits create a new version.",
              "Signed URLs expire after 10 minutes and are only issued to the owning patient or staff at that clinic.",
            ],
            constraints: ["Insurance images must not exceed 8 MB each.", "All patient data access is logged."],
          },
          confidence: {
            requirements: 90,
            userFlows: 86,
            techContext: 88,
            dataModel: 82,
            reasoning: "Intake fields themselves still need to be supplied; the nine-page PDF was promised after this call.",
          },
        },
        actionItems: [
          { text: "Send the current nine-page intake PDF", owner: "Priya", priority: "HIGH", done: true },
          { text: "Confirm which providers work across multiple clinics", owner: "Priya", priority: "MEDIUM", done: false },
          { text: "Draft pilot rollout plan for two clinics", owner: "You", priority: "MEDIUM", done: false },
          { text: "Check BAA/HIPAA hosting requirements", owner: "Dr. Patel", priority: "HIGH", done: false },
        ],
      },
    ],
  },
  {
    id: "seed-client-lumen",
    name: "Lumen Studio",
    company: "Portfolio & Print Shop",
    description: "Two-person photography studio. Portfolio site plus a small print shop with limited editions.",
    sessions: [
      {
        id: "seed-session-lumen-1",
        meetingNumber: 1,
        title: "Portfolio & Print Shop Kickoff",
        status: "PROCESSING",
        meetingUrl: "https://meet.google.com/seed-lmn-100",
        startedAt: daysAgo(1, 16),
        endedAt: null,
        transcript: [
          { speaker: "Nina (Lumen)", text: "The portfolio is the easy part. I want big images, no clutter, and a project page that feels like a gallery." },
          { speaker: "Theo (Lumen)", text: "Prints are the tricky bit. Each edition is limited, so once twenty are sold it has to disappear from the shop." },
          { speaker: "You", text: "So inventory is per edition, and sold-out editions stay visible as an archive but are not purchasable." },
          { speaker: "Nina (Lumen)", text: "Exactly. And I do not want to maintain a separate spreadsheet — the site should be the source of truth." },
          { speaker: "You", text: "Do you want to handle shipping yourself or use a print-on-demand partner?" },
          { speaker: "Theo (Lumen)", text: "We ship ourselves for the limited editions. Print-on-demand is for the open edition posters." },
          { speaker: "You", text: "Payments — Stripe is the simplest fit, and it handles tax for the EU." },
          { speaker: "Nina (Lumen)", text: "Good. I'll send you the image archive and the edition list." },
        ],
        blueprint: null,
        actionItems: [
          { text: "Share the image archive and edition list", owner: "Nina", priority: "HIGH", done: false },
          { text: "Compare Stripe tax handling for EU buyers", owner: "You", priority: "MEDIUM", done: false },
        ],
      },
    ],
  },
];

async function main() {
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, name: "Demo User" },
  });

  const clientIds = clients.map((client) => client.id);
  const sessionIds = clients.flatMap((client) => client.sessions.map((session) => session.id));

  // Remove only previously seeded rows, deepest relations first.
  await prisma.blueprint.deleteMany({ where: { sessionId: { in: sessionIds } } });
  await prisma.actionItem.deleteMany({ where: { sessionId: { in: sessionIds } } });
  await prisma.transcriptLine.deleteMany({ where: { sessionId: { in: sessionIds } } });
  await prisma.session.deleteMany({ where: { id: { in: sessionIds } } });
  await prisma.client.deleteMany({ where: { id: { in: clientIds } } });

  for (const client of clients) {
    await prisma.client.create({
      data: {
        id: client.id,
        userId: user.id,
        name: client.name,
        company: client.company,
        description: client.description,
        sessions: {
          create: client.sessions.map((session) => ({
            id: session.id,
            userId: user.id,
            title: session.title,
            clientName: client.name,
            meetingNumber: session.meetingNumber,
            status: session.status,
            meetingUrl: session.meetingUrl,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            transcriptLines: session.transcript.length
              ? {
                  create: session.transcript.map((line, index) => ({
                    speaker: line.speaker,
                    text: line.text,
                    timestamp: index * 45,
                  })),
                }
              : undefined,
            actionItems: session.actionItems.length
              ? {
                  create: session.actionItems.map((item) => ({
                    text: item.text,
                    owner: item.owner,
                    priority: item.priority,
                    done: item.done,
                  })),
                }
              : undefined,
            blueprint: session.blueprint
              ? {
                  create: {
                    summary: session.blueprint.summary,
                    requirements: session.blueprint.requirements,
                    userFlows: session.blueprint.userFlows,
                    techSpec: session.blueprint.techSpec,
                    fullPrompt: session.blueprint.fullPrompt,
                    confidence: session.blueprint.confidence,
                  },
                }
              : undefined,
          })),
        },
      },
    });
  }

  const [clientCount, sessionCount, lineCount, blueprintCount, actionCount] = await Promise.all([
    prisma.client.count({ where: { id: { in: clientIds } } }),
    prisma.session.count({ where: { id: { in: sessionIds } } }),
    prisma.transcriptLine.count({ where: { sessionId: { in: sessionIds } } }),
    prisma.blueprint.count({ where: { sessionId: { in: sessionIds } } }),
    prisma.actionItem.count({ where: { sessionId: { in: sessionIds } } }),
  ]);

  console.log(
    `Seeded for ${DEMO_EMAIL}: ${clientCount} clients, ${sessionCount} meetings, ${lineCount} transcript lines, ${blueprintCount} blueprints, ${actionCount} action items.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
