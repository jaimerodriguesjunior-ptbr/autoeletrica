const fs = require('fs');
const path = 'g:/projetos/autoeletrica/app/(admin)/configuracoes/page.tsx';

let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// Line 531 (index 530) - csc_token_production
if (lines[530] && lines[530].includes('type="text"')) {
    lines[530] = lines[530].replace('type="text"', 'type="password"');
    console.log('Line 531 updated');
}

// Line 556 (index 555) - csc_token_homologation
if (lines[555] && lines[555].includes('type="text"')) {
    lines[555] = lines[555].replace('type="text"', 'type="password"');
    console.log('Line 556 updated');
}

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('File saved');
