import _ from 'lodash';
import { Injectable } from '@nestjs/common';

@Injectable()
export default class Settings {
  getBtInstanceId(): any {
    return this.getString('BT_INSTANCE_ID', 'uptime')
  }

  getString(name: string, defaultValue: string | undefined = undefined): string {
    const env = process.env[name];

    if (!_.isUndefined(env)) {
      return env;
    }

    if (!_.isUndefined(defaultValue)) {
      return defaultValue!;
    }

    throw Error(name);
  }
}
