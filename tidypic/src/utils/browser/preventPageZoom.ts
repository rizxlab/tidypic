/** Block browser pinch gestures on touch devices, leaving single-finger scrolling intact. */
export function preventPageZoom() {
  const touchDevice = window.matchMedia('(any-pointer: coarse)');
  const preventGesture = (event: Event) => {
    if (touchDevice.matches && event.cancelable) event.preventDefault();
  };
  const preventMultiTouch = (event: TouchEvent) => {
    if (event.touches.length > 1) preventGesture(event);
  };
  const options = { passive: false };
  document.addEventListener('touchstart', preventMultiTouch, options);
  document.addEventListener('touchmove', preventMultiTouch, options);
  // Safari exposes native pinch events separately from touch events.
  document.addEventListener('gesturestart', preventGesture, options);
  document.addEventListener('gesturechange', preventGesture, options);
  return () => {
    document.removeEventListener('touchstart', preventMultiTouch);
    document.removeEventListener('touchmove', preventMultiTouch);
    document.removeEventListener('gesturestart', preventGesture);
    document.removeEventListener('gesturechange', preventGesture);
  };
}
