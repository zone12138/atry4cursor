<template>
  <div class="canvas-table" ref="tableContainer">
    <canvas 
      ref="tableCanvas"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @contextmenu="handleContextMenu"
      @wheel="handleWheel"
    ></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, defineEmits } from 'vue'
import { throttle } from 'lodash'

const props = defineProps({
  data: {
    type: Array,
    required: true
  },
  columns: {
    type: Array,
    required: true
  },
  headerHeight: {
    type: Number,
    default: 40
  },
  rowHeight: {
    type: Number,
    default: 30
  }
})

const emit = defineEmits(['context-menu'])

const tableContainer = ref(null)
const tableCanvas = ref(null)
const ctx = ref(null)
const scrollTop = ref(0)
const selectedRow = ref(null)
const resizingColumn = ref(null)
const hoveredCell = ref(null)

// 表格状态
const state = ref({
  columnWidths: {},
  startX: 0,
  isResizing: false,
})

onMounted(() => {
  initCanvas()
  window.addEventListener('resize', handleResize)
  render()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

const initCanvas = () => {
  const canvas = tableCanvas.value
  ctx.value = canvas.getContext('2d')
  
  // 设置 canvas 尺寸
  const dpr = window.devicePixelRatio
  const { width, height } = tableContainer.value.getBoundingClientRect()
  
  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  
  ctx.value.scale(dpr, dpr)
}

const render = throttle(() => {
  if (!ctx.value) return
  
  const context = ctx.value
  context.clearRect(0, 0, tableCanvas.value.width, tableCanvas.value.height)
  
  // 绘制表头
  drawHeaders()
  
  // 绘制数据行
  drawRows()
  
  // 绘制高亮行
  if (selectedRow.value !== null) {
    drawHighlightRow(selectedRow.value)
  }
  
  // 绘制悬停效果
  if (hoveredCell.value) {
    drawHoverEffect(hoveredCell.value)
  }
}, 16)

const drawHeaders = () => {
  const context = ctx.value
  let x = 0
  
  context.fillStyle = '#f5f5f5'
  context.fillRect(0, 0, tableCanvas.value.width, props.headerHeight)
  
  props.columns.forEach((column, index) => {
    const width = state.value.columnWidths[index] || 150
    
    // 绘制表头文本
    context.fillStyle = '#333'
    context.font = '14px Arial'
    context.textBaseline = 'middle'
    context.fillText(
      column.title,
      x + 10,
      props.headerHeight / 2
    )
    
    // 绘制分割线
    context.beginPath()
    context.moveTo(x + width, 0)
    context.lineTo(x + width, props.headerHeight)
    context.strokeStyle = '#e8e8e8'
    context.stroke()
    
    x += width
  })
}

const drawRows = () => {
  const context = ctx.value
  const startIndex = Math.floor(scrollTop.value / props.rowHeight)
  const visibleRows = Math.ceil(tableCanvas.value.height / props.rowHeight)
  
  const endIndex = Math.min(startIndex + visibleRows, props.data.length)
  
  for (let i = startIndex; i < endIndex; i++) {
    const row = props.data[i]
    const y = i * props.rowHeight - scrollTop.value + props.headerHeight
    
    let x = 0
    props.columns.forEach((column, columnIndex) => {
      const width = state.value.columnWidths[columnIndex] || 150
      
      // 绘制单元格文本
      context.fillStyle = '#333'
      context.font = '14px Arial'
      context.textBaseline = 'middle'
      context.fillText(
        row[column.key],
        x + 10,
        y + props.rowHeight / 2
      )
      
      x += width
    })
    
    // 绘制行分割线
    context.beginPath()
    context.moveTo(0, y + props.rowHeight)
    context.lineTo(tableCanvas.value.width, y + props.rowHeight)
    context.strokeStyle = '#e8e8e8'
    context.stroke()
  }
}

const handleMouseDown = (e) => {
  const { offsetX, offsetY } = e
  
  // 处理列宽调整
  if (isNearColumnBorder(offsetX, offsetY)) {
    state.value.isResizing = true
    state.value.startX = offsetX
    return
  }
  
  // 处理行选择
  if (offsetY > props.headerHeight) {
    const rowIndex = Math.floor((offsetY - props.headerHeight + scrollTop.value) / props.rowHeight)
    selectedRow.value = rowIndex
    render()
  }
}

const handleMouseMove = (e) => {
  const { offsetX, offsetY } = e
  
  if (state.value.isResizing && resizingColumn.value !== null) {
    const diff = offsetX - state.value.startX
    state.value.columnWidths[resizingColumn.value] = 
      (state.value.columnWidths[resizingColumn.value] || 150) + diff
    state.value.startX = offsetX
    render()
    return
  }
  
  // 更新悬停状态
  hoveredCell.value = getCellFromPoint(offsetX, offsetY)
  render()
}

const handleMouseUp = () => {
  state.value.isResizing = false
  resizingColumn.value = null
}

const handleContextMenu = (e) => {
  e.preventDefault()
  const { offsetX, offsetY } = e
  const cell = getCellFromPoint(offsetX, offsetY)
  
  if (cell) {
    // 触发自定义右键菜单事件
    emit('context-menu', {
      cell,
      event: e
    })
  }
}

const handleWheel = (e) => {
  e.preventDefault()
  scrollTop.value = Math.max(
    0,
    Math.min(
      scrollTop.value + e.deltaY,
      props.data.length * props.rowHeight - tableCanvas.value.height + props.headerHeight
    )
  )
  render()
}

const handleResize = throttle(() => {
  initCanvas()
  render()
}, 100)

// 工具函数
const isNearColumnBorder = (x, y) => {
  if (y > props.headerHeight) return false
  
  let currentX = 0
  for (let i = 0; i < props.columns.length; i++) {
    currentX += state.value.columnWidths[i] || 150
    if (Math.abs(x - currentX) < 5) {
      resizingColumn.value = i
      return true
    }
  }
  return false
}

const getCellFromPoint = (x, y) => {
  if (y < props.headerHeight) return null
  
  const rowIndex = Math.floor((y - props.headerHeight + scrollTop.value) / props.rowHeight)
  
  let currentX = 0
  let columnIndex = 0
  
  for (let i = 0; i < props.columns.length; i++) {
    const width = state.value.columnWidths[i] || 150
    if (x >= currentX && x < currentX + width) {
      columnIndex = i
      break
    }
    currentX += width
  }
  
  return {
    rowIndex,
    columnIndex,
    value: props.data[rowIndex]?.[props.columns[columnIndex].key]
  }
}

const drawHighlightRow = (rowIndex) => {
  const context = ctx.value
  const y = rowIndex * props.rowHeight - scrollTop.value + props.headerHeight
  
  context.fillStyle = 'rgba(24, 144, 255, 0.1)'
  context.fillRect(0, y, tableCanvas.value.width, props.rowHeight)
}

const drawHoverEffect = (cell) => {
  if (!cell) return
  
  const context = ctx.value
  const y = cell.rowIndex * props.rowHeight - scrollTop.value + props.headerHeight
  
  let x = 0
  for (let i = 0; i < cell.columnIndex; i++) {
    x += state.value.columnWidths[i] || 150
  }
  
  const width = state.value.columnWidths[cell.columnIndex] || 150
  
  context.fillStyle = 'rgba(0, 0, 0, 0.02)'
  context.fillRect(x, y, width, props.rowHeight)
}
</script>

<style scoped>
.canvas-table {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

canvas {
  display: block;
}
</style> 