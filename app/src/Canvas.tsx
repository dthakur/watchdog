import React from 'react';
import axios from 'axios';
import { Service } from './entities';
import moment from 'moment';
import _ from 'lodash';
import {ColorScheme} from './ColorScheme';

interface ServicesState {
  services: Service[]
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
    this.drawChecks(service, renderer.xOffset(width, true));
    renderer.addText(service.name, width);
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
    const itemsPerLine = 3 * 60; // 4 hours
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

      renderer.size(drawInfo.width, drawInfo.height).addDiv(this.getColor(minute), title, true);
      renderer = renderer.xOffset(drawInfo.width);

      i = i + 1;
      if (i !== 0 && (i % drawInfo.itemsPerLine === 0)) {
        renderer.rect.x = drawRenderer.rect.x;
        renderer.rect.y = Math.floor(drawRenderer.rect.y + drawInfo.height * i / drawInfo.itemsPerLine);
      }
    });
  }

  private draw(div: HTMLDivElement, services: Service[]) {
    const width = document.body.clientWidth;
    const height = document.body.clientHeight;

    div.style.width = width + 'px';
    div.style.height = height + 'px';
    div.style.background = ColorScheme.background;

    const renderer = new DivRenderer(document, div, {
      x: 0,
      y: 0,
      width: document.body.clientWidth,
      height: document.body.clientHeight
    });

    const heightPerService = Math.floor(height / services.length);

    services.forEach((service, index) => {
      this.drawService(service, renderer.offset({
        x: 0,
        y: heightPerService * index,
        width: width,
        height: heightPerService
      }));
    });
  }

  render() {
    return <div ref={this.rootRef} />;
  }
}

interface Rect {
  x: number,
  y: number,
  width: number,
  height: number
}

class DivRenderer {
  constructor(private document: HTMLDocument, private div: HTMLDivElement, public readonly rect: Rect) {}

  addDiv(color: string, title?: string, border: boolean = false) {
    const e = this.document.createElement('div');

    e.style.background = color;
    e.style.position = 'absolute';
    e.style.height = this.rect.height + 'px';
    e.style.width = this.rect.width + 'px';
    e.style.left = this.rect.x + 'px';
    e.style.top = this.rect.y + 'px';

    if (border) {
      e.style.boxSizing = 'border-box';
      e.style.border = `${ColorScheme.borderColor} 1px solid`;
    }

    if (title) {
      e.title = title;
    }

    this.div.appendChild(e);

    return e;
  }

  addText(name: string, width: number) {
    const e = this.document.createElement('span');
    e.innerHTML = name;
    e.className = 'site-name';

    e.style.position = 'absolute';
    e.style.left = this.rect.x + 'px';
    e.style.top = this.rect.y + 'px';
    e.style.color = ColorScheme.text;;
    e.style.height = this.rect.height + 'px';
    e.style.textAlign = 'center';
    e.style.width = e.style.lineHeight = width + 'px';
    e.style.writingMode = 'vertical-lr';
    e.style.transform = 'rotate(-180deg)';

    this.div.appendChild(e);
  }

  size(width: number, height: number) {
    return new DivRenderer(document, this.div, {
      x: this.rect.x,
      y: this.rect.y,
      width: width,
      height: height
    });
  }

  center(spareX: number, spareY: number) {
    const halfSpareX = spareX / 2;
    const halfSpareY = spareY / 2;
    return new DivRenderer(document ,this.div, {
      x: Math.floor(this.rect.x + halfSpareX),
      y: Math.floor(this.rect.x + halfSpareY),
      width: this.rect.x - spareX,
      height: this.rect.y - spareY
    });
  }

  xOffset(x: number, sizeAdjust = false): any {
    return new DivRenderer(document, this.div, {
      x: this.rect.x + x,
      y: this.rect.y,
      width: this.rect.width - (sizeAdjust ? x: 0),
      height: this.rect.height
    });
  }

  offset(rect: Rect) {
    return new DivRenderer(document, this.div, {
      x: this.rect.x + rect.x,
      y: this.rect.y + rect.y,
      width: rect.width,
      height: rect.height
    });
  }
}
