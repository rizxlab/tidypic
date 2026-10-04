<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import AppIcon from "../AppIcon.vue";
const props = defineProps<{ file: File }>();
const root = ref<HTMLElement>(),
  url = ref(""),
  failed = ref(false);
let observer: IntersectionObserver | undefined;
let disposed = false;
function release() {
  if (url.value) URL.revokeObjectURL(url.value);
  url.value = "";
}
onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (disposed) return;
      if (entries[0]?.isIntersecting) {
        if (!url.value && !failed.value)
          url.value = URL.createObjectURL(props.file);
      } else release();
    },
    { root: root.value?.closest(".file-list"), rootMargin: "0px" },
  );
  if (root.value) observer.observe(root.value);
});
onBeforeUnmount(() => {
  disposed = true;
  observer?.disconnect();
  release();
});
</script>
<template>
  <div ref="root" class="thumbnail">
    <img
      v-if="url && !failed"
      :src="url"
      alt=""
      @error="
        failed = true;
        release();
      "
    /><AppIcon v-else name="image" :size="19" />
  </div>
</template>
