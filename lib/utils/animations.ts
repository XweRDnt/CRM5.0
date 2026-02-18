export interface AnimationOptions {
  duration?: number
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
  onComplete?: () => void
}

const DEFAULT_DURATION = 300
const DEFAULT_EASING: NonNullable<AnimationOptions['easing']> = 'ease-in-out'

function applyOpacityAnimation(
  element: HTMLElement,
  from: string,
  to: string,
  options: AnimationOptions = {}
): void {
  const { duration = DEFAULT_DURATION, easing = DEFAULT_EASING, onComplete } = options

  element.style.opacity = from
  element.style.transition = `opacity ${duration}ms ${easing}`

  setTimeout(() => {
    element.style.opacity = to
  }, 0)

  if (onComplete) {
    setTimeout(onComplete, duration)
  }
}

function getAxisAndOffset(direction: 'left' | 'right' | 'top' | 'bottom'): {
  axis: 'X' | 'Y'
  offset: string
} {
  if (direction === 'left') {
    return { axis: 'X', offset: '-20px' }
  }
  if (direction === 'right') {
    return { axis: 'X', offset: '20px' }
  }
  if (direction === 'top') {
    return { axis: 'Y', offset: '-20px' }
  }
  return { axis: 'Y', offset: '20px' }
}

function applySlideAnimation(
  element: HTMLElement,
  direction: 'left' | 'right' | 'top' | 'bottom',
  enter: boolean,
  options: AnimationOptions = {}
): void {
  const { duration = DEFAULT_DURATION, easing = DEFAULT_EASING, onComplete } = options
  const { axis, offset } = getAxisAndOffset(direction)
  const hiddenTransform = `translate${axis}(${offset})`
  const visibleTransform = 'translate(0, 0)'

  element.style.transition = `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`
  element.style.opacity = enter ? '0' : '1'
  element.style.transform = enter ? hiddenTransform : visibleTransform

  setTimeout(() => {
    element.style.opacity = enter ? '1' : '0'
    element.style.transform = enter ? visibleTransform : hiddenTransform
  }, 0)

  if (onComplete) {
    setTimeout(onComplete, duration)
  }
}

/**
 * Smoothly fades in an element by animating opacity to 1.
 */
export function fadeIn(element: HTMLElement, options?: AnimationOptions): void {
  applyOpacityAnimation(element, '0', '1', options)
}

/**
 * Smoothly fades out an element by animating opacity to 0.
 */
export function fadeOut(element: HTMLElement, options?: AnimationOptions): void {
  applyOpacityAnimation(element, '1', '0', options)
}

/**
 * Slides an element into view from the specified direction.
 */
export function slideIn(
  element: HTMLElement,
  direction: 'left' | 'right' | 'top' | 'bottom',
  options?: AnimationOptions
): void {
  applySlideAnimation(element, direction, true, options)
}

/**
 * Slides an element out of view toward the specified direction.
 */
export function slideOut(
  element: HTMLElement,
  direction: 'left' | 'right' | 'top' | 'bottom',
  options?: AnimationOptions
): void {
  applySlideAnimation(element, direction, false, options)
}

/**
 * Smoothly scrolls to a target element by selector or element reference.
 */
export function smoothScroll(
  target: HTMLElement | string,
  options?: { offset?: number }
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  const element =
    typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target

  if (!element) {
    return
  }

  const offset = options?.offset ?? 0

  if (offset !== 0) {
    const top = element.getBoundingClientRect().top + window.scrollY + offset
    window.scrollTo({ top, behavior: 'smooth' })
    return
  }

  element.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
