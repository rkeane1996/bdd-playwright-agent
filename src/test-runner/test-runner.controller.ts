import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TestRunnerService } from './test-runner.service';

@Controller()
export class TestRunnerController {
  constructor(private readonly runner: TestRunnerService) {}

  /**
   * POST /execute-test
   *  - multipart/form-data with a "file" field (.feature), or
   *  - application/json  { "feature": "Feature: ..." }
   */
  @Post('execute-test')
  @UseInterceptors(FileInterceptor('file'))
  async executeTest(
    @UploadedFile() file?: Express.Multer.File,
    @Body('feature') feature?: string,
  ) {
    const text = file?.buffer?.toString('utf-8') ?? feature;
    if (!text) {
      throw new BadRequestException(
        'Provide a "file" (multipart) or a "feature" string (JSON).',
      );
    }
    return this.runner.execute(text);
  }
}
