/*
    Client-side javascript avatar editor
    Copyright (C) <year>  Xavier "crashoz" Launey

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

function rgb2hex(rgb) {
  return '#' + rgb.substring(4, rgb.length - 1).split(', ')
    .map(c => parseInt(c).toString(16).padStart(2, '0'))
    .join('');
}

function capitalize(string) {
  return string.split(' ')
    .map(word => word[0].toUpperCase() + word.substring(1))
    .join(' ');
}

function svgParser(svgString) {
  const root = document.createElement('div');
  root.innerHTML = svgString.replace('<?xml version="1.0" ?>', '');

  const svg = root.firstElementChild;

  const layer = svg.querySelector('svg > g');
  const creator = svg.querySelector('svg dc\\:creator dc\\:title').textContent;

  return { layer, creator };
}

function svgBuilder(parts) {
  const root = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  root.setAttribute('width', '124.19042mm');
  root.setAttribute('height', '124.19042mm');
  root.setAttribute('viewBox', '0 0 124.19042 124.19042');
  root.setAttribute('version', '1.1');
  root.setAttribute('id', 'svgout');
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  root.setAttribute('xmlns:cc', 'http://creativecommons.org/ns#');
  root.setAttribute('xmlns:dc', 'http://purl.org/dc/elements/1.1/');
  root.setAttribute('xmlns:inkscape', 'http://www.inkscape.org/namespaces/inkscape');
  root.setAttribute('xmlns:rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#');
  root.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  const contributors = new Set();
  for (let { layer, creator } of parts) {
    root.appendChild(layer);
    contributors.add(creator);
  }

  const metadata = document.createElement('metadata');
  metadata.innerHTML = `
    <rdf:RDF>
        <cc:Work>
            <dc:contributor>
                <cc:Agent>
                    <dc:title>${[...contributors].join(', ')}</dc:title>
                </cc:Agent>
            </dc:contributor>
            <dc:source>https://github.com/profile-generators/avatar-parts</dc:source>
            <dc:subject>
                <rdf:Bag>
                    <rdf:li>template</rdf:li>
                    <rdf:li>man</rdf:li>
                </rdf:Bag>
            </dc:subject>
        </cc:Work>
        <cc:License rdf:about="http://creativecommons.org/licenses/by/4.0/">
            <cc:permits rdf:resource="http://creativecommons.org/ns#Reproduction"/>
            <cc:permits rdf:resource="http://creativecommons.org/ns#Distribution"/>
            <cc:requires rdf:resource="http://creativecommons.org/ns#Notice"/>
            <cc:requires rdf:resource="http://creativecommons.org/ns#Attribution"/>
            <cc:permits rdf:resource="http://creativecommons.org/ns#DerivativeWorks"/>
        </cc:License>
    </rdf:RDF>`;

  root.appendChild(metadata);
  return root;
}

function getElementStyles(element) {
  const rules = [];

  const sheets = document.styleSheets;
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    for (let j = 0; j < sheet.cssRules.length; j++) {
      const rule = sheet.cssRules[j];

      switch (rule.constructor) {
        case CSSStyleRule:
          if (element.matches(rule.selectorText)) {
            for (let k = 0; k < rule.style.length; k++) {
              const name = rule.style[k];
              const value = rule.style.getPropertyValue(name);
              rules.push([name, value]);
            }
          }
          break;
      }
    }
  }

  return rules;
}

function downloadURI(uri, name) {
  const link = document.createElement("a");
  link.download = name;
  link.href = uri;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  delete link;
}

function inlineSvgStyles(svg) {
  const styledSvg = svg.cloneNode(true);

  const stack = [styledSvg];
  while (stack.length) {
    const node = stack.pop();

    const rules = getElementStyles(node);
    for (let [name, value] of rules) {
      node.style[name] = value;
    }
    node.className = '';

    for (let i = 0; i < node.children.length; i++) {
      stack.push(node.children[i]);
    }
  }
  
  return styledSvg;
}

function exportPng(svg, width) {
  const styledSvg = inlineSvgStyles(svg);
  const svgUri = URL.createObjectURL(new Blob([styledSvg.outerHTML], { type: 'image/svg+xml' }));

  const img = document.createElement('img');
  img.onload = function () {
    const canvas = document.createElement("canvas");
    const ratio = (img.clientWidth / img.clientHeight) || 1;
    canvas.width = width;
    canvas.height = width / ratio;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const pngUri = canvas.toDataURL('image/png');
    downloadURI(pngUri, 'avatar.png');
  };
  img.src = svgUri;
}

function exportSvg(svg) {
  const styledSvg = inlineSvgStyles(svg);
  const svgUri = URL.createObjectURL(new Blob([styledSvg.outerHTML], { type: 'image/svg+xml' }));
  downloadURI(svgUri, 'avatar.svg');
}

async function run() {
  const parts = [];
  for (let raw of rawSvgParts) {
    const part = svgParser(raw);
    parts.push(part);
  }

  const output = svgBuilder(parts);

  document.getElementById('avatar').appendChild(output);
}

function getLiveColorRules() {
  const rules = {};

  const sheets = document.styleSheets;
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    for (let j = 0; j < sheet.cssRules.length; j++) {
      const rule = sheet.cssRules[j];

      switch (rule.constructor) {
        case CSSStyleRule:
          if (classPalette.includes(rule.selectorText)) {
            rules[rule.selectorText] = rule.style;
          }
          break;
      }
    }
  }

  return rules;
}

const palette = [
  'flesh_fill', 'flesh_stroke',
  'flesh2_fill', 'flesh2_stroke',
  'flesh3_fill', 'flesh3_stroke',
  'hair_fill', 'hair_stroke',
  'hair2_fill', 'hair2_stroke',
  'eye_color',
  'p1_fill', 'p1_stroke',
  'p2_fill', 'p2_stroke',
  'p3_fill', 'p3_stroke',
  'p4_fill', 'p4_stroke'
];

const classPalette = palette.map(c => `.${c}`);
const colorRules = getLiveColorRules();

function updateColor(event) {
  const className = `.${event.target.id}`;
  colorRules[className].setProperty('fill', event.target.value);
}

for (let color of palette) {
  const input = document.createElement('input');
  input.setAttribute('id', color);
  input.setAttribute('type', 'color');
  input.setAttribute('value', rgb2hex(colorRules[`.${color}`].getPropertyValue('fill')));
  input.addEventListener('input', updateColor);

  console.log();

  const label = document.createElement('label');
  label.setAttribute('for', color);
  label.textContent = capitalize(color.replaceAll('_', ' '));

  const div = document.createElement('div');
  div.classList.add('colorpicker');

  div.appendChild(label);
  div.appendChild(input);

  document.getElementById('colors').appendChild(div);
}

document.getElementById('download').addEventListener('click', () => {
  const svg = document.getElementById('avatar').firstElementChild;
  exportPng(svg, 512);
});

document.getElementById('download-svg').addEventListener('click', () => {
  const svg = document.getElementById('avatar').firstElementChild;
  exportSvg(svg);
});

window.onload = () => {
  run();
}

