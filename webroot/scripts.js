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

const CACHE_SIZE = 10;
const PRELOAD_SIZE = 2;

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

async function sleep(millis) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, millis);
  });
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

    // May fail with 
    // DOMException: CSSStyleSheet.cssRules getter: Not allowed to access cross-origin stylesheet
    // When we have external css sheets
    try {
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
    } catch (e) { }
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

const parts = {};
let activeParts = [];

async function getPartsList(part) {
  // Retrieves all the variants of part from the parts server

  const response = await fetch(`/parts/${part}/index.html`);
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
  return svgParser(xml);
}

function preloadPart(partName, index) {
  const { list, cache, queue } = parts[partName];

  if (index in cache) {
    const part = cache[index];
    queue.splice(queue.indexOf(index), 1);
    queue.unshift(index);
  } else {
    const part = getPart(partName, list[index]['name']);

    cache[index] = part;
    if (Object.keys(cache).length > CACHE_SIZE) {
      delete cache[queue.pop()];
    }
    queue.unshift(index);
  }
}

async function requestServerAvatar() {
  const data = {
    parts: [],
    palette: {}
  };

  for (let partName of partNames) {
    const index = parts[partName].index;
    const name = parts[partName].list[index].name;
    const partIndex = parseInt(name.split('_')[1].substring(0, 4));
    data.parts.push(partIndex);
  }

  for (let color of palette) {
    data.palette[color] = rgb2hex(colorRules[`.${color}`].getPropertyValue('fill'));
  }

  const response = await fetch(`/gen`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error("network error")
  }

  const text = await response.text();
  return text;
}

function getLiveColorRules() {
  // Get live css rules for the color palette
  const rules = {};

  const sheets = document.styleSheets;
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];

    // May fail with 
    // DOMException: CSSStyleSheet.cssRules getter: Not allowed to access cross-origin stylesheet
    // When we have external css sheets
    try {
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
    } catch (e) { }
  }

  return rules;
}

// Color palette for avatars
const palette = [
  'flesh', 'flesh2', 'flesh3',
  'hair', 'hair2', 'eye',
  'p1', 'p2', 'p3', 'p4'
];

const classPalette = palette.map(c => `.${c}`);
const colorRules = getLiveColorRules();
let colorIndex = 0;
let partNameIndex = 1;

function changeColorPicker(color) {
  const label = document.getElementById('colorname');
  const container = document.getElementById('colorform');

  document.getElementById('color').remove();

  const input = document.createElement('input');
  input.setAttribute('id', 'color');
  input.setAttribute('type', 'color');
  input.setAttribute('value', rgb2hex(colorRules[`.${color}`].getPropertyValue('fill')));
  input.addEventListener('input', updateColor(color));
  container.appendChild(input);
  label.textContent = capitalize(color);
}

//const spinner = '<svg class="spinner" viewBox="0 0 124.19042 124.19042"><circle cx="62.09521" cy="62.09521" r="20" /></svg>';

const spinner = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
spinner.classList.add('spinner');
spinner.setAttribute('viewBox', '0 0 124.19042 124.19042');
const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
circle.setAttribute('cx', '62.09521');
circle.setAttribute('cy', '62.09521');
circle.setAttribute('r', '20');
spinner.appendChild(circle);

