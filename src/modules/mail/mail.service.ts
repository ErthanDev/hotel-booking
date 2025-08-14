import { MailerService } from '@nestjs-modules/mailer';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Room, RoomDocument } from '../rooms/schema/room.schema';
import { Model } from 'mongoose';
import { AppException } from 'src/common/exception/app.exception';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly APP_NAME = 'Infinity Stay'; // Replace with your actual app name
    constructor(

        private readonly mailerService: MailerService,
        @InjectModel(Room.name)
        private readonly roomModel: Model<RoomDocument>,
    ) { }
    formatDate(date: Date): string {
        if (!(date instanceof Date) || isNaN(date.getTime())) return '';
        const d = new Date(date); // bản sao
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }

    formatPrice(price: number): string {
        return price.toLocaleString('vi-VN', {
            style: 'currency',
            currency: 'VND'
        });
    }
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

    async sendForgotPasswordOtpEmail(to: string, otp: string) {
        const subject = 'Reset Your Password - OTP Code';
        const text = `
Hello,

We received a request to reset the password for your ${this.APP_NAME} account. Please use the following OTP to proceed: ${otp}.

This code is valid for 5 minutes. Please do not share this code with anyone.

If you did not request a password reset, please ignore this email or contact our support team immediately.

Best regards,
${this.APP_NAME} Support Team
    `;

        const html = `
<p>Hello,</p>
<p>We received a request to reset the password for your <strong>${this.APP_NAME}</strong> account. Please use the following OTP to proceed: <strong>${otp}</strong>.</p>
<p><strong>This code is valid for 5 minutes. Please do not share this code with anyone.</strong></p>
<p>If you did not request a password reset, please ignore this email or contact our support team immediately.</p>
<p>Best regards,<br><strong>${this.APP_NAME} Support Team</strong></p>
    `;

        await this.sendMail(to, subject, text, html);
    }

    async sendNewPasswordEmail(to: string) {
        const subject = 'Your Password Has Been Changed';

        const text = `
Hello,

This is a confirmation that the password for your ${this.APP_NAME} account has been successfully changed.

If you made this change, no further action is required.

If you did not change your password, please contact our support team immediately to secure your account.

Best regards,
${this.APP_NAME} Support Team
    `;

        const html = `
<p>Hello,</p>
<p>This is a confirmation that the password for your <strong>${this.APP_NAME}</strong> account has been successfully changed.</p>
<p>If you made this change, no further action is required.</p>
<p><strong>If you did not change your password, please contact our support team immediately to secure your account.</strong></p>
<p>Best regards,<br><strong>${this.APP_NAME} Support Team</strong></p>
    `;

        await this.sendMail(to, subject, text, html);
    }



    async sendMailNotiIsComingCheckIn(to: string, bookingId: string, checkInDate: string) {

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


    async sendMailBookingSuccess(to: string, checkInDate: Date, checkOutDate: Date, totalPrice: number, email: string, phone: string, roomId: string) {
        this.logger.log(`Sending booking confirmation email to ${to}`);
        const subject = 'Booking Confirmation - Infinity Stay';
        const formattedCheckIn = this.formatDate(checkInDate);
        const formattedCheckOut = this.formatDate(checkOutDate);
        const formattedPrice = this.formatPrice(totalPrice);
        const room = await this.roomModel.findById(roomId).lean().exec();
        if (!room) {
            this.logger.warn(`Room not found for ID: ${roomId}`);
            throw new AppException({
                message: 'Room not found',
                statusCode: HttpStatus.NOT_FOUND,
                errorCode: 'ROOM_NOT_FOUND',
            });
        }
        await this.mailerService.sendMail({
            to,
            from: 'Infinity Stay Hotel',
            subject,
            template: 'booking-success-mail-template',
            context: {
                checkInDate: formattedCheckIn,
                checkOutDate: formattedCheckOut,
                totalPrice: formattedPrice,
                email,
                phone,
                roomType: room?.roomType,
            }
        });
    }

    async sendMailBookingCancel(to: string, checkInDate: Date, checkOutDate: Date, totalPrice: number, email: string, phone: string, roomType: string) {
        this.logger.log(`Sending booking cancellation email to ${to}`);
        const subject = 'Booking Cancellation - Infinity Stay';
        const formattedCheckIn = this.formatDate(checkInDate);
        const formattedCheckOut = this.formatDate(checkOutDate);
        const formattedPrice = this.formatPrice(totalPrice);

        await this.mailerService.sendMail({
            to,
            from: 'Infinity Stay Hotel',
            subject,
            template: 'booking-cancel-mail-template',
            context: {
                checkInDate: formattedCheckIn,
                checkOutDate: formattedCheckOut,
                totalPrice: formattedPrice,
                email,
                phone,
                roomType,
            }
        });
    }

}
