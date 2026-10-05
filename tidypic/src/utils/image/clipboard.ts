/** Only user-initiated paste events are read; no Clipboard API permissions. */
export function clipboardImages(items: Iterable<DataTransferItem>, now = new Date()): File[] {
  const stamp = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")].join("") + "-" +
    [now.getHours(), now.getMinutes(), now.getSeconds()].map(n => String(n).padStart(2, "0")).join("");
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  };
  const files: File[] = [];
  for (const item of items) {
    // Unsupported images still enter the existing validator for its usual error.
    // Text, URLs, HTML and non-image files retain normal browser behaviour.
    if (item.kind !== "file" || !item.type.toLowerCase().startsWith("image/")) continue;
    const file = item.getAsFile();
    if (!file) continue;
    const type = item.type.toLowerCase();
    const extension = extensions[type] || type.slice(6).replace(/[^a-z0-9]/g, "") || "img";
    const name = file.name?.trim();
    files.push(name && name.includes(".") ? file : new File([file],
      `clipboard-${stamp}-${String(files.length + 1).padStart(2, "0")}.${extension}`,
      { type, lastModified: file.lastModified || now.getTime() }));
  }
  return files;
}

function editable(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return !!element && (element.tagName === "INPUT" || element.tagName === "TEXTAREA" ||
    element.isContentEditable || !!element.closest?.("input, textarea"));
}

type PasteTarget = {
  element: () => HTMLElement | undefined;
  enabled: () => boolean;
  add: (files: File[]) => void;
};

/** One listener and one recipient per document, even with multiple uploader instances. */
export function createImagePasteRegistry(doc: Document) {
  const targets = new Set<PasteTarget>();
  const handled = new WeakSet<ClipboardEvent>();
  function paste(event: ClipboardEvent) {
    if (event.defaultPrevented || handled.has(event) || !event.clipboardData ||
      editable(doc.activeElement) || event.composedPath().some(editable)) return;
    const available = [...targets].filter(target => {
      const element = target.element();
      return target.enabled() && element?.isConnected && element.getClientRects().length &&
        doc.defaultView?.getComputedStyle(element).visibility !== "hidden" &&
        !element.closest('[inert], [hidden], [aria-hidden="true"]');
    });
    const target = available.find(target => target.element()?.contains(doc.activeElement)) || available.at(-1);
    if (!target) return;
    const files = clipboardImages(event.clipboardData.items);
    if (!files.length) return;
    handled.add(event);
    event.preventDefault();
    target.add(files);
  }
  return {
    register(target: PasteTarget) {
      if (!targets.size) doc.addEventListener("paste", paste);
      targets.add(target);
      return () => {
        targets.delete(target);
        if (!targets.size) doc.removeEventListener("paste", paste);
      };
    },
  };
}

const registries = new WeakMap<Document, ReturnType<typeof createImagePasteRegistry>>();
export function registerImagePaste(doc: Document, target: PasteTarget) {
  let registry = registries.get(doc);
  if (!registry) {
    registry = createImagePasteRegistry(doc);
    registries.set(doc, registry);
  }
  return registry.register(target);
}
