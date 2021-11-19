const SVGNS = 'http://www.w3.org/2000/svg';
const svg = document.createElementNS( SVGNS, 'svg' );
document.body.appendChild( svg );

export const Settings = {
  GoalWeight: 0.5,
  AvoidWeight: 100,
  AvoidPower: 1,
  DrawForces: false,
  MinimumAppleDist: 20,
  AppleGrowLength: 100,
};

export class Snake {
  x;
  y;
  goalAngle;

  #angle = 0;
  #turnSpeed = 0.005;
  #tail = [];
  #length = 0;

  wanderX = Math.random() * window.innerWidth;
  wanderY = Math.random() * window.innerHeight;

  speed = 0.2;
  size = 10;
  maxLength = 100;

  #color = `hsl( ${ Math.random() * 360 }deg, ${ rand() * 100 }%, ${ rand() * 100 }% )`;

  #bodySVG = document.createElementNS( SVGNS, 'path' );
  #goalForceSVG = document.createElementNS( SVGNS, 'path' );
  #avoidForcesSVG = document.createElementNS( SVGNS, 'path' );
  #finalForceSVG = document.createElementNS( SVGNS, 'path' );

  constructor( 
    x = rand() * window.innerWidth, 
    y = rand() * window.innerHeight,
  ) {
    this.x = x;
    this.y = y;
    this.goalAngle = Math.atan2( window.innerHeight / 2 - y, window.innerWidth / 2 - x );
    this.#angle = this.goalAngle;

    setInterval( () => {
      this.wanderX = rand() * window.innerWidth;
      this.wanderY = rand() * window.innerHeight;
    }, 5000 );

    this.#tail.push( { x: x, y: y, angle: this.#angle, length: 0 } );

    this.#bodySVG.setAttribute( 'class', 'snake' );
    this.#bodySVG.style.fill = this.#color;
    svg.appendChild( this.#bodySVG );

    this.#goalForceSVG.setAttribute( 'class', 'goal' );
    svg.appendChild( this.#goalForceSVG );

    this.#avoidForcesSVG.setAttribute( 'class', 'avoid' );
    svg.appendChild( this.#avoidForcesSVG );

    this.#finalForceSVG.setAttribute( 'class', 'final' );
    svg.appendChild( this.#finalForceSVG );
  }

  // TODO: Clean up kill vs destroy
  remove() {
    this.#bodySVG.remove();
    this.#goalForceSVG.remove();
    this.#avoidForcesSVG.remove();
    this.#finalForceSVG.remove();
  }

  kill() {
    this.#bodySVG.classList.add( 'snakeDeath' );
    this.#bodySVG.addEventListener( 'animationend', removeAnimatedElement );
    this.#goalForceSVG.remove();
    this.#avoidForcesSVG.remove();
    this.#finalForceSVG.remove();
  }

  angleTo( other ) { return this.angleToPoint( other.x, other.y ); }
  angleToPoint( x, y ) { return Math.atan2( y - this.y, x - this.x ); }

  distanceTo( other ) { return this.distanceToPoint( other.x, other.y ); }
  distanceToPoint( x, y ) { return Math.hypot( x - this.x, y - this.y ); }

  getAvoidVectors( snakes ) {
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

          // TODO: Make this a seperate step (part of a filter?)
          //       Then we can apply it after adding walls and whatnot
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

    // Hardcode walls at edge of screen for now
    vectors.push( { angle:  0,            dist: this.x - this.size } );
    vectors.push( { angle:  Math.PI / 2,  dist: this.y - this.size } );
    vectors.push( { angle:  Math.PI,      dist: window.innerWidth  - this.x - this.size } );
    vectors.push( { angle: -Math.PI / 2,  dist: window.innerHeight - this.y - this.size } );

    return vectors;
  }

  think( apples, avoidVectors ) {
    let closest = apples.map( 
      apple => ( { apple: apple, dist: this.distanceTo( apple ) } )
    ).reduce( 
      ( acc, appleDist ) => 
        Settings.MinimumAppleDist < appleDist.dist && appleDist.dist < acc.dist ? appleDist : acc,
      { apple: null, dist: Infinity }
    );

    const goalX = closest.apple?.x ?? this.wanderX;
    const goalY = closest.apple?.y ?? this.wanderY;

    // Try to avoid other snakes
    const weighted = avoidVectors.map( vector => {
      const weightedDist = Math.abs( Settings.AvoidWeight / Math.pow( vector.dist, Settings.AvoidPower ) );
      return { 
        x: Math.cos( vector.angle ) * weightedDist / avoidVectors.length,
        y: Math.sin( vector.angle ) * weightedDist / avoidVectors.length
      };
    } );

    const goalAngle = Math.atan2( goalY - this.y, goalX - this.x );
    const goalForce = {
      x: Settings.GoalWeight * Math.cos( goalAngle ), 
      y: Settings.GoalWeight * Math.sin( goalAngle ),
    }

    const finalForce = weighted.reduce(
      ( acc, wv ) => ( { x: acc.x + wv.x, y: acc.y + wv.y } ),
      goalForce
    );

    if ( Settings.DrawForces ) {
      const len = 100 * weighted.length;
      this.#avoidForcesSVG.setAttribute( 'd', 
        weighted.map( wv => this.#getForceDString( wv, len ) ).join( ' ' )
      );
      this.#goalForceSVG.setAttribute( 'd', this.#getForceDString( goalForce ) );
      this.#finalForceSVG.setAttribute( 'd', this.#getForceDString( finalForce ) );
    }

    this.goalAngle = Math.atan2( finalForce.y, finalForce.x );
  }

  tryEatApple( apple ) {
    if ( this.distanceTo( apple ) < this.size + apple.size ) {
      this.maxLength += Settings.AppleGrowLength;
      apple.remove();
      return true;
    }

    return false;
  }

  update( dt ) {
    // Turn toward goal angle
    this.#angle = fixAngleTo( this.#angle, this.goalAngle );
    if ( this.goalAngle < this.#angle ) {
      this.#angle = Math.max( this.goalAngle, this.#angle - this.#turnSpeed * dt );
    }
    else if ( this.#angle < this.goalAngle ) {
      this.#angle = Math.min( this.goalAngle, this.#angle + this.#turnSpeed * dt );
    }

    // Move forward
    const moveDist = this.speed * dt;

    this.x += Math.cos( this.#angle ) * moveDist;
    this.y += Math.sin( this.#angle ) * moveDist;

    this.#tail.push( { x: this.x, y: this.y, angle: this.#angle, length: moveDist } );
    this.#length += moveDist;

    while ( this.#length > this.maxLength && this.#tail.length > 0 ) {
      this.#length -= this.#tail.shift().length;
    }

    // Draw
    this.#bodySVG.setAttribute( 'd', this.#getDString() );
  }

  #getForceDString( force, length = 100 ) {
    return `M ${ this.x },${ this.y } L ${ this.x + force.x * length },${ this.y + force.y * length }`
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

function removeAnimatedElement( animationEvent ) {
  animationEvent.srcElement.remove();
}

function rand() { return Math.random() * 0.5 + 0.25; }

export class Apple {
  x;
  y;
  size = 10;
  #svg = document.createElementNS( SVGNS, 'circle' );

  constructor( 
    x = rand() * window.innerWidth, 
    y = rand() * window.innerHeight,
  ) {
    this.x = x;
    this.y = y;

    this.#svg.setAttribute( 'class', 'apple' );
    this.#svg.setAttribute( 'cx', x );
    this.#svg.setAttribute( 'cy', y );
    this.#svg.setAttribute( 'r', this.size );

    svg.appendChild( this.#svg );
  }

  remove() {
    this.#svg.remove();
  }
}
