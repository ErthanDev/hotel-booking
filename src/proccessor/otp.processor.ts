import { OnQueueEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NAME_QUEUE } from 'src/constants/name-queue.enum';
import { MailService } from 'src/modules/mail/mail.service';


@Processor('otp')
export class OtpProcessor extends WorkerHost {
  private readonly logger = new Logger(OtpProcessor.name);

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
    // Không cần retry vì chúng ta đã xử lý error trong process method
  }


  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.name} with ID ${job.id}`);
    try {
      switch (job.name) {
        case NAME_QUEUE.SEND_OTP_VERIFY_EMAIL:
          await this.handleSendOtpVerify(job);
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
  private async handleSendOtpVerify(job: Job<any, any, string>) {
    const { email, otp } = job.data;
    this.logger.log(`Sending OTP email to ${email} with OTP: ${otp}`);
    try {
      await this.mailService.sendVerificationEmail(email, otp);
      this.logger.log(`OTP email sent successfully to ${email}`);
      return { success: true, message: 'OTP email sent successfully' };
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${email}: ${error.message}`);
      // Không throw error để tránh retry không cần thiết
      return { success: false, error: error.message };
    }
  }
}
