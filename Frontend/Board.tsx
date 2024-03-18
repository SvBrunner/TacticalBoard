import { KonvaEventObject } from 'konva/lib/Node';
import { Stage, Layer } from 'react-konva';
import BoardComponent from './components/BoardComponent';
import React, { useEffect, useState } from 'react';
import { X, Circle } from './components/shapes';
import Button from 'react-bootstrap/Button';
import { v4 as uuidv4 } from 'uuid';
import DrawingMenu, {CurrentShape} from './components/DrawingMenu';



interface Shape {
  key: string;
  shape: any;
  x: number;
  y: number;
}

const SHAPES = [X, Circle];

const Board = () => {
  const [currentShape, setCurrentShape] = useState<number>(0);
  const [shapes, setShapes] = useState<Shape[]>([]);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  const selectShape = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    setCurrentShape(Number(e.currentTarget.value));
  };

  const handleOnClick = (e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) 
      return;
    const x = e.evt.offsetX;
    const y = e.evt.offsetY;

    addShape(CurrentShape(), x, y);
  };

  const addShape = (shape: any, x: number, y: number) => {
    if (currentShape === -1) 
      return;
    setShapes([...shapes, { key: uuidv4(), shape, x, y }]);
  };

  const removeShape = (key: string) => {
    setShapes(shapes.filter((shape) => shape.key !== key));
  };

  const clearBoard = () => {
    setShapes([]);
  };

  return (
    <div>
      <Stage onClick={handleOnClick} width={window.innerWidth} height={window.innerHeight - 200}>
        <Layer>
          {shapes.map(({ key, shape, x, y }) => (
            <BoardComponent 
              key={key} 
              componentKey={key} 
              x={x} 
              y={y} 
              renderShape={shape} 
              onDelete={removeShape} />
          ))}
        </Layer>
      </Stage>
      <DrawingMenu />
      <Button className={currentShape == -1 ? 'active' : ''} onClick={selectShape} value={-1}>None</Button>
      <Button className={currentShape == 0 ? 'active' : ''} onClick={selectShape} value={0}>X</Button>
      <Button className={currentShape == 1 ? 'active' : ''} onClick={selectShape} value={1}>Circle</Button>
      <Button onClick={clearBoard}>Clear</Button>
    </div>
  );
};

export default Board;
