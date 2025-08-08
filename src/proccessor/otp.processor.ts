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
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.name} with ID ${job.id}`);
    try {
      switch (job.name) {
        case NAME_QUEUE.SEND_OTP_VERIFY_EMAIL:
          this.logger.log(`Handling OTP verification for job: ${job.id}`);
          await this.handleSendOtpVerify(job);
          break;
        case NAME_QUEUE.SEND_NEW_PASSWORD:
          this.logger.log(`Handling new password for job: ${job.id}`);
          await this.sendNewPasswordEmail(job.data.email);
          break;
        case NAME_QUEUE.SEND_OTP_FORGOT_PASSWORD:
          this.logger.log(`Handling forgot password OTP for job: ${job.id}`);
          await this.sendOtpForgotPassword(job.data.email, job.data.otp);
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

      return { success: false, error: error.message };
    }
  }

  async sendOtpForgotPassword(email: string, otp: string) {
    this.logger.log(`Sending OTP for forgot password to ${email}`);
    try {
      await this.mailService.sendForgotPasswordOtpEmail(email, otp);
      this.logger.log(`OTP for forgot password sent successfully to ${email}`);
      return { success: true, message: 'OTP for forgot password sent successfully' };
    } catch (error) {
      this.logger.error(`Failed to send OTP for forgot password to ${email}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async sendNewPasswordEmail(email: string) {
    this.logger.log(`Sending new password email to ${email}`);
    try {
      await this.mailService.sendNewPasswordEmail(email);
      this.logger.log(`New password email sent successfully to ${email}`);
      return { success: true, message: 'New password email sent successfully' };
    } catch (error) {
      this.logger.error(`Failed to send new password email to ${email}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }


}
