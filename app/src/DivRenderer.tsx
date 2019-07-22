import { ColorScheme } from './ColorScheme';
import { Rect } from './Canvas';

export class DivRenderer {
  constructor(private document: HTMLDocument, private div: HTMLDivElement, public readonly rect: Rect) {}

  addDiv({color, title, border}: {color: string, title: string, border: boolean}) {
    const e = this.document.createElement('div');
    e.style.background = color;
    e.style.position = 'absolute';
    e.style.height = this.rect.height + 'px';
    e.style.width = this.rect.width + 'px';
    e.style.left = this.rect.x + 'px';
    e.style.top = this.rect.y + 'px';

    if (border) {
      e.style.borderRadius = '2px';
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
    e.style.color = ColorScheme.text;
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
    return new DivRenderer(document, this.div, {
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
      width: this.rect.width - (sizeAdjust ? x : 0),
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
