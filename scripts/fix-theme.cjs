const fs = require('fs');
const path = require('path');

const clientSrcDir = path.join(__dirname, '..', 'client', 'src');

const replacements = [
  // Typography & Borders
  { regex: /\btext-white\b/g, replacement: 'text-foreground' },
  { regex: /\btext-gray-(300|400|500)\b/g, replacement: 'text-muted-foreground' },
  { regex: /\bborder-white\/(5|10|20)\b/g, replacement: 'border-border' },
  
  // Custom Shadows / Glows
  { regex: /shadow-\[0_0_[^\] ]+rgba\(var\(--primary\)[^\] ]+\]/g, replacement: 'shadow-md' },
  
  // THE BIG SWAP: Amber/Orange to Indigo/Slate
  { regex: /\bamber-500\b/g, replacement: 'primary' },
  { regex: /\borange-500\b/g, replacement: 'primary' },
  { regex: /\bamber-600\b/g, replacement: 'primary/90' },
  { regex: /\borange-600\b/g, replacement: 'primary/90' },
  { regex: /\bamber-400\b/g, replacement: 'primary/80' },
  { regex: /\borange-400\b/g, replacement: 'primary/80' },
  
  // Specific Badge/Highlight Patterns
  { regex: /\bbg-orange-500\/10\b/g, replacement: 'bg-primary/10' },
  { regex: /\bbg-amber-500\/10\b/g, replacement: 'bg-primary/10' },
  { regex: /\bbg-orange-500\/20\b/g, replacement: 'bg-primary/20' },
  { regex: /\bbg-amber-500\/20\b/g, replacement: 'bg-primary/20' },
  { regex: /\btext-orange-500\b/g, replacement: 'text-primary' },
  { regex: /\btext-amber-500\b/g, replacement: 'text-primary' },
  { regex: /\btext-orange-400\b/g, replacement: 'text-primary/90' },
  { regex: /\btext-amber-400\b/g, replacement: 'text-primary/90' },
  
  // Border cleaning
  { regex: /\bborder-orange-500\/20\b/g, replacement: 'border-border' },
  { regex: /\bborder-amber-500\/20\b/g, replacement: 'border-border' },
  { regex: /\bborder-amber-300\b/g, replacement: 'border-primary/30' },
  { regex: /\bborder-orange-300\b/g, replacement: 'border-primary/30' },

  // Hardcoded dark mode overrides
  { regex: /\bdark:bg-\[#1e293b\]\b/g, replacement: 'dark:bg-muted/50' },
  { regex: /\bdark:bg-\[#[a-fA-F0-9]{3,6}\]\b/g, replacement: '' },
  
  // Button text color normalization
  { regex: /\bbg-primary\b([^>]*)\btext-black\b/g, replacement: 'bg-primary$1text-primary-foreground' },
  
  // Tech-border and glass-panel removals
  { regex: /\bglass-panel-dark\b/g, replacement: 'bg-card border-border' },
  { regex: /\btech-border\b/g, replacement: 'border-border' }
];

function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (stat.isFile() && (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts'))) {
      processFile(fullPath);
    }
  }
}

function processFile(filePath) {
  if (filePath.endsWith('index.css')) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  for (const repl of replacements) {
    content = content.replace(repl.regex, repl.replacement);
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Minimalized: ${filePath.replace(clientSrcDir, '')}`);
  }
}

console.log('Deep cleaning UI for Minimalist Slate theme...');
processDirectory(clientSrcDir);
console.log('Deep clean complete.');
