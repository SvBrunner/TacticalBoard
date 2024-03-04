import { KonvaEventObject } from 'konva/lib/Node';
import {Shape, Text, Stage, Layer, Rect, Circle } from 'react-konva';

const Board = () => {

  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
 
  const colors = ["red", "orange", "yellow", "green", "blue", "purple"];

  const rotateColor = (e : any) => {
    console.log(e)
    let cid = e.target.attrs.colorId;
    console.log(cid)
    if(e.evt.button == 0 ) {
      cid = (cid + 1) % colors.length;
    }
    else if(e.evt.button == 2){
      cid = (cid - 1 + colors.length) % colors.length;
    }
    e.target.setAttrs({
      fill : colors[cid],
      colorId : cid
    });
  };


  const handleDragStart = (e: KonvaEventObject<DragEvent>) => {

  };
    return (
        // Stage - is a div wrapper
        // Layer - is an actual 2d canvas element, so you can have several layers inside the stage
        // Rect and Circle are not DOM elements. They are 2d shapes on canvas
        <Stage width={window.innerWidth} height={window.innerHeight}>
          <Layer>
            <Rect 
              draggable 
              colorId={0} 
              width={50} 
              height={50} 
              fill="red"  
              onClick={rotateColor}  
             
              />
            <Circle x={200} y={200} stroke="black" radius={50} />
            <Text text="Some text on canvas" fontSize={15} />
            <Shape
            sceneFunc={(context, shape) => {
              context.beginPath();
              context.moveTo(20, 20); // start of first line of "X"
              context.lineTo(80, 80); // end of first line of "X"
              context.moveTo(80, 20); // start of second line of "X"
              context.lineTo(20, 80); // end of second line of "X"
              context.stroke(); // apply the stroke
              context.fillStrokeShape(shape); // Konva specific method
          }}
            fill="#00D2FF"
            stroke="black"
            strokeWidth={4}
          />
          </Layer>
        </Stage>
      );

     
      
};


export default Board;

