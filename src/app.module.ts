import { Module } from '@nestjs/common';
import { TestRunnerModule } from './test-runner/test-runner.module';

@Module({ imports: [TestRunnerModule] })
export class AppModule {}
