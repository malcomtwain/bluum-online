import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface HookStyle {
  type: number;
  position: 'top' | 'middle' | 'bottom';
  offset: number;
}

export function drawHookText(
  ctx: any,
  text: string,
  style: HookStyle,
  canvasWidth: number = 1080,
  canvasHeight: number = 1920,
  fontName: string = "TikTok Display Medium",
  fontSizeMultiplier: number = 1.0,
  transparentBackground: boolean = false,
  template: string = 'default'
) {
  console.log("drawHookText called with style type:", style.type);
  console.log("drawHookText called with position:", style.position);
  console.log("drawHookText called with offset:", style.offset);
  console.log("drawHookText called with fontName:", fontName);
  console.log("drawHookText called with fontSizeMultiplier:", fontSizeMultiplier);
  
  // Calculate text position
  const x = canvasWidth / 2;
  let y = style.position === 'top' ? canvasHeight * 0.12 : 
          style.position === 'middle' ? canvasHeight * 0.47 : 
          canvasHeight * 0.72;
  
  // Apply offset
  y += (style.offset / 50) * (canvasHeight * 0.1);

  // Set text alignment
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Calculate font size (text-2xl equivalent) - reduce for styles 1 and 4
  let fontSize = Math.floor(canvasWidth * 0.06 * fontSizeMultiplier);
  if (style.type === 1 || style.type === 4) {
    // Reduce font size for styles 1 and 4 to match API (50px for 1080px canvas)
    fontSize = Math.floor(canvasWidth * 0.046 * fontSizeMultiplier); // 50/1080 ≈ 0.046
  }

  // Set font
  ctx.font = `${fontSize}px "${fontName}", "Apple Color Emoji"`;

  // Function to wrap text
  function wrapText(text: string, maxWidth: number, style: HookStyle) {
    // Function to split long words
    function splitLongWord(word: string): string[] {
      const maxChars = 12;
      const parts: string[] = [];
      let currentPart = '';
      
      for (let i = 0; i < word.length; i++) {
        currentPart += word[i];
        if (currentPart.length === maxChars || i === word.length - 1) {
          parts.push(currentPart);
          currentPart = '';
        }
      }
      
      return parts;
    }

    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    let currentWidth = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // Split long words
      const wordParts = word.length > 12 ? splitLongWord(word) : [word];
      
      for (let j = 0; j < wordParts.length; j++) {
        const part = wordParts[j];
        const wordWidth = ctx.measureText(part + ' ').width;
        
        if (currentLine === '') {
          // First word of the line
          currentLine = part;
          currentWidth = ctx.measureText(part).width;
        } else {
          // Try to add the word to the current line
          const lineWithWord = currentLine + ' ' + part;
          const newWidth = ctx.measureText(lineWithWord).width;
          
          if (newWidth <= maxWidth) {
            // Before adding the word, check if this would make lines too similar in width
            if (style.type === 2 && lines.length > 0) {
              const prevLineWidth = ctx.measureText(lines[lines.length - 1]).width;
              // If adding this word would make lines too similar, force a line break
              if (Math.abs(prevLineWidth - newWidth) < 50) {
                lines.push(currentLine);
                currentLine = part;
                currentWidth = wordWidth;
                continue;
              }
            }
            
            currentLine = lineWithWord;
            currentWidth = newWidth;
          } else {
            // Word doesn't fit, start new line
            lines.push(currentLine);
            currentLine = part;
            currentWidth = wordWidth;
          }
        }
      }
    }
    
    // Add the last line
    if (currentLine !== '') {
      lines.push(currentLine);
    }

    return lines;
  }

  if (style.type === 2) {
    // Style 2: Modern white background with black text
    ctx.font = `600 ${fontSize}px "${fontName}", "Apple Color Emoji"`;
    
    // Calculate max width (85% of canvas width for better word wrapping)
    const maxWidth = canvasWidth * 0.85;
    const lines = wrapText(text, maxWidth, style);
    
    // Calculate dimensions for each line
    const horizontalPadding = 32;
    const verticalPadding = 5;
    const lineHeight = fontSize * 1.2;
    const totalHeight = lineHeight * lines.length;

    // Function to draw adaptive background for each line
    function drawAdaptiveBackground(text: string, x: number, y: number, index: number, totalLines: number, allLines: string[]) {
      const metrics = ctx.measureText(text);
      const textWidth = metrics.width;
      const width = textWidth + (horizontalPadding * 2);
      const height = lineHeight + (
        index === 0 || index === totalLines - 1 ? verticalPadding * 2 : 0
      );
      
      const bgX = x - (width / 2);
      const bgY = y - (height / 2) - (
        index === 0 ? verticalPadding : 
        index === totalLines - 1 ? -verticalPadding : 0
      );
      
      const prevLineWidth = index > 0 ? ctx.measureText(allLines[index - 1]).width + (horizontalPadding * 2) : 0;
      const nextLineWidth = index < totalLines - 1 ? ctx.measureText(allLines[index + 1]).width + (horizontalPadding * 2) : 0;
      
      const borderRadius = 18;
      const cornerOffset = 18;

      ctx.save();
      ctx.beginPath();

      if (index === 0) {
        // First line
        ctx.moveTo(bgX + borderRadius, bgY);
        ctx.lineTo(bgX + width - borderRadius, bgY);
        ctx.quadraticCurveTo(bgX + width, bgY, bgX + width, bgY + borderRadius);
        
        if (nextLineWidth > width) {
          ctx.lineTo(bgX + width, bgY + height - cornerOffset);
          ctx.quadraticCurveTo(bgX + width, bgY + height, bgX + width + cornerOffset, bgY + height);
        } else {
          ctx.lineTo(bgX + width, bgY + height - cornerOffset);
          ctx.quadraticCurveTo(bgX + width, bgY + height, bgX + width - cornerOffset, bgY + height);
        }
        
        if (nextLineWidth > width) {
          ctx.lineTo(bgX - cornerOffset, bgY + height);
          ctx.quadraticCurveTo(bgX, bgY + height, bgX, bgY + height - cornerOffset);
        } else {
          ctx.lineTo(bgX + cornerOffset, bgY + height);
          ctx.quadraticCurveTo(bgX, bgY + height, bgX, bgY + height - cornerOffset);
        }
        
        ctx.lineTo(bgX, bgY + borderRadius);
        ctx.quadraticCurveTo(bgX, bgY, bgX + borderRadius, bgY);
      } else if (index === totalLines - 1) {
        // Last line
        if (prevLineWidth > width) {
          ctx.moveTo(bgX - cornerOffset, bgY);
          ctx.quadraticCurveTo(bgX, bgY, bgX, bgY + cornerOffset);
        } else {
          ctx.moveTo(bgX + cornerOffset, bgY);
          ctx.quadraticCurveTo(bgX, bgY, bgX, bgY + cornerOffset);
        }
        
        ctx.lineTo(bgX, bgY + height - borderRadius);
        ctx.quadraticCurveTo(bgX, bgY + height, bgX + borderRadius, bgY + height);
        ctx.lineTo(bgX + width - borderRadius, bgY + height);
        ctx.quadraticCurveTo(bgX + width, bgY + height, bgX + width, bgY + height - borderRadius);
        
        if (prevLineWidth > width) {
          ctx.lineTo(bgX + width, bgY + cornerOffset);
          ctx.quadraticCurveTo(bgX + width, bgY, bgX + width + cornerOffset, bgY);
        } else {
          ctx.lineTo(bgX + width, bgY + cornerOffset);
          ctx.quadraticCurveTo(bgX + width, bgY, bgX + width - cornerOffset, bgY);
        }
      } else {
        // Middle lines
        if (prevLineWidth > width) {
          ctx.moveTo(bgX - cornerOffset, bgY);
          ctx.quadraticCurveTo(bgX, bgY, bgX, bgY + cornerOffset);
        } else {
          ctx.moveTo(bgX + cornerOffset, bgY);
          ctx.quadraticCurveTo(bgX, bgY, bgX, bgY + cornerOffset);
        }
        
        ctx.lineTo(bgX, bgY + height - cornerOffset);
        
        if (nextLineWidth > width) {
          ctx.quadraticCurveTo(bgX, bgY + height, bgX - cornerOffset, bgY + height);
        } else {
          ctx.quadraticCurveTo(bgX, bgY + height, bgX + cornerOffset, bgY + height);
        }
        
        if (nextLineWidth > width) {
          ctx.lineTo(bgX + width + cornerOffset, bgY + height);
          ctx.quadraticCurveTo(bgX + width, bgY + height, bgX + width, bgY + height - cornerOffset);
        } else {
          ctx.lineTo(bgX + width - cornerOffset, bgY + height);
          ctx.quadraticCurveTo(bgX + width, bgY + height, bgX + width, bgY + height - cornerOffset);
        }
        
        ctx.lineTo(bgX + width, bgY + cornerOffset);
        
        if (prevLineWidth > width) {
          ctx.quadraticCurveTo(bgX + width, bgY, bgX + width + cornerOffset, bgY);
        } else {
          ctx.quadraticCurveTo(bgX + width, bgY, bgX + width - cornerOffset, bgY);
        }
      }

      ctx.closePath();
      
      // Add shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1.8;
      
      // White background
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.restore();
    }

    // Draw background and text for each line
    lines.forEach((line, index) => {
      const lineY = y - (totalHeight / 2) + (index * lineHeight) + (lineHeight / 2);
      
      // Draw adaptive background for this line (skip if transparent)
      if (!transparentBackground) {
        drawAdaptiveBackground(line, x, lineY, index, lines.length, lines);
      }
      
      // Draw text
      ctx.fillStyle = '#000000';
      ctx.textBaseline = "middle";
      ctx.fillText(line, x, lineY);
    });
  } else if (style.type === 3) {
    // Style 3: Modern black background with white text
    ctx.font = `600 ${fontSize}px "${fontName}", "Apple Color Emoji"`;
    
    // Calculate max width (85% of canvas width for better word wrapping)
    const maxWidth = canvasWidth * 0.85;
    const lines = wrapText(text, maxWidth, style);
    
    // Calculate dimensions for each line
    const horizontalPadding = 32;
    const verticalPadding = 5;
    const lineHeight = fontSize * 1.2;
    const totalHeight = lineHeight * lines.length;

    // Function to draw adaptive background for each line (same as style 2 but with black background)
    function drawAdaptiveBackground(text: string, x: number, y: number, index: number, totalLines: number, allLines: string[]) {
      const metrics = ctx.measureText(text);
      const textWidth = metrics.width;
      const width = textWidth + (horizontalPadding * 2);
      const height = lineHeight + (
        index === 0 || index === totalLines - 1 ? verticalPadding * 2 : 0
      );
      
      const bgX = x - (width / 2);
      const bgY = y - (height / 2) - (
        index === 0 ? verticalPadding : 
        index === totalLines - 1 ? -verticalPadding : 0
      );
      
      const prevLineWidth = index > 0 ? ctx.measureText(allLines[index - 1]).width + (horizontalPadding * 2) : 0;
      const nextLineWidth = index < totalLines - 1 ? ctx.measureText(allLines[index + 1]).width + (horizontalPadding * 2) : 0;
      
      const borderRadius = 18;
      const cornerOffset = 18;

      ctx.save();
      ctx.beginPath();

      if (index === 0) {
        // First line
        ctx.moveTo(bgX + borderRadius, bgY);
        ctx.lineTo(bgX + width - borderRadius, bgY);
        ctx.quadraticCurveTo(bgX + width, bgY, bgX + width, bgY + borderRadius);
        
        if (nextLineWidth > width) {
          ctx.lineTo(bgX + width, bgY + height - cornerOffset);
          ctx.quadraticCurveTo(bgX + width, bgY + height, bgX + width + cornerOffset, bgY + height);
        } else {
          ctx.lineTo(bgX + width, bgY + height - cornerOffset);
          ctx.quadraticCurveTo(bgX + width, bgY + height, bgX + width - cornerOffset, bgY + height);
        }
        
        if (nextLineWidth > width) {
          ctx.lineTo(bgX - cornerOffset, bgY + height);
          ctx.quadraticCurveTo(bgX, bgY + height, bgX, bgY + height - cornerOffset);
        } else {
          ctx.lineTo(bgX + cornerOffset, bgY + height);
          ctx.quadraticCurveTo(bgX, bgY + height, bgX, bgY + height - cornerOffset);
        }
        
        ctx.lineTo(bgX, bgY + borderRadius);
        ctx.quadraticCurveTo(bgX, bgY, bgX + borderRadius, bgY);
      } else if (index === totalLines - 1) {
        // Last line
        if (prevLineWidth > width) {
          ctx.moveTo(bgX - cornerOffset, bgY);
          ctx.quadraticCurveTo(bgX, bgY, bgX, bgY + cornerOffset);
        } else {
          ctx.moveTo(bgX + cornerOffset, bgY);
          ctx.quadraticCurveTo(bgX, bgY, bgX, bgY + cornerOffset);
        }
        
        ctx.lineTo(bgX, bgY + height - borderRadius);
        ctx.quadraticCurveTo(bgX, bgY + height, bgX + borderRadius, bgY + height);
        ctx.lineTo(bgX + width - borderRadius, bgY + height);
        ctx.quadraticCurveTo(bgX + width, bgY + height, bgX + width, bgY + height - borderRadius);
        
        if (prevLineWidth > width) {
          ctx.lineTo(bgX + width, bgY + cornerOffset);
          ctx.quadraticCurveTo(bgX + width, bgY, bgX + width + cornerOffset, bgY);
        } else {
          ctx.lineTo(bgX + width, bgY + cornerOffset);
          ctx.quadraticCurveTo(bgX + width, bgY, bgX + width - cornerOffset, bgY);
        }
      } else {
        // Middle lines
        if (prevLineWidth > width) {
          ctx.moveTo(bgX - cornerOffset, bgY);
          ctx.quadraticCurveTo(bgX, bgY, bgX, bgY + cornerOffset);
        } else {
          ctx.moveTo(bgX + cornerOffset, bgY);
          ctx.quadraticCurveTo(bgX, bgY, bgX, bgY + cornerOffset);
        }
        
        ctx.lineTo(bgX, bgY + height - cornerOffset);
        
        if (nextLineWidth > width) {
          ctx.quadraticCurveTo(bgX, bgY + height, bgX - cornerOffset, bgY + height);
        } else {
          ctx.quadraticCurveTo(bgX, bgY + height, bgX + cornerOffset, bgY + height);
        }
        
        if (nextLineWidth > width) {
          ctx.lineTo(bgX + width + cornerOffset, bgY + height);
          ctx.quadraticCurveTo(bgX + width, bgY + height, bgX + width, bgY + height - cornerOffset);
        } else {
          ctx.lineTo(bgX + width - cornerOffset, bgY + height);
          ctx.quadraticCurveTo(bgX + width, bgY + height, bgX + width, bgY + height - cornerOffset);
        }
        
        ctx.lineTo(bgX + width, bgY + cornerOffset);
        
        if (prevLineWidth > width) {
          ctx.quadraticCurveTo(bgX + width, bgY, bgX + width + cornerOffset, bgY);
        } else {
          ctx.quadraticCurveTo(bgX + width, bgY, bgX + width - cornerOffset, bgY);
        }
      }

      ctx.closePath();
      
      // Add shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1.8;
      
      // Black background
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.restore();
    }

    // Draw background and text for each line
    lines.forEach((line, index) => {
      const lineY = y - (totalHeight / 2) + (index * lineHeight) + (lineHeight / 2);
      
      // Draw adaptive background for this line (skip if transparent)
      if (!transparentBackground) {
        drawAdaptiveBackground(line, x, lineY, index, lines.length, lines);
      }
      
      // Draw text in white
      ctx.fillStyle = '#FFFFFF';
      ctx.textBaseline = "middle";
      ctx.fillText(line, x, lineY);
    });
  } else if (style.type === 4) {
    // Style 4: White text without outline (Normal New) - or transparent with outline for 2000 template

    // Use larger font size for 2000 template
    if (template === '2000') {
      fontSize = Math.floor(canvasWidth * 0.116 * fontSizeMultiplier); // 125/1080 ≈ 0.116
    }

    ctx.font = `${fontSize}px "${fontName}", "Apple Color Emoji"`;
    ctx.letterSpacing = '0.001em';
    ctx.textBaseline = 'middle';

    // Calculate max width (95% of canvas width for more chars per line)
    const maxWidth = canvasWidth * 0.95;
    const lines = wrapText(text, maxWidth, style);
    const lineHeight = fontSize * 1.2;
    const totalHeight = lineHeight * lines.length;

    // Draw each line
    lines.forEach((line, index) => {
      const lineY = y - (totalHeight / 2) + (index * lineHeight) + (lineHeight / 2);

      if (template === '2000') {
        // For 2000 template: difference blend mode effect (no border)
        // Apply difference blend mode for the text
        ctx.save();
        ctx.globalCompositeOperation = 'difference';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(line, x, lineY);
        ctx.restore();
      } else {
        // Default: Draw white text only
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(line, x, lineY);
      }
    });
  } else {
    // Style 1: White text with black outline
    ctx.font = `${fontSize}px "${fontName}", "Apple Color Emoji"`;
    ctx.letterSpacing = '0.001em';
    ctx.textBaseline = 'middle';
    
    // Calculate max width (95% of canvas width for more chars per line)
    const maxWidth = canvasWidth * 0.95;
    const lines = wrapText(text, maxWidth, style);
    const lineHeight = fontSize * 1.2;
    const totalHeight = lineHeight * lines.length;
    
    // Draw each line
    lines.forEach((line, index) => {
      const lineY = y - (totalHeight / 2) + (index * lineHeight) + (lineHeight / 2);
      
      // Create text shadow effect exactly like CSS
      const shadowOffset = 2;
      const shadowPositions = [
        [-1, -1], [0, -1], [1, -1],
        [-1, 0], [1, 0],
        [-1, 1], [0, 1], [1, 1]
      ];
      
      // Draw black outline using multiple shadow positions
      ctx.lineWidth = shadowOffset * 2;
      ctx.strokeStyle = '#000000';
      shadowPositions.forEach(([dx, dy]) => {
        ctx.strokeText(line, x + (dx * shadowOffset), lineY + (dy * shadowOffset));
      });
      
      // Draw white text
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(line, x, lineY);
    });
  }
}
