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
  // Converts rgb(255, 255, 255) to #ffffff
  return '#' + rgb.substring(4, rgb.length - 1).split(', ')
    .map(c => parseInt(c).toString(16).padStart(2, '0'))
    .join('');
}

function capitalize(string) {
  // Makes the first letter of each word uppercase
  return string.split(' ')
    .map(word => word[0].toUpperCase() + word.substring(1))
    .join(' ');
}

function svgParser(svgString) {
  // Parses svgString to extract the part layer and the creator
  const root = document.createElement('div');
  root.innerHTML = svgString.replace('<?xml version="1.0" ?>', '');

  const svg = root.firstElementChild;

  const layer = svg.querySelector('svg > g');
  const creator = svg.querySelector('svg dc\\:creator dc\\:title').textContent;

  return { layer, creator };
}

function svgBuilder(parts) {
  // Builds a full avatar svg from parts

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

  // Combines every creators in the contributors metadata field
  const contributors = new Set();
  for (let { layer, creator } of parts) {
    root.appendChild(layer);
    contributors.add(creator);
  }

  // Metadata with contributors, source and license
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
  // Retrieves all styling from css sheets related to element
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
  // Triggers the download of a base64 uri
  const link = document.createElement("a");
  link.download = name;
  link.href = uri;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  delete link;
}

function inlineSvgStyles(svg) {
  // Copies every css style related to svg into the svg itself (inline)

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
  // Exports svg to png with set width

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
  // Exports svg
  const styledSvg = inlineSvgStyles(svg);
  const svgUri = URL.createObjectURL(new Blob([styledSvg.outerHTML], { type: 'image/svg+xml' }));
  downloadURI(svgUri, 'avatar.svg');
}

partNames = [
  "backhair", "bust", "neck",
  "ears", "head", "eyes", "eyebrows",
  "nose", "mouth", "freckles", "hair",
  "glasses", "hat"
];

async function getPartsList(part) {
  // Retrieves all the variants of part from the parts server

  const response = await fetch(`/parts/${part}/`);
  const html = await response.text();
  const root = document.createElement('div');
  root.innerHTML = html;
  const links = root.querySelectorAll('a');

  const partList = [];
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const name = link.getAttribute('href');
    const tags = link.getAttribute('data-tags').split(' ');
    const creator = link.getAttribute('data-creator');
    partList.push({ name, tags, creator });
  }

  return partList;
}

async function getPart(part, name) {
  // Retrieves a svg part file from the server
  const response = await fetch(`/parts/${part}/${name}`);
  const xml = await response.text();
  return xml;
}

// A static css spinner
const spinner = document.createElement('div');
spinner.classList.add('spinner');

async function run() {
  // Retrieves parts, builds and displays an avatar
  
  const avatar = document.getElementById('avatar');
  avatar.replaceChildren(spinner)

  const parts = [];
  for (let partName of partNames) {
    const partList = await getPartsList(partName);
    const xml = await getPart(partName, partList[0]['name']);
    const part = svgParser(xml);
    parts.push(part);
  }

  const output = svgBuilder(parts);

  avatar.replaceChildren(output);
}

function getLiveColorRules() {
  // Get live css rules for the color palette
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

// Color palette for avatars
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
  // Updates css palette rules to the new color
  const className = `.${event.target.id}`;
  colorRules[className].setProperty('fill', event.target.value);
}

// Builds html color palette editor
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

// Setup download buttons
document.getElementById('download').addEventListener('click', () => {
  const svg = document.getElementById('avatar').firstElementChild;
  exportPng(svg, 512);
});

document.getElementById('download-svg').addEventListener('click', () => {
  const svg = document.getElementById('avatar').firstElementChild;
  exportSvg(svg);
});

// Start
window.onload = () => {
  run();
}

