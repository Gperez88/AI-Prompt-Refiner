const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src/templates');
const destDir = path.join(__dirname, '../dist/templates');

// Ensure destination directory exists
if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

// Copy files recursively
function copyRecursive(src, dest) {
    const stats = fs.statSync(src);
    
    if (stats.isDirectory()) {
        // Create destination directory if it doesn't exist
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        
        // Process directory contents
        fs.readdirSync(src).forEach(file => {
            const srcPath = path.join(src, file);
            const destPath = path.join(dest, file);
            copyRecursive(srcPath, destPath);
        });
    } else if (path.extname(src) === '.md') {
        // Copy .md files
        fs.copyFileSync(src, dest);
        const relativePath = path.relative(destDir, dest);
        console.log(`Copied ${relativePath} to dist/templates/`);
    }
}

copyRecursive(srcDir, destDir);
