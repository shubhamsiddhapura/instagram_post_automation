'use strict';

const fs = require('fs');
const path = require('path');

const pkgPath = path.resolve(__dirname, '../node_modules/whatsapp-rust-bridge/package.json');

try {
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    let modified = false;

    if (pkg.exports && pkg.exports['.']) {
      if (!pkg.exports['.']['require']) {
        pkg.exports['.']['require'] = './dist/index.js';
        modified = true;
      }
      if (!pkg.exports['.']['default']) {
        pkg.exports['.']['default'] = './dist/index.js';
        modified = true;
      }
    }

    if (!pkg.main) {
      pkg.main = './dist/index.js';
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4));
      console.log('✅ Successfully patched whatsapp-rust-bridge exports compatibility.');
    }
  }
} catch (err) {
  // Silent fallback
}
