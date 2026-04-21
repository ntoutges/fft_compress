const { dft } = require("./dist/fourier.js");

const points = 5000;

const x = [];
for (let t = 0; t < points; t++) {
    x.push(3 * Math.cos(2 * Math.PI * t * (2 / points)));
}

console.time("DFT");
const y = dft(x);
console.timeEnd("DFT");
