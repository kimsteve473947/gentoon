import sharp from 'sharp';

interface ServerResizeOptions {
  width: number;
  height: number;
  mode?: 'fit' | 'fill' | 'cover' | 'contain';
  background?: { r: number; g: number; b: number; alpha?: number };
}

export async function resizeImageBuffer(
  imageBuffer: Buffer,
  options: ServerResizeOptions
): Promise<Buffer> {
  try {
    const { width, height, mode = 'cover', background = { r: 255, g: 255, b: 255, alpha: 1 } } = options;
    
    let sharpInstance = sharp(imageBuffer);
    
    switch (mode) {
      case 'cover':
        sharpInstance = sharpInstance.resize(width, height, {
          fit: 'cover',
          position: 'center'
        });
        break;
      case 'contain':
        sharpInstance = sharpInstance.resize(width, height, {
          fit: 'contain',
          background
        });
        break;
      case 'fill':
        sharpInstance = sharpInstance.resize(width, height, {
          fit: 'fill'
        });
        break;
      case 'fit':
      default:
        sharpInstance = sharpInstance.resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        });
        break;
    }
    
    return await sharpInstance
      .png({ quality: 90 })
      .toBuffer();
  } catch (error) {
    console.error('Server image resize error:', error);
    throw error;
  }
}

export async function fetchAndResizeImage(
  imageUrl: string,
  options: ServerResizeOptions
): Promise<Buffer> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    return await resizeImageBuffer(imageBuffer, options);
  } catch (error) {
    console.error('Fetch and resize error:', error);
    throw error;
  }
}