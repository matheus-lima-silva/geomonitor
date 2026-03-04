import fs from 'fs';
import path from 'path';

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];
    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            arrayOfFiles.push(path.join(dirPath, "/", file));
        }
    });
    return arrayOfFiles;
}

const cssContent = fs.readFileSync('src/styles.css', 'utf-8');

// A basic regex to extract all class selectors: .classname
const classRegex = /\.([a-zA-Z0-9_-]+)/g;
let match;
const allClasses = new Set();
while ((match = classRegex.exec(cssContent)) !== null) {
    allClasses.add(match[1]);
}

console.log('Total unique classes in current CSS (including Tailwind classes / leaflet classes):', allClasses.size);

// Read all JSX and JS files
const files = getAllFiles('src').filter(f => f.endsWith('.jsx') || f.endsWith('.js') || f.endsWith('.html'));

const foundClasses = new Set();
files.forEach(f => {
    const code = fs.readFileSync(f, 'utf-8');
    allClasses.forEach(c => {
        // Check if the class appears literally inside the string of the script
        // We could do regex `\b${c}\b` but indexOf is faster for now
        // Actually, `\b` is better so `btn` doesn't match `btn-success`
        const r = new RegExp(`\\b${c}\\b`);
        if (r.test(code)) {
            foundClasses.add(c);
        }
    });
});

console.log('Classes found in JS/JSX/HTML:', foundClasses.size);

const unusedClasses = [...allClasses].filter(c => !foundClasses.has(c));
console.log('Unused classes count:', unusedClasses.length);
// Print some unused to verify
console.log('Some unused classes:', unusedClasses.slice(0, 50).join(', '));

// Output to a file line by line
fs.writeFileSync('unused_classes.txt', unusedClasses.join('\n'));
