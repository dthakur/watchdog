import React from 'react';
import axios from 'axios';
import { Service } from './entities';
import moment from 'moment';
import _ from 'lodash';
import { ColorScheme } from './ColorScheme';
import { DivRenderer } from './DivRenderer';

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

  constructor(props: any) {
    super(props);

    this.rootRef = React.createRef();
    this.getServices();

    setInterval(this.getServices.bind(this), 30 * 1000);
  }

  shouldComponentUpdate() {
    // not using react for rendering
    return false;
  }

  private async getServices() {
    const url = '/api/v1/services?days=1'
    const response = await axios.get<Service[]>(url);
    const services = response.data;

    this.setState({services});

    this.rootRef.current!.innerHTML = '';

    _.defer(() => {
      this.draw(this.rootRef.current!, services);
    });
  }

  private drawService(service: Service, renderer: DivRenderer) {
    const width = 30;
    renderer.addText(service.name, width);
    return this.drawChecks(service, renderer.xOffset(width, true));
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

  private getSizing(itemCount: number, renderer: DivRenderer) {
    const itemsPerLine = 3 * 60; // x hours
    const lines = Math.ceil(itemCount / itemsPerLine);
    const width = Math.floor(renderer.rect.width / itemsPerLine);
    const height = Math.floor(renderer.rect.height / lines);

    const spareX = Math.floor(renderer.rect.width - itemsPerLine * width);
    const spareY = Math.floor(renderer.rect.height - lines * height);

    return {
      lines,
      height,
      width,
      itemsPerLine,
      spareX,
      spareY
    }
  }

  private drawChecks(service: Service, originalRenderer: DivRenderer) {
    const drawInfo = this.getSizing(service.checks.length, originalRenderer);
    const drawRenderer = originalRenderer;
    let renderer = drawRenderer;

    let i = 0;
    service.checks.forEach((minute, minuteIndex) => {
      const minuteMoment = moment.unix(service.checksLatestMinute).subtract(minuteIndex, 'minute');
      const title = `${minuteMoment.format('lll')} ${minute}`;

      renderer.size(drawInfo.width, drawInfo.height).addDiv({
        color: this.getColor(minute),
        title,
        border: true
      });

      renderer = renderer.xOffset(drawInfo.width);

      i = i + 1;
      if (i !== 0 && (i % drawInfo.itemsPerLine === 0)) {
        renderer.rect.x = drawRenderer.rect.x;
        renderer.rect.y = Math.floor(drawRenderer.rect.y + drawInfo.height * i / drawInfo.itemsPerLine);
      }
    });

    return drawInfo;
  }

  private draw(div: HTMLDivElement, services: Service[]) {
    const width = document.body.clientWidth;
    const height = document.body.clientHeight;

    div.style.width = width + 'px';
    div.style.height = height + 'px';
    div.style.background = ColorScheme.background;
    document.documentElement.style.background = ColorScheme.background;

    const renderer = new DivRenderer(document, div, {
      x: 0,
      y: 0,
      width: document.body.clientWidth,
      height: document.body.clientHeight
    });

    const heightPerService = Math.floor(height / services.length);

    const infos = services.map((service, index) => {
      return this.drawService(service, renderer.offset({
        x: 0,
        y: heightPerService * index,
        width: width,
        height: heightPerService
      }));
    });

    // center horizontally and vertically
    const minSpareX = _.min(infos.map(x => x.spareX))!;
    const minSpareY = _.min(infos.map(x => x.spareY))!;
    div.style.transform = `translate(${minSpareX / 2}px, ${minSpareY / 2}px)`;
  }

  render() {
    return <div ref={this.rootRef} />;
  }
}

