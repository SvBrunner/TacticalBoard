const ShapeX = (context : any, shape : any) => {
    context.beginPath();
    context.moveTo(0, 0); // start of first line of "X"
    context.lineTo(60,60); // end of first line of "X"
    context.lineTo(60,40); // create a small rectangle
    context.lineTo(20,0);
    context.closePath();
    context.fillStrokeShape(shape); // Konva specific method
    context.beginPath();
    context.moveTo(60,0); // start of second line of "X"
    context.lineTo(0,60); // end of second line of "X"
    context.lineTo(0,40); // create a small rectangle
    context.lineTo(40,0);
    context.closePath();
    context.fillStrokeShape(shape); // Konva specific method
};

export default ShapeX;