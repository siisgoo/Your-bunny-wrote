type Point = {
    x: number,
    y: number,
    vx: number,
    vy: number,
    buddy?: Point,
}

export default class WebLoader {
    private points: Array<Point>;
    private velocity2 = 7; // velocity squared
    private canvas?: HTMLCanvasElement;
    private context?: CanvasRenderingContext2D;
    private radius = 5;
    private boundaryX: number = 0;
    private boundaryY: number = 0;
    private numberOfPoints = 20;
    private animation?: number;

    constructor() {
        this.points = new Array();
    }

    start(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        let ctx = this.canvas.getContext('2d');
        if (ctx) {
            this.context = ctx;
        } else {
            return;
        }

        this.boundaryX = canvas.offsetWidth;
        this.boundaryY = canvas.offsetHeight;

        console.log(this.boundaryX, this.boundaryY);

        this.points.length = 0;
        for (let i = 0; i < this.numberOfPoints; i++) {
            this.createPoint();
        }

        for (let i = 0, l=this.points.length; i<l; i++) {
            if (i == 0) {
                this.points[i].buddy = this.points[this.points.length-1];
            } else {
                this.points[i].buddy = this.points[i-1];
            }
        }

        this.animate();
    }

    stop() {
        if (this.animation) {
            cancelAnimationFrame(this.animation);
            this.animation = undefined;
        }
    }

    private createPoint() {
        let vx = (Math.floor(Math.random())*2-1)*Math.random();
        let vy = Math.sqrt(this.velocity2 - Math.pow(vx, 2)) * (Math.random()*2-1)
        let point: Point = {
            x: Math.random() * this.boundaryX,
            y: Math.random() * this.boundaryY,
            vx: vx,
            vy: vy,
        }
        this.points.push(point);
    }

    private resetVelocity(point: Point, axis: "x"|"y", dir: -1 | 1) {
        if (axis == 'x') {
            point.vx = dir*Math.random();
            point.vy = Math.sqrt(this.velocity2 - Math.pow(point.vx, 2)) *
                        (Math.random()*2-1);
        } else {
            point.vy = dir*Math.random();
            point.vx = Math.sqrt(this.velocity2 - Math.pow(point.vy, 2)) *
                        (Math.random()*2-1);
        }
    }

    private drawCircle(x: number, y: number) {
        if (this.context) {
            this.context.beginPath();
            this.context.arc(x, y, this.radius, 0, 2 * Math.PI, false);
            this.context.fillStyle = '#17f';
            this.context.fill();
        }
    }

    private drawLine(x1: number, y1: number, x2: number, y2: number) {
        if (this.context) {
            this.context.beginPath();
            this.context.moveTo(x1, y1);
            this.context.lineTo(x2, y2);
            this.context.strokeStyle = '#17a'
            this.context.stroke();
        }
    }

    private draw() {
        for (let i =0, l=this.points.length; i<l; i++) {
            // circles
            let point = this.points[i];
            point.x += point.vx;
            point.y += point.vy;
            this.drawCircle(point.x, point.y);
            // lines
            this.drawLine(point.x, point.y, point.buddy!.x, point.buddy!.y);
            // check for edge
            if (point.x < this.radius) {
                this.resetVelocity(point, 'x', 1);
            } else if(point.x > this.boundaryX-this.radius) {
                this.resetVelocity(point, 'x', -1);
            } else if(point.y < this.radius) {
                this.resetVelocity(point, 'y', 1);
            } else if(point.y > this.boundaryY-this.radius) {
                this.resetVelocity(point, 'y', -1);
            }
        }
    }

    private animate() {
        if (this.context) {
            this.context.clearRect(0, 0, this.boundaryX + this.radius, this.boundaryY + this.radius);
            this.draw();
            this.animation = requestAnimationFrame(() => this.animate());
        }
    }
}

