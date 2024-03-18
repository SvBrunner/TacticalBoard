
export const X = (context : any, shape : any) => {
    context.beginPath();
    context.moveTo(-16, -8);
    context.lineTo(-8, 0);
    context.lineTo(-16, 8);
    context.lineTo(-8, 16);
    context.lineTo(0, 8);
    context.lineTo(8, 16);
    context.lineTo(16, 8);
    context.lineTo(8, 0);
    context.lineTo(16, -8);
    context.lineTo(8, -16);
    context.lineTo(0, -8);
    context.lineTo(-8, -16);
    context.closePath();
    context.fillStrokeShape(shape);
};

export const Circle = (context : any, shape : any) => {
    context.beginPath();
    context.arc(0, 0, 20, 0, 2 * Math.PI); // outer circle
    context.closePath();
    context.fillStrokeShape(shape); // Konva specific method
    context.save();
    context.globalCompositeOperation = 'destination-out';
    context.beginPath();
    context.arc(0, 0, 10, 0, 2 * Math.PI);
    context.fill();
    context.restore();
    context.stroke();
};