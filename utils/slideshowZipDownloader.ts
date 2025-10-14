import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface Slideshow {
  id: string;
  images: string[];
  name?: string;
}

export async function downloadSlideshowsAsZip(slideshows: Slideshow[]) {
  const zip = new JSZip();
  
  // Process each slideshow - un seul niveau de dossier
  for (let i = 0; i < slideshows.length; i++) {
    const slideshow = slideshows[i];
    const folderName = `Slideshow ${i + 1}`;
    const slideshowFolder = zip.folder(folderName);
    
    if (!slideshowFolder) {
      console.error(`Failed to create folder for slideshow ${i + 1}`);
      continue;
    }
    
    // Download and add each image directly to the slideshow folder
    for (let j = 0; j < slideshow.images.length; j++) {
      const imageUrl = slideshow.images[j];
      const imageName = `part_${j + 1}.png`;
      
      try {
        // Fetch the image
        const response = await fetch(imageUrl);
        if (!response.ok) {
          console.error(`Failed to download image: ${imageUrl}`);
          continue;
        }
        
        const blob = await response.blob();
        slideshowFolder.file(imageName, blob);
      } catch (error) {
        console.error(`Error downloading image ${imageUrl}:`, error);
      }
    }
  }
  
  // Generate and download the ZIP file
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `Slideshows.zip`);
}

export async function downloadSingleSlideshow(slideshow: Slideshow) {
  const zip = new JSZip();
  
  // Create folder for this slideshow - format simplifié
  const timestamp = new Date().toLocaleString('en-US', { 
    month: 'numeric', 
    day: 'numeric', 
    year: 'numeric', 
    hour: 'numeric', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: true 
  }).replace(/[,]/g, '');
  const folderName = `Slideshow ${timestamp}`;
  const slideshowFolder = zip.folder(folderName);
  
  if (!slideshowFolder) {
    throw new Error('Failed to create slideshow folder');
  }
  
  // Download and add each image directly
  for (let i = 0; i < slideshow.images.length; i++) {
    const imageUrl = slideshow.images[i];
    const imageName = `part_${i + 1}.png`;
    
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.error(`Failed to download image: ${imageUrl}`);
        continue;
      }
      
      const blob = await response.blob();
      slideshowFolder.file(imageName, blob);
    } catch (error) {
      console.error(`Error downloading image ${imageUrl}:`, error);
    }
  }
  
  // Generate and download the ZIP file
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `Slideshow.zip`);
}