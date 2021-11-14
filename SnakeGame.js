const SVGNS = 'http://www.w3.org/2000/svg';

export class Snake {
  x;
  y;
  #angle = 0;
  #turnSpeed = 0.005;
  #tail = [];
  #length = 0;

  isAlive = true;

  wanderX = Math.random() * window.innerWidth;
  wanderY = Math.random() * window.innerHeight;

  speed = 0.2;
  size = 10;
  maxLength = 100;

  #color = `hsl( ${ Math.random() * 360 }deg, 50%, 50% )`;

  bodySVG = document.createElementNS( SVGNS, 'path' );
  forcesSVG = document.createElementNS( SVGNS, 'g' );
  #goalForceSVG = document.createElementNS( SVGNS, 'path' );
  #avoidForcesSVG = document.createElementNS( SVGNS, 'path' );
  #finalForceSVG = document.createElementNS( SVGNS, 'path' );

  constructor( x, y, angle ) {
    this.x = x;
    this.y = y;
    this.#angle = angle;

    setInterval( () => {
      this.wanderX = Math.random() * window.innerWidth;
      this.wanderY = Math.random() * window.innerHeight;
    }, 5000 );

    this.#tail.push( { x: x, y: y, angle: angle, length: 0 } );

    this.bodySVG.setAttribute( 'class', 'snake' );
    this.bodySVG.style.fill = this.#color;

    this.#goalForceSVG.setAttribute( 'class', 'goalForce' );
    this.forcesSVG.appendChild( this.#goalForceSVG );

    this.#avoidForcesSVG.setAttribute( 'class', 'avoidForce' );
    this.forcesSVG.appendChild( this.#avoidForcesSVG );

    this.#finalForceSVG.setAttribute( 'class', 'finalForce' );
    this.forcesSVG.appendChild( this.#finalForceSVG );
  }

  destroy() {
    this.bodySVG.remove();
    this.#goalForceSVG.remove();
    this.#avoidForcesSVG.remove();
    this.#finalForceSVG.remove();
  }

  angleTo( other ) { return this.angleToPoint( other.x, other.y ); }
  angleToPoint( x, y ) { return Math.atan2( y - this.y, x - this.x ); }

  distanceTo( other ) { return this.distanceToPoint( other.x, other.y ); }
  distanceToPoint( x, y ) { return Math.hypot( x - this.x, y - this.y ); }

  getVectors( snakes ) {
    const vectors = [];

    snakes.forEach( snake => {
      let testLength = 0;
      snake.#tail.forEach( ( segment, index, tail ) => {
        testLength += segment.length;

        // If it's us, don't check against the head
        if ( snake != this || testLength < this.#length - this.size * 2 ) {
          const cx = this.x - segment.x;
          const cy = this.y - segment.y;
          const angle = Math.atan2( cy, cx );
          const dist = Math.hypot( cx, cy ) - snake.size * ( index / tail.length ) - this.size;

          let angleDelta = Math.abs( fixAngleTo( angle, this.#angle ) - this.#angle );

          if ( angleDelta > Math.PI / 2) {
            vectors.push( { 
              angle: angle,
              dist: dist,
            } );
          }
        }
      } );
    } );

    return vectors;
  }

  turnTowardAngle( goalAngle, dt ) {
    this.#angle = fixAngleTo( this.#angle, goalAngle );

    // Turn toward goal angle
    if ( goalAngle < this.#angle ) {
      this.#angle = Math.max( goalAngle, this.#angle - this.#turnSpeed * dt );
    }
    else if ( this.#angle < goalAngle ) {
      this.#angle = Math.min( goalAngle, this.#angle + this.#turnSpeed * dt );
    }
  }

  moveForward( dt ) {
    if ( this.isAlive ) {
      const moveDist = this.speed * dt;

      this.x += Math.cos( this.#angle ) * moveDist;
      this.y += Math.sin( this.#angle ) * moveDist;

      this.#tail.push( { x: this.x, y: this.y, angle: this.#angle, length: moveDist } );
      this.#length += moveDist;
    }
    else {
      this.maxLength -= this.speed * dt;
    }

    while ( this.#length > this.maxLength && this.#tail.length > 0 ) {
      this.#length -= this.#tail.shift().length;
    }

    this.bodySVG.setAttribute( 'd', this.#getDString() );

    if ( this.#tail.length == 0 ) {
      this.destroy();
      return false;
    }

    return true;
  }

  drawGoalForce( goalForce ) {
    this.#goalForceSVG.setAttribute( 'd', 
      `M ${ this.x },${ this.y } L ${ this.x + goalForce.x * 100 },${ this.y + goalForce.y * 100 }`
    );
  }

  drawFinalForce( finalForce ) {
    this.#finalForceSVG.setAttribute( 'd', 
      `M ${ this.x },${ this.y } L ${ this.x + finalForce.x * 100 },${ this.y + finalForce.y * 100 }`
    );
  }

  drawAvoidForces( avoidForces ) {
    const len = 100 * avoidForces.length;
    this.#avoidForcesSVG.setAttribute( 'd', 
      avoidForces.map( wv => 
        `M ${ this.x },${ this.y } L ${ this.x + wv.x * len },${ this.y + wv.y * len }`
      ).join( ' ' )
    );
  }

  #getDString() {
    if ( this.#tail.length > 0 ) {
      const leftCoords = [], rightCoords = [];
      this.#tail.forEach( ( segment, index, tail ) => {
        const width = this.size * index / tail.length;

        const leftAng = segment.angle - Math.PI / 2;
        const leftX = segment.x + Math.cos( leftAng ) * width;
        const leftY = segment.y + Math.sin( leftAng ) * width;
        leftCoords.push( `${ leftX },${ leftY }` );

        const rightAng = segment.angle + Math.PI / 2;
        const rightX = segment.x + Math.cos( rightAng ) * width;
        const rightY = segment.y + Math.sin( rightAng ) * width;
        rightCoords.unshift( `${ rightX },${ rightY }` );

      } );

      return `M ${ leftCoords.join( ' L ' ) } A ${ this.size } ${ this.size } 0 0 1 ${ rightCoords.join( ' L ' ) }`;
    }
    else {
      return '';
    }
  }
}

function fixAngleTo( angle, otherAngle ) {
  if ( otherAngle - angle > Math.PI ) {
    return angle + Math.PI * 2;
  }
  else if ( angle - otherAngle > Math.PI ) {
    return angle - Math.PI * 2;
  }

  return angle;
}

export class Apple {
  x;
  y;
  size = 10;
  svg = document.createElementNS( SVGNS, 'circle' );

  constructor( x, y ) {
    this.x = x;
    this.y = y;

    this.svg.setAttribute( 'class', 'apple' );
    this.svg.setAttribute( 'cx', x );
    this.svg.setAttribute( 'cy', y );
    this.svg.setAttribute( 'r', this.size );
  }

  destroy() {
    this.svg.remove();
  }
}
