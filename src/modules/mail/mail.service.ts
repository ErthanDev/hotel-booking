import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly APP_NAME = 'Infinity Stay'; // Replace with your actual app name
    constructor(

        private readonly mailerService: MailerService
    ) { }

    async sendVerificationEmail(to: string, otp: string) {
        const subject = 'Verify Your Email Address - OTP Code';
        const text = `
Hello,

Thank you for signing up for ${this.APP_NAME}. Please verify your email address using this OTP: ${otp}.

This code is valid for 5 minutes. Please do not share this code with anyone.

If you did not sign up for an account, please ignore this email or contact our support team immediately.

Best regards,
${this.APP_NAME} Support Team
    `;

        const html = `
<p>Hello,</p>
<p>Thank you for signing up for <strong>${this.APP_NAME}</strong>. Please verify your email address using this OTP: <strong>${otp}</strong>.</p>
<p><strong>This code is valid for 5 minutes. Please do not share this code with anyone.</strong></p>
<p>If you did not sign up for an account, please ignore this email or contact our support team immediately.</p>
<p>Best regards,<br><strong>${this.APP_NAME} Support Team</strong></p>
    `;
        await this.sendMail(to, subject, text, html);

    }
    private async sendMail(to: string, subject: string, text: string, html: any) {
        this.logger.log(`Sending email to ${to} with subject "${subject}"`);
        try {
            await this.mailerService.sendMail({
                to,
                subject,
                text,
                html,
            });
        } catch (error) {
            this.logger.error(`Failed to send email to ${to}: ${error.message}`);
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }
}
