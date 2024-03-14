const ShapeCircle = (context : any, shape : any) => {
    context.beginPath();
    context.arc(30, 30, 30, 0, 2 * Math.PI); // outer circle
    context.closePath();
    context.fillStrokeShape(shape); // Konva specific method
    
 

    context.save();
    context.globalCompositeOperation = 'destination-out';
    context.beginPath();
    context.arc(30, 30, 20, 0, 2 * Math.PI);
    context.fill();
    context.restore();

    context.stroke();
};

export default ShapeCircle;