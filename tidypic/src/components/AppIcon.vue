<script setup lang="ts">
withDefaults(defineProps<{ name?: string; size?: number }>(), {
  name: "image",
  size: 20,
});
const paths: Record<string, string> = {
  rename: "M13 3H5v18h14V10M8 15l1-4 9-9 3 3-9 9-4 1M16 4l3 3",
  image:
    "M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM3 17l6-7 5 5 3-3 4 5M16 7h.01",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  resize: "M8 3H3v5M16 21h5v-5M3 3l6 6m12 12-6-6M14 3h7v7M3 14v7h7",
  convert: "M4 8h16l-4-4m4 12H4l4 4",
  upload: "M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6",
  download: "M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5",
  shield: "m12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5zM8 11l3 3 5-5",
  check: "m5 12 4 4L19 6",
  chevron: "m7 10 5 5 5-5",
  watermark: "M5 20h14M7 15l5-12 5 12M9 11h6",
  split: "M4 3h16v18H4zM4 9h16M4 15h16",
  join: "M3 5h7v14H3zM14 5h7v14h-7z",
  close: "m6 6 12 12M6 18 18 6",
  arrow: "M4 12h16m-5-5 5 5-5 5",
};
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] || paths.image" />
  </svg>
</template>
