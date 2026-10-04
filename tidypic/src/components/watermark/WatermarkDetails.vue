<script setup lang="ts">
import { computed } from 'vue';
import type { WatermarkSettings } from '../../utils/image/watermark/types';
const settings = defineModel<WatermarkSettings>({required:true});
defineProps<{ panel: string }>();
const emit = defineEmits<{layout: [value: 'single' | 'tiled']}>();
function changeLayout(value: 'single' | 'tiled') { emit('layout', value); }
const positions = [
  ["↖", "左上"],
  ["↑", "上中"],
  ["↗", "右上"],
  ["←", "左中"],
  ["●", "居中"],
  ["→", "右中"],
  ["↙", "左下"],
  ["↓", "下中"],
  ["↘", "右下"],
];
const sizes = [
  ["small", "小"],
  ["medium", "中"],
  ["large", "大"],
  ["custom", "自定义"],
] as const;
const densities = [
  ["sparse", "稀疏"],
  ["medium", "适中"],
  ["dense", "密集"],
  ["custom", "自定义"],
] as const;
const opacity = computed({
  get: () =>
    settings.value.layout === "single"
      ? settings.value.singleOpacity
      : settings.value.tileOpacity,
  set: (value) => {
    if (settings.value.layout === "single")
      settings.value.singleOpacity = value;
    else settings.value.tileOpacity = value;
  },
});
</script>
<template>
<div v-if="panel === 'layout'">        <div class="wm-field">
          <span>布局</span>
          <div class="segmented">
            <button
              :aria-pressed="settings.layout === 'single'"
              @click="changeLayout('single')"
            >
              单点</button
            ><button
              :aria-pressed="settings.layout === 'tiled'"
              @click="changeLayout('tiled')"
            >
              全图平铺
            </button>
          </div>
        </div>
        <div v-if="settings.layout === 'single'" class="wm-position-row">
          <div class="wm-field">
            <span>位置</span>
            <div class="position-grid" aria-label="九宫格位置">
              <button
                v-for="(position, index) in positions"
                :key="index"
                :aria-label="position[1]"
                :aria-pressed="settings.position === index"
                @click="settings.position = index"
              >
                {{ position[0] }}
              </button>
            </div>
          </div>
          <label class="wm-field margin-field"
            >边距<span class="wm-number"
              ><input
                v-model.number="settings.margin"
                aria-label="水印边距"
                type="number"
                min="0"
                max="320"
              />px</span
            ><small>800px 短边基准<br />随图片等比缩放</small></label
          >
        </div>
<template v-if="settings.layout === 'tiled'">
          <div class="wm-field">
            <span>排列</span>
            <div class="segmented">
              <button
                :aria-pressed="settings.arrangement === 'grid'"
                @click="settings.arrangement = 'grid'"
              >
                水平排列</button
              ><button
                :aria-pressed="settings.arrangement === 'staggered'"
                @click="settings.arrangement = 'staggered'"
              >
                交错排列
              </button>
            </div>
          </div>
          <div class="wm-field">
            <span>角度</span>
            <div class="angle-controls">
              <div class="segmented">
                <button
                  v-for="angle in [-30, 0, 30]"
                  :key="angle"
                  :aria-pressed="settings.angle === angle"
                  @click="settings.angle = angle"
                >
                  {{ angle }}°
                </button>
              </div>
              <span class="wm-number"
                ><input
                  v-model.number="settings.angle"
                  aria-label="自定义平铺角度"
                  type="number"
                  min="-180"
                  max="180"
                />°</span
              >
            </div>
          </div>
        </template>
</div>
<div v-if="panel === 'size'">        <div class="wm-field">
          <span>大小</span>
          <div class="segmented">
            <button
              v-for="size in sizes"
              :key="size[0]"
              :aria-pressed="settings.size === size[0]"
              @click="settings.size = size[0]"
            >
              {{ size[1] }}
            </button>
          </div>
          <label
            v-if="settings.size === 'custom' && settings.kind === 'text'"
            class="wm-inline"
            >字号<span class="wm-number"
              ><input
                v-model.number="settings.fontSize"
                aria-label="自定义字号"
                type="number"
                min="8"
                max="400"
              />px</span
            ><small>800px 短边基准</small></label
          >
          <label
            v-if="settings.size === 'custom' && settings.kind === 'image'"
            class="wm-inline"
            >水印宽度<span class="wm-number"
              ><input
                v-model.number="settings.imageWidthPercent"
                aria-label="水印宽度百分比"
                type="number"
                min="1"
                max="100"
              />%</span
            ><small>相对原图宽度</small></label
          >
        </div>
</div>
<div v-if="panel === 'density'"><div class="wm-field">
            <span>密度</span>
            <div class="segmented">
              <button
                v-for="density in densities"
                :key="density[0]"
                :aria-pressed="settings.density === density[0]"
                @click="settings.density = density[0]"
              >
                {{ density[1] }}
              </button>
            </div>
            <label v-if="settings.density === 'custom'" class="wm-inline"
              >间距<span class="wm-number"
                ><input
                  v-model.number="settings.gap"
                  aria-label="平铺间距"
                  type="number"
                  min="0"
                  max="800"
                />px</span
              ><small>800px 短边基准</small></label
            >
          </div>
          </div>
<div v-if="panel === 'opacity'">        <div class="wm-field">
          <div class="field-heading">
            <span>透明度</span><output>{{ opacity }}%</output>
          </div>
          <div class="opacity-controls">
            <input
              v-model.number="opacity"
              type="range"
              min="0"
              max="100"
              aria-label="水印透明度"
            />
            <div class="opacity-presets">
              <button
                v-for="value in settings.layout === 'single'
                  ? [25, 50, 75, 100]
                  : [15, 25, 50, 100]"
                :key="value"
                :aria-pressed="opacity === value"
                @click="opacity = value"
              >
                {{ value }}%
              </button>
            </div>
          </div>
        </div>
</div>
<div v-if="panel === 'color'">        <div v-if="settings.kind === 'text'" class="wm-color-row">
          <span>文字颜色</span>
          <div class="color-swatches">
            <button
              v-for="color in [
                ['#ffffff', '白'],
                ['#000000', '黑'],
                ['#808080', '灰'],
              ]"
              :key="color[0]"
              :aria-label="`文字颜色：${color[1]}`"
              :aria-pressed="settings.color === color[0]"
              :style="{ '--swatch': color[0] }"
              @click="settings.color = color[0]!"
            ></button
            ><label class="custom-color"
              >自定义<input
                v-model="settings.color"
                type="color"
                aria-label="自定义文字颜色"
            /></label>
          </div>
        </div>
</div>
</template>
