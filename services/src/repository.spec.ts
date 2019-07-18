import { Test } from '@nestjs/testing';
import Repository, {timestampExtractor} from './repository';
import CustomLogger from './logger';
import Settings from './settings';
import uuid from 'uuid/v4';
import moment = require('moment');

describe('timesExtractor', () => {
  it('seconds', () => {expect(timestampExtractor(1563348305123).inSeconds).toBe(1563348305);});
  it('day', () => {expect(timestampExtractor(1563348305123).day).toBe(1563321600);});
  it('hour', () => {expect(timestampExtractor(1563348305123).hourOfDay).toBe(7);});
  it('minute', () => {expect(timestampExtractor(1563348305123).minuteOfHour).toBe(25);});
  it('DayOfWeek', () => {expect(timestampExtractor(1563348305123).zeroIndexedDayOfWeek).toBe(2);});
  it('minuteOfDay', () => {expect(timestampExtractor(1563348305123).minuteOfDay).toBe(445);});
});

describe('db', () => {
  let repository: Repository;
  let settings: Settings

  beforeAll(async () => {
    settings = new Settings();
    jest.spyOn(settings, 'getBtInstanceId').mockImplementation(() => `testing-${uuid()}`);

    const module = await Test.createTestingModule({
        providers: [Repository, CustomLogger, {
          provide: Settings,
          useValue: settings
        }],
      }).compile();

    repository = module.get<Repository>(Repository);
    await repository.createSchema();
  });

  it('services crud', async () => {
    // TODO: something weird, very slow with 0 rows
    // let response = await repository.getAll();
    // expect(response.length).toBe(0);

    await repository.add({
      name: 'google.com',
      url: 'https://google.com'
    });

    let response = await repository.getAll();
    expect(response.length).toBe(1);

    await repository.delete(response[0].id);
  });

  it('update-checks works correctly', async () => {
    let response = await repository.add({
      name: 'google.com',
      url: 'https://google.com'
    });

    const id = response.id;

    const t1 = 1563378600000; // Wednesday, July 17, 2019 3:50:00 PM
    await repository.saveChecks([{
      id: id,
      code: 201,
      codeAt: t1
    }]);

    const t1Extracted = timestampExtractor(t1);
    let checkResponse = await repository.getCheckForDay(id, t1Extracted.day);
    expect(checkResponse['15']['50'][0].value).toBe(201)

    let checkTime = 1563417506000; // Thursday, July 18, 2019 2:38:26 AM
    jest.spyOn(repository, 'getTodaysDateMoment').mockImplementation(() => moment(checkTime).utc().startOf('day'));

    let services = await repository.getAll();
    const service = services.find(s => s.id === id)!;

    expect(service.checks[1][0]).toBe(1563321600);
    expect(service.checks[1][1][t1Extracted.hourOfDay][t1Extracted.minuteOfHour]).toBe(201);
    expect(service.checks[1][1][t1Extracted.hourOfDay][t1Extracted.minuteOfHour + 1]).toBe(0);
  });
});
