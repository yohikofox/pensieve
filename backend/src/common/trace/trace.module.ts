/**
 * TraceModule — Story 26.1: Distributed Tracing
 *
 * Module non-global qui fournit TraceMiddleware.
 * Doit être importé dans AppModule pour que le middleware soit disponible
 * via configure().
 */

import { Module } from '@nestjs/common';
import { TraceMiddleware } from './trace.middleware';

@Module({
  providers: [TraceMiddleware],
  exports: [TraceMiddleware],
})
export class TraceModule {}
