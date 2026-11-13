<script setup lang="ts">
import { useId, type HTMLAttributes } from "vue";
import { cn } from "~/lib/utils";

const props = withDefaults(
  defineProps<{
    size?: number;
    class?: HTMLAttributes["class"];
    spinning?: boolean;
  }>(),
  {
    size: 24,
    spinning: false,
  },
);

const uid = useId();
const bgGradId = `ptd-logo-bg-${uid}`;
const glowGradId = `ptd-logo-glow-${uid}`;
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    :class="cn('shrink-0 select-none', props.class)"
    aria-hidden="true"
  >
    <defs>
      <linearGradient :id="bgGradId" x1="3" y1="2" x2="29" y2="30" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#3B82F6" />
        <stop offset="52%" stop-color="#2563EB" />
        <stop offset="100%" stop-color="#4338CA" />
      </linearGradient>
      <linearGradient :id="glowGradId" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.32" />
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.04" />
      </linearGradient>
    </defs>

    <!-- 现代超椭圆底座 + 顶部微高光内描边 -->
    <rect x="1.5" y="1.5" width="29" height="29" rx="8" :fill="`url(#${bgGradId})`" />
    <rect x="2" y="2" width="28" height="28" rx="7.5" :stroke="`url(#${glowGradId})`" stroke-width="1" />

    <!-- 内部几何聚合拓扑（传承三节点符号，重构为锐利现代扁平几何） -->
    <g :class="cn('origin-center', props.spinning && 'animate-spin')">
      <!-- 三角外环淡流线 -->
      <path
        d="M16 8.5L9.2 20.8H22.8L16 8.5Z"
        stroke="#FFFFFF"
        stroke-opacity="0.28"
        stroke-width="1.4"
        stroke-linejoin="round"
      />
      <!-- 中心汇聚干线 -->
      <path
        d="M16 8.5V16.6M16 16.6L9.2 20.8M16 16.6L22.8 20.8"
        stroke="#FFFFFF"
        stroke-width="2.1"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <!-- 中心枢纽核 -->
      <circle cx="16" cy="16.6" r="2.3" fill="#FFFFFF" />
      <!-- 顶部主节点 + 左右双轨节点 -->
      <circle cx="16" cy="8.5" r="2.9" fill="#FFFFFF" />
      <circle cx="9.2" cy="20.8" r="2.6" fill="#BAE6FD" />
      <circle cx="22.8" cy="20.8" r="2.6" fill="#C7D2FE" />
    </g>
  </svg>
</template>
