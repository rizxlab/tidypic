import type { Ref } from "vue";
export interface PresetOption {
  id: string;
  name: string;
  platform?: string;
  platformName?: string;
}
export interface PresetController<T> {
  users: Ref<T[]>;
  label: Ref<string>;
  error: Ref<string>;
  apply: (p: T) => void | Promise<void>;
  reset: () => void;
  save: (name: string) => void | Promise<void>;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
}
