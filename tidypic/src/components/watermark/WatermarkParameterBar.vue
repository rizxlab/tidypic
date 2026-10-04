<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppIcon from '../AppIcon.vue';
import WatermarkDetails from './WatermarkDetails.vue';
import type { WatermarkSettings } from '../../utils/image/watermark/types';
const settings = defineModel<WatermarkSettings>({required:true});
const props = defineProps<{disabled:boolean}>();
const emit = defineEmits<{layout:[value:'single'|'tiled']}>();
const opened = ref<string | null>(null);
const root = ref<HTMLElement>();
let trigger: HTMLElement | undefined;
const positions = ['左上','上中','右上','左中','居中','右中','左下','下中','右下'];
const panels = computed(()=>{
  const s=settings.value;
  const size = s.size === 'custom' ? (s.kind === 'text' ? `${s.fontSize}px` : `${s.imageWidthPercent}%`) : ({small:'小',medium:'中',large:'大'}[s.size]);
  const color = ({'#ffffff':'白色','#000000':'黑色','#808080':'灰色'} as Record<string,string>)[s.color] || s.color;
  return [
    {id:'layout',title:s.layout==='single'?'位置':'布局',label:s.layout==='single'?positions[s.position]:` ${s.arrangement==='grid'?'水平':'交错'} · ${s.angle}°`},
    {id:'size',title:'大小',label:size},
    ...(s.layout==='tiled'?[{id:'density',title:'密度',label:s.density==='custom'?`间距 ${s.gap}px`:{sparse:'稀疏',medium:'适中',dense:'密集'}[s.density]}]:[]),
    {id:'opacity',title:'透明度',label:`${s.layout==='single'?s.singleOpacity:s.tileOpacity}%`},
    ...(s.kind==='text'?[{id:'color',title:'颜色',label:color}]:[])
  ];
});
function close(focus=false){opened.value=null;if(focus)trigger?.focus();}
async function toggle(id:string,event:MouseEvent){trigger=event.currentTarget as HTMLElement;opened.value=opened.value===id?null:id;await nextTick();root.value?.querySelector<HTMLElement>('.wm-popover button')?.focus();}
function outside(event:PointerEvent){if(!root.value?.contains(event.target as Node))close();}
watch(()=>[props.disabled,settings.value.kind,settings.value.layout],()=>{if(props.disabled||!panels.value.some(p=>p.id===opened.value))close();});
onMounted(()=>document.addEventListener('pointerdown',outside));
onBeforeUnmount(()=>document.removeEventListener('pointerdown',outside));
</script>
<template>
  <div ref="root" class="wm-parameter-bar" @keydown.esc.stop="close(true)">
    <div v-for="panel in panels" :key="panel.id" class="wm-parameter-anchor">
      <button class="parameter-button" :class="{active:opened===panel.id}" :aria-label="`${panel.title}：${panel.label}`" :aria-expanded="opened===panel.id" :aria-controls="`wm-${panel.id}`" :disabled="disabled" @click="toggle(panel.id,$event)">
        <span class="wm-parameter-name">{{panel.title}}：</span>
        <span v-if="panel.id==='color'" class="wm-color-dot" :style="{background:settings.color}"></span>
        {{panel.label}}<AppIcon name="chevron" :size="14" />
      </button>
      <div v-if="opened===panel.id" :id="`wm-${panel.id}`" class="parameter-popover wm-popover" role="dialog" :aria-label="`${panel.title}设置`">
        <div class="popover-title"><strong>{{panel.title}}</strong><button :aria-label="`关闭${panel.title}设置`" @click="close(true)"><AppIcon name="close" :size="16" /></button></div>
        <WatermarkDetails v-model="settings" :panel="panel.id" @layout="emit('layout',$event)" />
      </div>
    </div>
  </div>
</template>