async function run() {
  // Setup download buttons
  document.getElementById('download-png').addEventListener('click', () => {
    const svg = document.getElementById('avatar').firstElementChild;
    exportPng(svg, 512);
  });

  document.getElementById('download-svg').addEventListener('click', () => {
    const svg = document.getElementById('avatar').firstElementChild;
    exportSvg(svg);
  });

  document.getElementById('permalink').addEventListener('click', async (e) => {
    const permalinkSpinner = spinner.cloneNode(true);
    e.target.replaceWith(permalinkSpinner);

    try {
      const response = await requestServerAvatar();

      await sleep(3000);
      const link = document.createElement('a');
      link.href = response;
      link.textContent = `${window.location.protocol}//${window.location.host}/${response}`;
      permalinkSpinner.replaceWith(link);
    } catch (e) {
      const error = document.createElement('p');
      error.classList.add('error');
      error.textContent = 'permalink failed';
      permalinkSpinner.replaceWith(error);
    }
  });

  // Setup palette buttons: link color inputs to css properties
  const colorpicker = document.getElementById('colorpicker');
  colorpicker.children[0].addEventListener('click', () => {
    colorIndex = colorIndex - 1;
    if (colorIndex < 0) {
      colorIndex = palette.length - 1;
    }
    changeColorPicker(palette[colorIndex]);
  });
  colorpicker.children[2].addEventListener('click', () => {
    colorIndex = (colorIndex + 1) % palette.length;
    changeColorPicker(palette[colorIndex]);
  });
  changeColorPicker(palette[0]);

  // Retrieves parts, builds and displays an avatar

  const avatar = document.getElementById('avatar');
  avatar.replaceChildren(spinner);


  const partsPromise = [];
  for (let partName of partNames) {
    partsPromise.push((async () => {
      const partList = await getPartsList(partName);

      parts[partName] = {
        list: partList,
        index: 0,
        cache: {},
        queue: []
      };

      preloadPart(partName, 0);
      return parts[partName].cache[0];
    })());
  }

  activeParts = await Promise.all(partsPromise);

  const output = svgBuilder(activeParts);
  avatar.replaceChildren(output);

  // Setup hair - backhair sync
  const backhairList = parts['backhair'].list;
  const syncedBackhairList = [];

  const backhairDefault = backhairList[0];
  let i = 0;
  let j = 0;
  let n = 0;

  while (true) {
    if (i < n) {
      syncedBackhairList.push(backhairDefault);
    } else {
      syncedBackhairList.push(backhairList[j]);
      j++;

      if (j >= backhairList.length) {
        n = parts['hair'].list.length;
      } else {
        n = parseInt(backhairList[j].name.substring(9, 13));
      }
    }

    i++;
    if (i >= parts['hair'].list.length) {
      break;
    }
  }

  parts['backhair'].list = syncedBackhairList;

  // Setup part selection
  const partpicker = document.getElementById('partpicker');

  partpicker.children[0].addEventListener('click', () => {
    updatePart(partNames[partNameIndex], -1);
  });

  partpicker.children[2].addEventListener('click', () => {
    updatePart(partNames[partNameIndex], +1);
  });

  partpicker.children[1].addEventListener('change', (e) => {
    partNameIndex = parseInt(e.target.value);
  });

  // Initial content
  for (let i=1; i<partNames.length; i++) {
    const partName = partNames[i];
    partpicker.children[1].children[i - 1].textContent =`${capitalize(partName)} 1 / ${parts[partName].list.length}`;
  }
}

function updateColor(color) {
  // Updates css palette rules to the new color
  return (event) => {
    colorRules[`.${color}`].setProperty('fill', event.target.value);
  }
}

async function updatePart(partName, delta) {
  // Select next or previous part for partName
  const partpicker = document.getElementById('partpicker');

  console.log(partNameIndex, partName)

  const len = parts[partName].list.length;
  let newIndex = parts[partName].index + delta;
  newIndex = newIndex < 0 ? len + newIndex : newIndex >= len ? newIndex - len : newIndex;

  for (let i = newIndex - PRELOAD_SIZE; i <= newIndex + PRELOAD_SIZE; i++) {
    const index = i < 0 ? len + i : i >= len ? i - len : i;
    if (index < 0 || index >= len) {
      continue;
    }

    preloadPart(partName, index);
    
    // Sync backhair with hair
    if (partName == 'hair') {
      const backhairName = parts['backhair'].list[index].name;
      const backhairIndex = parseInt(backhairName.split('_')[1].substring(0, 4));
      preloadPart('backhair', backhairIndex);
    }
  }

  // update part number
  partpicker.children[1].children[partNameIndex - 1].textContent =`${capitalize(partName)} ${newIndex + 1} / ${parts[partName].list.length}`;


  parts[partName].index = newIndex;
  const part = await parts[partName].cache[newIndex]
  activeParts[partNames.indexOf(partName)] = part;

  if (partName == 'hair') {
    parts['backhair'].index = newIndex;
    const backhairName = parts['backhair'].list[newIndex].name;
    const backhairIndex = parseInt(backhairName.split('_')[1].substring(0, 4));
    const part = await parts['backhair'].cache[backhairIndex]
    activeParts[partNames.indexOf('backhair')] = part;
  }

  const output = svgBuilder(activeParts);
  avatar.replaceChildren(output);
}

// Start
window.onload = () => {
  run();
}

