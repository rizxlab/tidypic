import test from "node:test";
import assert from "node:assert/strict";
import { clipboardImages, createImagePasteRegistry } from "../src/utils/image/clipboard.ts";

function item(type: string, name = "", kind = "file", contents = "image") {
  const file = new File([contents], name, { type });
  return { kind, type, getAsFile: () => file } as DataTransferItem;
}

test("PNG, JPEG and WebP clipboard files get MIME extensions without requiring a name", () => {
  const files = clipboardImages([item("image/png"), item("image/jpeg"), item("image/webp", "blob")], new Date(2026, 9, 5, 13, 1, 0));
  assert.deepEqual(files.map(f => f.name), ["clipboard-20261005-130100-01.png", "clipboard-20261005-130100-02.jpg", "clipboard-20261005-130100-03.webp"]);
  assert.deepEqual(files.map(f => f.type), ["image/png", "image/jpeg", "image/webp"]);
  assert.deepEqual(files.map(f => f.size), [5, 5, 5]);
  const named = item("image/jpeg", "photo.JPEG");
  assert.equal(clipboardImages([named])[0], named.getAsFile());
});

test("text, URL, HTML, other files and null files are ignored; unsupported images reach validation", () => {
  assert.equal(clipboardImages([item("text/plain", "", "string"), item("text/html", "", "string"), item("application/pdf", "a.pdf"), { ...item("image/png"), getAsFile: () => null }]).length, 0);
  assert.equal(clipboardImages([item("image/gif", "a.gif")])[0]?.type, "image/gif");
});

function fixture() {
  const listeners = new Set<(event: ClipboardEvent) => void>();
  const doc = {
    activeElement: null as unknown,
    addEventListener: (_: string, cb: (event: ClipboardEvent) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (event: ClipboardEvent) => void) => listeners.delete(cb),
  };
  const registry = createImagePasteRegistry(doc as unknown as Document);
  function event(items = [item("image/png")], path: unknown[] = []) {
    return {
      defaultPrevented: false,
      clipboardData: { items },
      composedPath: () => path,
      preventDefault() { this.defaultPrevented = true; },
    } as unknown as ClipboardEvent;
  }
  function target() {
    const received: File[][] = [];
    let enabled = true, visible = true, focused = false;
    const element = {
      isConnected: true, getClientRects: () => visible ? [{}] : [],
      closest: () => null, contains: () => focused,
    } as unknown as HTMLElement;
    const unregister = registry.register({ element: () => element, enabled: () => enabled, add: files => received.push(files) });
    return { received, unregister, enable: (value: boolean) => { enabled = value; }, show: (value: boolean) => { visible = value; }, focus: () => { focused = true; } };
  }
  const dispatch = (ev: ClipboardEvent) => listeners.forEach(cb => cb(ev));
  return { doc, listeners, event, target, dispatch };
}

test("one shared listener routes each paste once, allows multiple files and successive pastes", () => {
  const f = fixture(), a = f.target(), b = f.target();
  assert.equal(f.listeners.size, 1);
  const event = f.event([item("image/png"), item("image/webp")]);
  f.dispatch(event); f.dispatch(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(a.received.length, 0);
  assert.equal(b.received.length, 1);
  assert.equal(b.received[0]?.length, 2);
  // Even redispatching the same event with defaultPrevented reset cannot duplicate it.
  Object.assign(event, { defaultPrevented: false }); f.dispatch(event);
  assert.equal(b.received.length, 1);
  f.dispatch(f.event());
  assert.equal(b.received.length, 2);
  a.focus(); f.dispatch(f.event());
  assert.equal(a.received.length, 1);
  a.unregister(); b.unregister();
  assert.equal(f.listeners.size, 0);
});

test("hidden, disabled, processing and unmounted uploaders do not consume paste", () => {
  const f = fixture(), a = f.target(), b = f.target();
  b.show(false); f.dispatch(f.event());
  assert.equal(a.received.length, 1);
  a.enable(false);
  const ignored = f.event(); f.dispatch(ignored);
  assert.equal(ignored.defaultPrevented, false);
  b.show(true); b.unregister(); f.dispatch(f.event());
  assert.equal(b.received.length, 0);
});

test("input, textarea and inherited contenteditable focus leave image and text paste untouched", () => {
  const f = fixture(), target = f.target();
  for (const focus of [{ tagName: "INPUT" }, { tagName: "TEXTAREA" }, { tagName: "SPAN", isContentEditable: true }, { closest: () => ({ tagName: "INPUT" }) }]) {
    f.doc.activeElement = focus;
    const event = f.event(); f.dispatch(event);
    assert.equal(event.defaultPrevented, false);
  }
  f.doc.activeElement = null;
  const shadowEvent = f.event(undefined, [{ tagName: "TEXTAREA" }]);
  f.dispatch(shadowEvent);
  assert.equal(shadowEvent.defaultPrevented, false);
  const text = f.event([item("text/plain", "", "string")]); f.dispatch(text);
  assert.equal(text.defaultPrevented, false);
  assert.equal(target.received.length, 0);
});
