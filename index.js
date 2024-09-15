#!/usr/bin/env node
/*
- npm so can easily use from rapidresizer-lambda doc generation -- or some other way to use in lambda npm run docs so can get with latest version of api; rm the tests folder; RS github account; follow github book to do commits, public repo, npm -- link to it from rs.ca -- ad for rr
- README: todo: max-depth option, couldn't get clockwise alphabetical -- though the counterlcokwise looks good for branches below a node, goes left to right
*/

import commandLineArgs from 'command-line-args';
const commandLineOptions = [
    { name: 'src', type: String, description: "Input OpenAPI JSON file (default option = 'openapi.json')", defaultValue: 'openapi.json', defaultOption: true }, // stupid command-line-usage doesn't automatically show that it's the defaultOption and has a defaultValue
    { name: 'bw', alias: 'b', description: "Output in black & white instead of color", type: Boolean },
    { name: 'help', alias: 'h', type: Boolean },
];
const options = commandLineArgs(commandLineOptions);
// console.dir(options);

import commandLineUsage from 'command-line-usage';
const commandLineUsageSections = [
    {
      header: 'openapi-visualizer',
      content: 'Creates a graph (openapi.png) from an OpenAPI JSON file.'
    },
    {
      header: 'Options',
      optionList: commandLineOptions
    }
];
const usage = commandLineUsage(commandLineUsageSections);

if (options.help) {
    console.log(usage);
    process.exit();
}

import graphviz from 'graphviz';

const path = options.src;//process.argv[2] || 'openapi.json';
import { readFile } from 'fs/promises';
let json;
try {
    json = await readFile(path);
} catch (e) {
    console.log(e);
    process.exit(1);
}
const openapi = JSON.parse(json);
const routes = Object.keys(openapi.paths); // "/ai/upscaled/:imageId", ...

function parseRoute(route) {
    return route.split('/').slice(1);
}

const font = 'Lato';

class Node {
    constructor(route='/', methods=[], branches={}) {
        this.name = parseRoute(route).at(-1);
        this.route = route;
        this.methods = methods;
        this.branches = branches;
    }
}
const tree = new Node();
const g = graphviz.digraph(); //openapi.info.title); -- title would break neato

for (const route of routes) {
    const parts = parseRoute(route);
    let node = tree;
    const partsAcc = [];
    for (const part of parts) {
        partsAcc.push(part);
        // console.log(partsAcc)
        if (!node.branches[part]) {
            node.branches[part] = new Node(`/${partsAcc.join('/')}`);
        }
        node = node.branches[part];
    }
    node.methods = Object.keys(openapi.paths[route]).map(method => method.toUpperCase());
}
// console.dir(tree, {depth: null});

function addNodes(apiNode, graphNode, branchColor=null) {
    // for (const apiBranch of Object.values(apiNode.branches)) {
    const branchNames = Object.keys(apiNode.branches).sort()/*.reverse()*/;
    // let i = 0;
    for (const branchName of branchNames) {
        // console.log(branchName)
        const apiBranch = apiNode.branches[branchName];
        const child = g.addNode(apiBranch.route);
        // const color = branchColor ?? `${i++ / branchNames.length} 1 0.8`;
        const color = options.bw ? 'black' : (branchColor ?? `${Math.random()} 1 0.8`); // better because adjacent branches will tend to have contrasting colors
        let name = apiBranch.name;
        if (name[0] === '{') { // italicizes the name if it's a path paramater
            name = name.replace(/[{}]/g, '');
            name = `<i>${name}</i>`;
        }
        let label;
        if (apiBranch.methods.length) {
            label = `!<table cellpadding="0" cellspacing="0">
                <tr><td><font color="${color}">${name}</font></td></tr>
                <tr><td><font point-size="11" color="darkgray">${apiBranch.methods.sort().join(' ')}</font></td></tr>
            </table>`; // graphviz doesn't like extra whitespace/newlines in table cells
        } else {
            label = `!<font color="${color}">${name}</font>`;
        }
        child.set("label", label);
        // ? use table to fix spacing above http methods? (when point-size!=14[default])
        child.set('shape', 'box'); // plaintext -- plain/plaintext shape would cause edges to get too close to the node label
        child.set('color', 'transparent');
        child.set('width', 0); // otherwise there's a minimum width
        child.set('margin', 0.05); // only applies if shape isnt' plain*, i think
        child.set('fontname', font);
        const edge = g.addEdge(graphNode, child);
        edge.set('arrowhead', 'none');
        edge.set('color', color);
        addNodes(apiBranch, child, color);
    }
}
// function addNodes(queue) {
//     while (queue.length) {
//         const [apiNode, graphNode] = queue.shift();
//         for (const branchName of Object.keys(apiNode.branches).sort()/*.reverse()*/) {
//             // console.log(branchName)
//             const apiBranch = apiNode.branches[branchName];
//             const child = g.addNode(apiBranch.route);
//             let name = apiBranch.name;
//             if (name[0] === '{') {
//                 name = name.replace(/[{}]/g, '');
//                 name = `<i>${name}</i>`;
//             }
//             let label = `!${name}`;
//             if (apiBranch.methods.length) {
//                 label += `<br /><font point-size="14" color="darkgray">${apiBranch.methods.sort().join(' ')}</font>`;
//             }
//             child.set("label", label);
//             // ? use table to fix spacing above http methods? (when point-size!=14[default])
//             child.set('shape', 'box'); // plaintext -- plain/plaintext shape would cause edges to get too close to the node label
//             child.set('color', 'transparent');
//             child.set('width', 0); // otherwise there's a minimum width
//             child.set('margin', 0.05); // only applies if shape isnt' plain*, i think
//             child.set('fontname', font);
//             const edge = g.addEdge(graphNode, child);
//             edge.set('arrowhead', 'none');
//             queue.push([apiBranch, child]);
//         }
//     }
// }

const graphNode = g.addNode('root', {
    'label': `!<b>${openapi.info.title}</b>`,
    'shape': 'box',
    'color': 'transparent',
    'fontname': 'Lato',
});
addNodes(tree, graphNode);
// addNodes([[tree, graphNode]]);

// console.log(g.to_dot())
g.output(
    {
        type: "png",
        use: 'twopi',
        // use: 'fdp',
        // use: 'sfdp',
        // use: 'neato',
        G: {
            dpi: 300,
            overlap: false,
            // overlap_scaling: 5
            // ordering: out -- doesn't work on twopi
        }
    },
    "openapi.png",
    (code, out, err) => console.log(code, out, err)
);
// g.output("svg", "output.svg");
// g.output("pdf", "test.pdf");