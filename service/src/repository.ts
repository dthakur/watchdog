import { Injectable } from '@nestjs/common';
import { CreateServiceDto, Service } from './entities';
import CustomLogger from './logger';
import Bigtable from '@google-cloud/bigtable';
import Settings from './settings';
import nanoid from 'nanoid';
import assert = require('assert');
import _ from 'lodash';
import moment from 'moment';

enum UpStatus {
  Down = 0,
  Up = 1
}

interface UptimeView {
  services: ServiceUptime[]
}

interface CheckResult {
  id: string,
  code: number,
  codeAt: number
}

interface ServiceUptime {
  id: string,
  name: string,
  hours: UpStatus[]
}

export function timestampExtractor(ts: number) {
  assert(ts > 1000000000000, '' + ts);
  const mm = moment(ts).utc();

  const inSeconds = mm.unix();
  const day = mm.clone().startOf('day').unix();
  const hourOfDay = mm.hour();
  const minuteOfHour = mm.minute();
  const isoDayOfWeek = mm.isoWeekday();
  const zeroIndexedDayOfWeek = isoDayOfWeek - 1;
  const minuteOfDay = hourOfDay * 60 + minuteOfHour;

  return {
    inSeconds,
    day,
    hourOfDay,
    minuteOfHour,
    isoDayOfWeek,
    minuteOfDay,
    zeroIndexedDayOfWeek
  }
}

@Injectable()
export default class Repository {
  instance: any;

  constructor(private readonly logger: CustomLogger, private readonly settings: Settings) {
    this.instance = Bigtable().instance(this.settings.getBtInstanceId());
  }

  async createSchema() {
    const info = {name: 'info', rule: {versions: 1}};
    const hours = _.range(24).map(n => {
      return {name: '' + n, rule: {versions: 1}};
    });

    const days = _.range(7).map(n => {
      return {name: '' + n, rule: {versions: 1}};
    });

    await this.instance.table('services').create({families: [info].concat(days)});
    await this.instance.table('checks').create({families: hours});

    this.logger.log('schema created');
  }

  async add(dto: CreateServiceDto): Promise<Service> {
    const table = this.instance.table('services');
    const id = nanoid();

    const ts = Date.now();
    const service = {
      key: id,
      data: {
        info: {
          name: dto.name,
          url: dto.url,
          createdAt: ts
        }
      },
    };

    await table.insert(service);

    return {
      id,
      name: dto.name,
      url: dto.url,
      createdAt: ts,
      checks: []
    };
  }

  public getTodaysDateMoment() {
    return moment().utc().startOf('day');
  }

  private checksToView(id: string, data: any) {
    const today = this.getTodaysDateMoment();
    const days = _.range(7).map(n => today.clone().utc().subtract(n, 'day'))

    const info = days.map(d => {
      const values = _.range(24).map(hour => {
        return _.range(60).map(minute => {
          return 0;
        });
      });

      return [d.unix(), values];
    });

    for (const zeroDayOfWeek of Object.keys(data)) {
      if (!/^\d+$/.test(zeroDayOfWeek)) {
        continue;
      }

      // convert to the correct timestamp
      const zeroDayOfWeekToday = today.isoWeekday() - 1;
      let daysPassed = (zeroDayOfWeekToday - parseInt(zeroDayOfWeek));
      if (daysPassed < 0) {
        daysPassed = 7 + daysPassed;
      }

      assert(daysPassed >= 0 && daysPassed < 7, `${daysPassed} ${zeroDayOfWeekToday}, ${zeroDayOfWeek}`)

      const minuteData = data[zeroDayOfWeek];
      for (const minuteString of Object.keys(minuteData)) {
        if (!/^\d+$/.test(minuteString)) {
          continue;
        }

        const minuteOfDay = parseInt(minuteString);
        const hour = Math.floor(minuteOfDay / 60);
        const minute = minuteOfDay - hour * 60;

        const value = minuteData[minuteString][0].value;
        const timeWhenSaved = moment(Math.round(parseInt(minuteData[minuteString][0].timestamp) / 1000)).utc();
        const associatedDay = days[daysPassed];
        const lookupToDayDuration = moment.duration(timeWhenSaved.diff(associatedDay));

        if (lookupToDayDuration.asHours() > 24) {
          // throw new Error(`stale value id=${id} timeWhenSaved=${timeWhenSaved.toString()} associatedDay=${associatedDay.toString()} hours=${lookupToDayDuration.asHours()}`);
        }

        const pointer = info[daysPassed][1] as number[][];
        pointer[hour][minute] = value;
      }
    }

    return info;
  }

  private rowToView(row: any): Service {
    return {
      id: row.id,
      name: row.data.info.name[0].value,
      url: row.data.info.url[0].value,
      createdAt: row.data.info.createdAt[0].value,
      checks: this.checksToView(row.id, row.data)
    }
  }

  async getAll(): Promise<Service[]> {
    const table = this.instance.table('services');

    return new Promise((resolve, reject) => {
      const rows: Service[] = [];
      table.createReadStream()
        .on('error', reject)
        .on('data', (row: any) =>{
          rows.push(this.rowToView(row));
        })
        .on('end', function() {
          resolve(rows)
        });
    });
  }

  async delete(id: string) {
    await this.instance.table('services').row(id).delete();
    return {};
  }

  async getCheckForDay(id: string, dayTimestamp: number) {
    const key = `${id}#${dayTimestamp}`;
    const table = this.instance.table('checks');
    const response = await table.row(key).get();
    return response[0].data;
  }

  private async updateChecks(results: CheckResult[]) {
    const rows = results.map(r => {
      const times = timestampExtractor(r.codeAt);
      const key = `${r.id}#${times.day}`;

      return {
        key,
        data: {
          [times.hourOfDay]: {
            [times.minuteOfHour]: {
              value: r.code,
              timestamp: r.codeAt * 1000
            }
          }
        }
      };
    });

    await this.instance.table('checks').insert(rows);
  }

  private async updateServicesFromChecks(results: CheckResult[]) {
    const serviceRows = results.map(r => {
      const times = timestampExtractor(r.codeAt);

      const minutes = {
        [times.minuteOfDay]: {
          value: r.code,
          timestamp: r.codeAt * 1000
        }
      };

      return {
        key: `${r.id}`,
        data: {
          [times.zeroIndexedDayOfWeek]: minutes
        }
      };
    });

    await this.instance.table('services').insert(serviceRows);
  }

  async saveChecks(results: CheckResult[]) {
    await this.updateChecks(results);
    await this.updateServicesFromChecks(results);
  }
}
