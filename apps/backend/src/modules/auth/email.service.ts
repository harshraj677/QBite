import { logger } from '@logging/logger';

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

/**
 * Email delivery abstraction. No email provider has been chosen
 * anywhere in this project's stack yet — picking one (SMTP
 * credentials, a transactional-email API, deliverability setup) is a
 * decision bigger than this module, so it isn't made here.
 *
 * `LoggingEmailService` is a real, working implementation — not a
 * stub that throws — it logs the message via the structured logger
 * instead of sending it, which keeps the full registration/
 * verification/password-reset flow genuinely testable end-to-end
 * today. Swapping in a real provider later means implementing
 * `EmailService` once (e.g. `SmtpEmailService`) and changing the one
 * place it's constructed (auth.service.ts) — nothing else changes.
 */
export interface EmailService {
  send(message: EmailMessage): Promise<void>;
}

export class LoggingEmailService implements EmailService {
  async send(message: EmailMessage): Promise<void> {
    logger.info(
      { to: message.to, subject: message.subject, body: message.body },
      '[EmailService] Email not actually sent — no provider configured. Logged instead.',
    );
  }
}
