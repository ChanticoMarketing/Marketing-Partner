const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'server', 'routes.ts');
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `    (app as any)[method] = (routePath: any, ...handlers: any[]) => {`;
const replaceStr = `    (app as any)[method] = (routePath: any, ...handlers: any[]) => {
      // Prevent intercepting Express settings lookups
      if (method === "get" && handlers.length === 0) {
        return originalMethod(routePath);
      }`;

if (content.includes(targetStr)) {
    if (!content.includes('handlers.length === 0')) {
        content = content.replace(targetStr, replaceStr);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log("Patched successfully.");
    } else {
        console.log("Already patched.");
    }
} else {
    console.log("Target string not found.");
}
