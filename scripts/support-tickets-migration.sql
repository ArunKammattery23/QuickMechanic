BEGIN;
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "requesterId" uuid NOT NULL,
  "requesterRole" varchar(20) NOT NULL,
  subject varchar(120) NOT NULL,
  category varchar(32) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'OPEN',
  "jobId" uuid,
  "assignedAdminId" uuid,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_requester_role CHECK ("requesterRole" IN ('CUSTOMER','MECHANIC','FLEET_DRIVER')),
  CONSTRAINT support_ticket_status CHECK (status IN ('OPEN','IN_PROGRESS','WAITING_FOR_USER','RESOLVED','CLOSED')),
  CONSTRAINT support_ticket_category CHECK (category IN ('JOB','PAYMENT','KYC','ACCOUNT','APP','OTHER'))
);
CREATE INDEX IF NOT EXISTS support_tickets_owner_created_idx ON support_tickets ("requesterRole", "requesterId", "createdAt");
CREATE INDEX IF NOT EXISTS support_tickets_status_updated_idx ON support_tickets (status, "updatedAt" DESC);
CREATE TABLE IF NOT EXISTS support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticketId" uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  "senderId" uuid NOT NULL,
  "senderRole" varchar(20) NOT NULL,
  body varchar(4000) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_messages_ticket_created_idx ON support_messages ("ticketId", "createdAt");
COMMIT;
