import { OnQueueEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NAME_QUEUE } from 'src/constants/name-queue.enum';
import { TransactionsService } from 'src/modules/transactions/transactions.service';
import { ZalopayService } from 'src/modules/zalopay/zalopay.service';


@Processor('payment')
export class TransactionProcessor extends WorkerHost {
  private readonly logger = new Logger(TransactionProcessor.name);

  constructor(
    private readonly zalopayService: ZalopayService,
    private readonly transactionService: TransactionsService,
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

        case NAME_QUEUE.HANDLE_CREATE_PAYMENT_URL:
          await this.handleCreatePaymentUrl(job);
          break;
        case NAME_QUEUE.CANCEL_TRANSACTION:
          await this.cancelTransaction(job);
          break
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

  private async handleCreatePaymentUrl(job: Job<any, any, string>) {
    const { bookingId, userEmail, amount, session } = job.data;
    this.logger.log(`Creating payment link for booking ID: ${bookingId} with amount: ${amount}`);

    const result = await this.zalopayService.createZaloPayPayment(amount, bookingId, userEmail);
    this.logger.log(`Payment link created successfully: ${result.order_url}`);
    return result;

  }

  private async cancelTransaction(job: Job<any, any, string>) {
    const { providerTransactionId } = job.data;
    this.logger.log(`Cancelling transaction with ID: ${providerTransactionId}`);
    const transaction = await this.transactionService.cancelTransaction(providerTransactionId);
  }
}