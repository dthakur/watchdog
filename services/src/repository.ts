import { Injectable, Query } from '@nestjs/common';
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

export function timestampExtractor(tsMills: number) {
  assert(tsMills > 1000000000000, '' + tsMills);
  const mm = moment(tsMills).utc();

  const inSeconds = mm.unix();
  const day = mm.clone().startOf('day').unix();
  const minute = mm.clone().startOf('minute').unix();
  const tenSeconds = Math.floor(tsMills / 10000) * 10;
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
    logger.log(`using redis from ${settings.getRedisUrl()}`);
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
      checksLatestMinute: 0,
      checks: []
    };
  }

  public getCurrentMinuteMomentUtc() {
    return moment().utc().startOf('minute');
  }

  async getAll(days: number = 1): Promise<Service[]> {
    const ids = await this.redis.smembers('services');
    const services = await Promise.all(ids.map(async (i: string) => {
      const item = await this.redis.hgetall(i);

      item.checksToday = 0,
      item.checks = [];
      return item;
    })) as Service[];

    if (days > 0) {
      const minutesToReturn = days * 24 * 60;
      const minute = this.getCurrentMinuteMomentUtc();
      await this.addChecks(services, minute, minutesToReturn);
    }

    return services;
  }

  async addChecks(services: Service[], minute: moment.Moment, count: number) {
    if (!services) {
      return;
    }

    const minutes = _.range(count).map(i => minute.clone().subtract(i, 'minute').unix());

    const p = this.redis.pipeline();
    let lookups = 0;
    services.forEach(service => {
      minutes.forEach(m => {
        const key = `${service.id}:${m}`;
        p.hgetall(key);
        lookups = lookups + 1;
      });
    });

    this.logger.log(`redis lookup ids=[${services.map(s => s.id).join(',')}] keyCount=${lookups}`);
    const response = await p.exec();

    services.forEach((service, serviceIndex) => {
      const serviceMinutes = minutes.map((minute, minuteIndex) => {
        let content = response[serviceIndex * minutes.length + minuteIndex][1];

        if (_.isEmpty(content)) {
          content = {
            value: -2,
            timestamp: 0
          }
        } else {
          content.value = parseInt(content.value);
          content.timestamp = parseInt(content.timestamp);
        }

        if (content.value !== 0 && content.timestamp !== 0) {
          const timeWhenSaved = moment(content.timestamp).utc();
          const minuteTime = moment.unix(minute).utc();

          const lookupDurationInMinutes = moment.duration(timeWhenSaved.diff(minuteTime)).asMinutes();

          if (lookupDurationInMinutes > 5) {
            throw new Error(`stale value id=${service.id} timeWhenSaved=${timeWhenSaved.toString()} associatedMinute=${minuteTime.toString()}}`);
          }
        }

        return content.value;
      });

      service.checksLatestMinute = minutes[0];
      service.checks = serviceMinutes;
    });
  }

  deleteAll() {
    return this.redis.del('services');
  }

  async delete(id: string) {
    await this.redis.srem('services', id);
    return {};
  }

  private async updateChecks(results: CheckResult[]) {
    const p = this.redis.pipeline();

    results.forEach(r => {
      const times = timestampExtractor(r.codeAt);
      const minuteKey = `${r.id}:${times.minute}`;
      const fields = {value: r.code, timestamp: r.codeAt};

      this.logger.log(`setting ${minuteKey} to ${JSON.stringify(fields)}`);
      p.hmset(minuteKey, fields)
    });

    await p.exec();
  }

  async saveChecks(results: CheckResult[]) {
    await this.updateChecks(results);
  }
}
