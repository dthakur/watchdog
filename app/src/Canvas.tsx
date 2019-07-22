import React from 'react';
import axios from 'axios';
import { Service } from './entities';
import moment from 'moment';
import { ColorScheme } from './ColorScheme';

interface ServicesState {
  services: Service[]
}

export interface Rect {
  x: number,
  y: number,
  width: number,
  height: number
}

export default class extends React.Component<{}, ServicesState> {
  rootRef: React.RefObject<HTMLDivElement>;
  state = {services: []} as ServicesState;

  constructor(props: any) {
    super(props);

    this.rootRef = React.createRef();
    this.getServices();

    setInterval(this.getServices.bind(this), 30 * 1000);
  }

  private async getServices() {
    const url = '/api/v1/services?days=1'
    const response = await axios.get<Service[]>(url);
    const services = response.data;

    this.setState({services});
  }

  private drawService(service: Service, width: number, rect: Rect) {
    const checks = this.drawChecks(service, {
      x: rect.x + width,
      y: rect.y,
      width: rect.width - rect.x,
      height: rect.height
    })

    return <div key={service.id} style={{position: 'absolute'}}>
      <span style={{
        position: 'absolute',
        left: rect.x - 10,
        top: rect.y,
        color: ColorScheme.text,
        height: rect.height,
        textAlign: 'center',
        width: width,
        writingMode: 'vertical-lr',
        transform: 'rotate(-180deg)'
      }}>{service.name}</span>
      <div>
        {checks}
      </div>
    </div>;
  }

  private getColor(minuteData: number) {
    if (minuteData === 200) {
      return ColorScheme.ok;
    } else if (minuteData === -1) {
      return ColorScheme.timeout;
    } else if (minuteData === -2) {
      return ColorScheme.noData;
    } else {
      return ColorScheme.error;
    }
  }

  private getSizing(itemCount: number, rect: Rect) {
    const itemsPerLine = 3 * 60; // x hours
    const lines = Math.ceil(itemCount / itemsPerLine);
    const width = Math.floor(rect.width / itemsPerLine);
    const height = Math.floor(rect.height / lines);

    const spareX = Math.floor(rect.width - itemsPerLine * width);
    const spareY = Math.floor(rect.height - lines * height);

    return {
      lines,
      height,
      width,
      itemsPerLine,
      spareX,
      spareY
    }
  }

  private drawChecks(service: Service, rect: Rect) {
    const drawInfo = this.getSizing(service.checks.length, rect);

    return service.checks.map((minute, minuteIndex) => {
      const minuteMoment = moment.unix(service.checksLatestMinute).subtract(minuteIndex, 'minute');
      const title = `${minuteMoment.format('lll')} ${minute}`;

      return <div key={`${service.id}:${minuteMoment.utc().unix()}`} title={title} style={{
        background: this.getColor(minute),
        position: 'absolute',
        height: drawInfo.height,
        width: drawInfo.width,
        left: rect.x + (minuteIndex % drawInfo.itemsPerLine) * drawInfo.width,
        top: rect.y + Math.floor(drawInfo.height * Math.floor((minuteIndex / drawInfo.itemsPerLine))),
        borderRadius: 2,
        boxSizing: 'border-box',
        borderColor: ColorScheme.borderColor,
        borderWidth: 1,
        borderStyle: 'solid'
      }}/>;
    });
  }

  render() {
    document.documentElement.style.background = ColorScheme.background;

    if (this.state.services.length === 0) {
      return null;
    }

    const width = document.body.clientWidth;
    const height = document.body.clientHeight;
    const heightPerService = Math.floor(height / this.state.services.length);
    const labelWidth = 10;
    const services = this.state.services.map((service, index) => {
      return this.drawService(service, labelWidth, {
        x: 0,
        y: heightPerService * index,
        width: width,
        height: heightPerService
      });
    });

    const drawInfo = this.getSizing(this.state.services[0].checks.length, {
      x: 0,
      y: 0,
      width: width - labelWidth,
      height: heightPerService
    });
    const translate = `translate(${drawInfo.spareX / 2}px, ${drawInfo.spareY / 2}px)` // center horizontally and vertically

    return <div ref={this.rootRef} style={{
      width: document.body.clientWidth,
      height: document.body.clientHeight,
      background: ColorScheme.background,
      transform: translate
    }}>
      {services}
    </div>;
  }
}

