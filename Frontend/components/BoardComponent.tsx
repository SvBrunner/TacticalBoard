import Konva from 'konva';
import React, { useState } from 'react';
import { Shape } from 'react-konva';

interface BoardComponentProps {
  x: number;
  y: number;
  renderShape: Function;
  onDelete: Function;
  componentKey: string;
}

interface Position {
  x: number;
  y: number;
}

const colors = ["red", "orange", "yellow", "green", "blue", "purple"];

const BoardComponent: React.FC<BoardComponentProps> = ({ x, y, renderShape, onDelete, componentKey }) => {

  const [position, setPosition] = useState<Position>({ x, y });


  const rotateColor = (e: any) => {
    const colorIndex = e.target.attrs.colorId;
    e.target.setAttrs({
      fill: colors[(colorIndex + 1) % colors.length],
      colorId: (colorIndex + 1) % colors.length
    });
  };

  const onClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.evt.preventDefault();
    if (e.evt.button === 2) {
      onDelete(componentKey);
    }
    if (e.evt.button === 0) {
      rotateColor(e);
    }
  }


  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    setPosition({
      x: e.target.x(),
      y: e.target.y()
    });
  };

  return (
    <Shape
      onClick={onClick}
      sceneFunc={(context, shape) => renderShape(context, shape)}
      x={x}
      y={y}
      fill="#00D2FF"
      stroke="black"
      colorId={0}
      draggable
      strokeWidth={1}
      onDragEnd={handleDragEnd}
    />
  );
};

export default BoardComponent;

