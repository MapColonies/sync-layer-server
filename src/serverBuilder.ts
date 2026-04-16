import express from 'express';
import bodyParser from 'body-parser';
import compression from 'compression';
import { getErrorHandlerMiddleware } from '@map-colonies/error-express-handler';
import { inject, injectable } from 'tsyringe';
import type { Logger } from '@map-colonies/js-logger';
import { httpLogger } from '@map-colonies/express-access-log-middleware';
import { collectMetricsExpressMiddleware } from '@map-colonies/prometheus';
import { Registry } from 'prom-client';
import type { ConfigType } from '@common/config';
import { SERVICES } from '@common/constants';

@injectable()
export class ServerBuilder {
  private readonly serverInstance: express.Application;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: ConfigType,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.METRICS) private readonly metricsRegistry: Registry
  ) {
    this.serverInstance = express();
  }

  public build(): express.Application {
    this.registerPreRoutesMiddleware();
    this.registerPostRoutesMiddleware();

    return this.serverInstance;
  }

  private registerPreRoutesMiddleware(): void {
    this.serverInstance.use(collectMetricsExpressMiddleware({ registry: this.metricsRegistry }));
    this.serverInstance.use(httpLogger({ logger: this.logger, ignorePaths: ['/metrics'] }));

    if (this.config.get('server.response.compression.enabled')) {
      this.serverInstance.use(compression(this.config.get('server.response.compression.options') as unknown as compression.CompressionFilter));
    }

    this.serverInstance.use(bodyParser.json(this.config.get('server.request.payload')));
  }

  private registerPostRoutesMiddleware(): void {
    this.serverInstance.use(getErrorHandlerMiddleware());
  }
}
