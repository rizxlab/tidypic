import { onBeforeUnmount, ref, type Ref } from "vue";
/** Shared touch/mouse sorting; keyboard reordering is supplied by the caller. */
export function usePointerSort(
  root: Ref<HTMLElement | undefined>,
  selector: string,
  move: (id: string, target: HTMLElement) => void,
  disabled: () => boolean,
) {
  const dragging = ref("");
  let x = 0,
    y = 0,
    frame = 0;
  function reorder() {
    const target = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>(selector);
    if (target && root.value?.contains(target)) move(dragging.value, target);
  }
  function update(event: PointerEvent) {
    x = event.clientX;
    y = event.clientY;
    reorder();
  }
  function scroll() {
    const list =
      root.value?.querySelector<HTMLElement>(".file-list") || root.value;
    if (list) {
      const rect = list.getBoundingClientRect(),
        before = list.scrollTop;
      if (y < rect.top + 32) list.scrollTop -= 10;
      else if (y > rect.bottom - 32) list.scrollTop += 10;
      if (list.scrollTop !== before) reorder();
      if (y < 40) window.scrollBy(0, -10);
      else if (y > window.innerHeight - 40) window.scrollBy(0, 10);
    }
    frame = requestAnimationFrame(scroll);
  }
  function stop() {
    dragging.value = "";
    cancelAnimationFrame(frame);
    window.removeEventListener("pointermove", update);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
  }
  function start(event: PointerEvent, id: string) {
    if (disabled()) return;
    dragging.value = id;
    x = event.clientX;
    y = event.clientY;
    window.addEventListener("pointermove", update);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    frame = requestAnimationFrame(scroll);
  }
  onBeforeUnmount(stop);
  return { dragging, start };
}
