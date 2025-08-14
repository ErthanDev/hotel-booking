import { OnQueueEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NAME_QUEUE } from 'src/constants/name-queue.enum';
import { MailService } from 'src/modules/mail/mail.service';


@Processor('mail-notification')
export class EmailNotiProcessor extends WorkerHost {
    private readonly logger = new Logger(EmailNotiProcessor.name);

    constructor(
        private readonly mailService: MailService,
    ) {
        super();

    }


    @OnQueueEvent('completed')
    onJobCompleted(jobId: string, result: any) {
        this.logger.debug(
            `Job ${jobId} completed successfully with result: ${JSON.stringify(result)}`,
        );
    }
    @OnQueueEvent('failed')
    async onJobFailed(jobId: string, error: Error) {
        this.logger.error(
            `Job ${jobId} failed: ${error.message || JSON.stringify(error)}`,
        );
    }

    async process(job: Job<any, any, string>): Promise<any> {
        this.logger.log(`Processing job ${job.name} with ID ${job.id}`);
        try {
            switch (job.name) {
                case NAME_QUEUE.SEND_MAIL_NOTI_PAYMENT_SUCCESS:
                    await this.sendMailNotiPaymentSuccess(job);
                    break;
                case NAME_QUEUE.SEND_MAIL_NOTI_PAYMENT_FAILED:
                    await this.sendMailNotiPaymentFailed(job);
                    break;
                case NAME_QUEUE.SEND_MAIL_NOTI_NEARLY_CHECKIN:
                    await this.sendMailNotiNearlyCheckIn(job);
                    break;
                case NAME_QUEUE.SEND_MAIL_NOTI_BOOKING_CANCELLED:
                    await this.sendMailNotiBookingCancelled(job);
                    break;
                default:
                    this.logger.warn(`No handler found for job: ${job.name}`);
            }

            this.logger.log(
                `Job ${job.name} with ID ${job.id} processed successfully.`,
            );
            return
        } catch (error) {
            this.logger.error(
                `Error processing job ${job.name} with ID ${job.id}: ${error.message}`,
            );
            throw error;
        }

    }


    private async sendMailNotiPaymentSuccess(job: Job<any, any, string>) {
        this.logger.debug(`Sending payment success email for job ID: ${job.id}`);
        const { to, checkInDate, checkOutDate, totalPrice, email, phone, roomId } = job.data;
        await this.mailService.sendMailBookingSuccess(
            to,
            checkInDate,
            checkOutDate,
            totalPrice,
            email,
            phone,
            roomId
        );
    }

    private async sendMailNotiPaymentFailed(job: Job<any, any, string>) {
        // await this.mailService.sendMailNotiPaymentFailed(data);
    }

    private async sendMailNotiNearlyCheckIn(job: Job<any, any, string>) {

    }

    private async sendMailNotiBookingCancelled(job: Job<any, any, string>) {
        this.logger.debug(`Sending booking cancellation email for job ID: ${job.id}`);
        const { to, checkInDate, checkOutDate, totalPrice, email, phone, roomType } = job.data;
        await this.mailService.sendMailBookingCancel(
            to,
            checkInDate,
            checkOutDate,
            totalPrice,
            email,
            phone,
            roomType
        );
    }
}
