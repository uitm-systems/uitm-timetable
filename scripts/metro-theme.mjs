import fs from 'fs';
import path from 'path';

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

walk('web/src', (filePath) => {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Metro UI characteristic 1: No rounded corners
  content = content.replace(/\brounded-(none|sm|md|lg|xl|2xl|3xl|full)\b/g, 'rounded-none');
  
  // Metro UI characteristic 2: No drop shadows or soft shadows
  content = content.replace(/\bshadow(-sm|-md|-lg|-xl|-2xl|-inner|-none)?\b/g, '');
  content = content.replace(/\bdrop-shadow(-sm|-md|-lg|-xl|-2xl|-none)?\b/g, '');

  // Metro UI characteristic 3: Flat backgrounds, no gradients
  if (filePath.includes('page.tsx')) {
    content = content.replace(
      /bg-gradient-to-br from-[^'"]+/g,
      'bg-gray-100 dark:bg-[#1d1d1d]'
    );
  }

  // Make borders sharper and more distinct (Metro style tiles)
  content = content.replace(/border-slate-200/g, 'border-gray-300');
  content = content.replace(/border-slate-700/g, 'border-gray-600');
  content = content.replace(/border-slate-800/g, 'border-gray-600');
  
  // Button style: bold hover states
  content = content.replace(/hover:bg-purple-700/g, 'hover:bg-purple-800');

  fs.writeFileSync(filePath, content, 'utf8');
});

console.log('Metro UI styles applied to all components.');
