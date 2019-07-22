import { Injectable, HttpService } from '@nestjs/common';
import Repository from '../repository';
import _ from 'lodash';
import { Service } from '../entities';

@Injectable()
export default class Checker {
  constructor(
    private readonly httpService: HttpService,
    private readonly repo: Repository) {}

  private async ping(services: Service[]) {
    const start = Date.now();
    const codes = await Promise.all(services.map(async s => {
      try {
        const result = await this.httpService.get(s.url).toPromise();
        return result.status;
      } catch (error) {
        if (!_.isUndefined(error.response) && !_.isUndefined(error.response.status)) {
          return error.response.status;
        }

        return -1;
      }
    }));

    return services.map((item, index) => {
      return Object.assign({}, item, {
        code: codes[index],
        codeAt: start
      });
    });
  }

  async run() {
    const services = await this.repo.getAll(0);
    const responses = await this.ping(services);

    await this.repo.saveChecks(responses.map(r => {
      return {
        id: r.id,
        code: r.code,
        codeAt: r.codeAt
      };
    }));

    return responses;
  }
}
