// Mock calculator that calls requestAnimationFrame forever
(function() {
 console.log('mock-calculator.js: loaded');
 function noopRAF() {
    // do something
  
    // request the next frame
    window.requestAnimationFrame(noopRAF);
  }

  // start the noopRAF
  noopRAF();
})();
