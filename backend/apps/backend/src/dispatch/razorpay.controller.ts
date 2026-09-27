import { Controller, Post, Req, Headers, HttpCode } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { verifyRazorpayWebhook } from './razorpay';
import { SkipThrottle } from '@nestjs/throttler';
@Controller('payments/razorpay')
export class RazorpayController {
  constructor(private dispatch: DispatchService) {}
  @Post('webhook')
  @HttpCode(200)
  @SkipThrottle()
  async webhook(@Req() req: {rawBody?: Buffer}, @Headers('x-razorpay-signature') signature: string) {
    verifyRazorpayWebhook(req.rawBody, signature);
    // return this.dispatch.payments.gatewayCaptured(JSON.parse(req.rawBody!.toString('utf8')));
    return { success: true };
  }
}
