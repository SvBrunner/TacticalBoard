import { KonvaEventObject } from 'konva/lib/Node';
import {  Stage, Layer } from 'react-konva';
import { Text } from 'react-native';
import BoardComponent from './components/BoardComponent';
import React, { useState } from 'react';
import ShapeX from './components/shapes/ShapeX';
import ShapeCircle from './components/shapes/ShapeCircle';





const INITIAL_STATE = [BoardComponent({ x: 0, y: 0, scale: 1, shapeFunc : ShapeX})];
const Board = () => {
  const [scale, setScale] = useState(1);

  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  const [components, setComponents] = React.useState<JSX.Element[]>(INITIAL_STATE);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setScale(Number(event.target.value));
    components.forEach((component) => {component.props.scale = 3});
  };

  const addX = (e: any) => {
    setComponents([...components, BoardComponent({ x: 0, y: 0, scale: scale, shapeFunc : ShapeX})]);
  };
  const addCircle = (e: any) => {
    setComponents([...components, BoardComponent({ x: 0, y: 0, scale: scale, shapeFunc : ShapeCircle})]);
  }
  ;


  return (
    <div>
      <Stage  width={window.innerWidth} height={window.innerHeight - 200}>
        <Layer >
          {components}
          
        </Layer>
      </Stage>
      <input type="range" min="0.01" max="10" step={0.01} value={scale} onChange={handleChange} />
      <Text>{scale}</Text>
      <button onClick={addX}>Add</button>
      <button onClick={addCircle}>Add Circle</button>
    </div>

  );



};


export default Board;

