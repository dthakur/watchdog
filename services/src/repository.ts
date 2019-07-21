import { Injectable } from '@nestjs/common';
import { CreateServiceDto, Service } from './entities';
import CustomLogger from './logger';
import Settings from './settings';
import nanoid from 'nanoid';
import assert = require('assert');
import _ from 'lodash';
import moment, { Moment } from 'moment';
import Redis from 'ioredis';

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

interface MinuteValue {
  value: number;
  timestamp: number;
}

export function dayTimestampToMinutes(ts: number): number[] {
  // seconds
  assert(ts > 1000000000, '1000000000 ' + ts);
  assert(ts < 1000000000000, '1000000000000 ' + ts);
  assert(timestampExtractor(ts * 1000).day === ts, timestampExtractor(ts * 1000).day + ' ' + ts);

  const nextDay = ts + 24 * 60 * 60;
  const minutes = [];

  let current = ts;
  while (current < nextDay) {
    minutes.push(current);
    current = current + 60;
  }

  assert(minutes.length === 24 * 60);
  return minutes;
}

export function timestampExtractor(ts: number) {
  assert(ts > 1000000000000, '' + ts);
  const mm = moment(ts).utc();

  const inSeconds = mm.unix();
  const day = mm.clone().startOf('day').unix();
  const minute = mm.clone().startOf('minute').unix();
  const tenSeconds = Math.floor(ts / 10000) * 10;
  const hourOfDay = mm.hour();
  const minuteOfHour = mm.minute();
  const isoDayOfWeek = mm.isoWeekday();
  const zeroIndexedDayOfWeek = isoDayOfWeek - 1;
  const minuteOfDay = hourOfDay * 60 + minuteOfHour;

  return {
    inSeconds,
    day,
    minute,
    tenSeconds,
    hourOfDay,
    minuteOfHour,
    isoDayOfWeek,
    minuteOfDay,
    zeroIndexedDayOfWeek
  }
}

@Injectable()
export default class Repository {
  redis: Redis.Redis;

  constructor(private readonly logger: CustomLogger, private readonly settings: Settings) {
    this.redis = new Redis(settings.getRedisUrl());
  }

  close() {
    return this.redis.quit();
  }

  async add(dto: CreateServiceDto): Promise<Service> {
    const id = nanoid();
    const ts = Date.now();

    await this.redis.multi().hmset(id, {
      id: id,
      name: dto.name,
      url: dto.url,
      createdAt: ts
    }).sadd('services', id).exec();

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

  private getBaseChecksArray(days: number[]) {
    const info = days.map(d => {
      const values = _.range(24 * 60).map(_minute => {
        return 0;
      });

      return [[d], values];
    });

    return info;
  }

  private checksToView(id: string, days: number[], values: Map<string, Map<string, MinuteValue>>): number[][][] {
    return days.map(day => {
      const dayAsMoment = moment(day * 1000).utc();

      return [[day], dayTimestampToMinutes(day).map(minuteAbsolute => {
        const minute = Math.floor((minuteAbsolute - day) / 60);
        const minuteValue = values.get('' + day)!.get('' + minute)!;

        if (minuteValue.value !== 0) {
          const timeWhenSaved = moment(minuteValue.timestamp).utc();
          const lookupToDayDuration = moment.duration(timeWhenSaved.diff(dayAsMoment));

          if (lookupToDayDuration.asHours() > 24) {
            throw new Error(`stale value id=${id} timeWhenSaved=${timeWhenSaved.toString()} associatedDay=${dayAsMoment.toString()} hours=${lookupToDayDuration.asHours()}`);
          }
        }

        return minuteValue.value;
      })]
    });;
  }

  async getAll(): Promise<Service[]> {
    const today = this.getTodaysDateMoment();
    const days = _.range(7).map(n => today.clone().utc().subtract(n, 'day').unix());

    const ids = await this.redis.smembers('services');
    const services = await Promise.all(ids.map(async (i: string) => {
      const item = await this.redis.hgetall(i);

      item.checks = [];
      return item;
    })) as Service[];

    const items = await this.getCheckForDays(ids, days);

    services.forEach(service => {
      service.checks = this.checksToView(service.id, days, items.get(service.id)!);
    });

    return services;
  }

  async delete(id: string) {
    await this.redis.srem('services', id);
    return {};
  }

  async getCheckForDay(id: string, dayTimestamp: number) {
    return (await this.getCheckForDays([id], [dayTimestamp])).get(id)!.get('' + dayTimestamp)!;
  }

  async getCheckForDays(ids: string[], dayTimestamps: number[]) {
    if (ids.length === 0) {
      return new Map();
    }

    assert(ids.length > 0, JSON.stringify(ids));
    assert(dayTimestamps.length > 0);

    const p = this.redis.pipeline();

    ids.forEach(id => {
      dayTimestamps.forEach(dayTimestamp => {
        const minutes = dayTimestampToMinutes(dayTimestamp);

        minutes.forEach(m => {
          p.hgetall(`${id}:${m}`);
        });
      });
    });

    const response = await p.exec();
    const result: Map<string, Map<string, Map<string, MinuteValue>>> = new Map;

    ids.forEach(id => {
      result.set(id, new Map());
      dayTimestamps.forEach(dayTimestamp => {
        const minuteMap = new Map();
        result.get(id)!.set('' + dayTimestamp, minuteMap);
        const minutes = dayTimestampToMinutes(dayTimestamp);

        for (const minute in minutes) {
          let content = response[0][1];

          if (_.isEmpty(content)) {
            content = {
              value: 0,
              timestamp: 0
            }
          } else {
            content.value = parseInt(content.value);
            content.timestamp = parseInt(content.timestamp);
          }

          minuteMap.set(minute, content);
          response.shift();
        }
      });
    });

    return result;
  }

  private async updateChecks(results: CheckResult[]) {
    const p = this.redis.pipeline();

    results.forEach(r => {
      const times = timestampExtractor(r.codeAt);
      const minuteKey = `${r.id}:${times.minute}`;
      const tenKey = `${r.id}:${times.tenSeconds}`;
      const fields = {value: r.code, timestamp: r.codeAt};

      this.logger.log(`setting ${minuteKey} and ${tenKey} to ${JSON.stringify(fields)}`);
      p.hmset(minuteKey, fields)
      p.hmset(tenKey, fields)
    });

    await p.exec();
  }

  async saveChecks(results: CheckResult[]) {
    await this.updateChecks(results);
  }
}
