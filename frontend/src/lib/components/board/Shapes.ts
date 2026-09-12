export function drawPlayer(context: any, shape: any) {
	context.beginPath();
	context.arc(0, 0, 20, 0, 2 * Math.PI);
	context.closePath();
	context.fillStrokeShape(shape);
}

export function drawBall(context: any, shape: any) {
	context.beginPath();
	context.arc(0, 0, 12, 0, 2 * Math.PI);
	context.closePath();
	context.fillStrokeShape(shape);

	context.save();
	context.globalCompositeOperation = "destination-out";
	context.beginPath();
	context.arc(0, 0, 6, 0, 2 * Math.PI);
	context.fill();
	context.restore();
}

export function drawCircle(context: any, shape: any) {
	context.beginPath();
	context.arc(0, 0, 20, 0, 2 * Math.PI); // outer circle
	context.closePath();
	context.fillStrokeShape(shape); // Konva specific method
	context.save();
	context.globalCompositeOperation = "destination-out";
	context.beginPath();
	context.arc(0, 0, 10, 0, 2 * Math.PI);
	context.fill();
	context.restore();
}

export function drawRectangle(context: any, shape: any) {
	context.beginPath();
	context.rect(-20, -20, 40, 40);
	context.closePath();
	context.fillStrokeShape(shape);

	context.save();
	context.globalCompositeOperation = "destination-out";
	context.beginPath();
	context.rect(-10, -10, 20, 20);
	context.fill();
	context.restore();
}

export function drawTriangle(context: any, shape: any) {
	context.beginPath();
	context.moveTo(0, -20);
	context.lineTo(18, 15);
	context.lineTo(-18, 15);
	context.closePath();
	context.fillStrokeShape(shape);

	context.save();
	context.globalCompositeOperation = "destination-out";
	context.beginPath();
	context.moveTo(0, -10);
	context.lineTo(9, 7);
	context.lineTo(-9, 7);
	context.closePath();
	context.fill();
	context.restore();
}
