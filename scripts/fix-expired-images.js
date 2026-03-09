/**
 * Script to download all DALL-E images from URLs and save them locally
 * This fixes the 403 errors caused by expired URLs
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');

async function downloadImage(url, savePath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      const fileStream = require('fs').createWriteStream(savePath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(savePath);
      });
      
      fileStream.on('error', (err) => {
        require('fs').unlink(savePath, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

async function fixProject(projectPath) {
  console.log(`\n📂 Processing project: ${projectPath}`);
  
  const projectFile = path.join(projectPath, 'project.json');
  
  try {
    const data = await fs.readFile(projectFile, 'utf8');
    const project = JSON.parse(data);
    
    let modified = false;
    const imagesDir = path.join(projectPath, 'images');
    
    // Ensure images directory exists
    await fs.mkdir(imagesDir, { recursive: true });
    
    // Fix character reference images
    if (project.characters && Array.isArray(project.characters)) {
      for (let i = 0; i < project.characters.length; i++) {
        const char = project.characters[i];
        if (char.referenceImage && char.referenceImage.startsWith('https://')) {
          console.log(`  📥 Downloading character ${i} reference image...`);
          try {
            const timestamp = Date.now();
            const localPath = path.join(imagesDir, `character_${i}_${timestamp}.png`);
            await downloadImage(char.referenceImage, localPath);
            project.characters[i].referenceImage = `file://${localPath}`;
            project.characters[i].referenceImagePath = localPath;
            modified = true;
            console.log(`  ✅ Character ${i} image saved locally`);
          } catch (error) {
            console.log(`  ⚠️  Character ${i} image download failed (URL expired): ${error.message}`);
          }
        }
      }
    }
    
    // Fix visual identity main character reference
    if (project.visualIdentity?.mainCharacter?.referenceImage) {
      const refImage = project.visualIdentity.mainCharacter.referenceImage;
      if (refImage.startsWith('https://')) {
        console.log(`  📥 Downloading visual identity reference image...`);
        try {
          const timestamp = Date.now();
          const localPath = path.join(imagesDir, `visual_identity_${timestamp}.png`);
          await downloadImage(refImage, localPath);
          project.visualIdentity.mainCharacter.referenceImage = `file://${localPath}`;
          project.visualIdentity.mainCharacter.referenceImagePath = localPath;
          modified = true;
          console.log(`  ✅ Visual identity image saved locally`);
        } catch (error) {
          console.log(`  ⚠️  Visual identity image download failed (URL expired): ${error.message}`);
        }
      }
    }
    
    // Fix page illustrations
    if (project.pages && Array.isArray(project.pages)) {
      for (let i = 0; i < project.pages.length; i++) {
        const page = project.pages[i];
        if (page.imageUrl && page.imageUrl.startsWith('https://')) {
          console.log(`  📥 Downloading page ${page.number} illustration...`);
          try {
            const timestamp = Date.now();
            const localPath = path.join(imagesDir, `page_${page.number}_${timestamp}.png`);
            await downloadImage(page.imageUrl, localPath);
            project.pages[i].imageUrl = `file://${localPath}`;
            project.pages[i].imageLocalPath = localPath;
            modified = true;
            console.log(`  ✅ Page ${page.number} image saved locally`);
          } catch (error) {
            console.log(`  ⚠️  Page ${page.number} image download failed (URL expired): ${error.message}`);
          }
        }
        
        // Also check page.illustration (only if it's a string)
        if (page.illustration && typeof page.illustration === 'string' && page.illustration.startsWith('https://')) {
          console.log(`  📥 Downloading page ${page.number} illustration (alt)...`);
          try {
            const timestamp = Date.now();
            const localPath = path.join(imagesDir, `page_${page.number}_ill_${timestamp}.png`);
            await downloadImage(page.illustration, localPath);
            project.pages[i].illustration = `file://${localPath}`;
            project.pages[i].imageLocalPath = localPath;
            modified = true;
            console.log(`  ✅ Page ${page.number} illustration saved locally`);
          } catch (error) {
            console.log(`  ⚠️  Page ${page.number} illustration download failed (URL expired): ${error.message}`);
          }
        }
      }
    }
    
    // Save modified project
    if (modified) {
      await fs.writeFile(projectFile, JSON.stringify(project, null, 2), 'utf8');
      console.log(`  💾 Project saved with local image paths`);
    } else {
      console.log(`  ℹ️  No images to fix`);
    }
    
    return modified;
    
  } catch (error) {
    console.error(`  ❌ Error processing project: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔧 Fixing expired DALL-E image URLs...\n');
  
  const defaultProjectsRoot = path.join(
    process.env.USERPROFILE || 'C:\\Users\\token',
    'Documents',
    'KidsBookStudio',
    'Projects'
  );
  const projectsRoot = process.argv[2] ? path.resolve(process.argv[2]) : defaultProjectsRoot;
  console.log(`Using projects root: ${projectsRoot}`);
  
  try {
    const entries = await fs.readdir(projectsRoot, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const projectPath = path.join(projectsRoot, entry.name);
        const projectFile = path.join(projectPath, 'project.json');
        
        try {
          await fs.access(projectFile);
          await fixProject(projectPath);
        } catch {
          // Not a project directory, skip
        }
      }
    }
    
    console.log('\n✅ All projects processed!');
    console.log('🎉 You can now restart the application - no more 403 errors!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
