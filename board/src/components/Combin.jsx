import '@fontsource/kalam'
import ContentEditable from "react-contenteditable";

import { cn, colorToCss, getContrastingTextColor } from "../constants/index";
import { useMutation } from "../../liveblocks.config";
import { Button } from './ui/button'
import { color } from 'framer-motion';


const calculateFontSize = (width, height) => {
  const maxFontSize = 96;
  const scaleFactor = 0.15;
  const fontSizeBasedOnHeight = height * scaleFactor;
  const fontSizeBasedOnWidth = width * scaleFactor;

  return Math.min(
    fontSizeBasedOnHeight, 
    fontSizeBasedOnWidth, 
    maxFontSize
  );
}


export const Combin = ({layer, onPointerDown, id, selectionColor}) => {
  const { x, y, width, height , fill, value } = layer;

  const updateValue = useMutation(({ storage }, newValue) => {
    const liveLayers = storage.get("layers");

    liveLayers.get(id)?.set("value", newValue);
  }, []);

  const handleContentChange = (e) => {
    updateValue(e.target.value);
  };
  return (
    <foreignObject
      x={x}
      y={y}
      width={width} // Ensure this is sufficient for the widest element
      height={height } // Adjust to accommodate both areas
      onPointerDown={(e) => onPointerDown(e, id)}
      style={{
        borderTopLeftRadius: '20px',
        borderTopRightRadius: '20px',
        borderBottomLeftRadius: '0px',
        borderBottomRightRadius: '0px',
        outline: selectionColor ? `1px solid ${selectionColor}` : "none",
        backgroundColor: fill ? colorToCss(fill) : "#000",
        overflow: 'visible' // Ensure inner SVG content is visible outside the bounds
      }}
      className="shadow-md drop-shadow-xl"
    >
      <svg width={'100%'} height={'100%'}>

        <rect
          x="0"
          y={height / 10 +10} // Starts right after the end of the first shape
          width={width + 10} // Full width of the parent
          height={height * 0.008} // Relative height
          fill="white"
        />
  

        <rect
          x="0"
          y={height - 3*height/10} // Positioned lower in the SVG
          width={width +10 }
          height={height * 0.008}
          fill="white"
        />

      </svg>
    </foreignObject>
  );

  
};