import { Module } from '@nestjs/common';
import { TestRunnerController } from './test-runner.controller';
import { TestRunnerService } from './test-runner.service';
import { AgentService } from '../agent/agent.service';

@Module({
  controllers: [TestRunnerController],
  providers: [TestRunnerService, AgentService],
})
export class TestRunnerModule {}
